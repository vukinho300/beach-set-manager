import { useCallback, useEffect, useRef, useState } from 'react';
import type { AppData } from '../../domain/appData';
import { PETALON_LOCATION_ID } from '../../domain/petalon';
import type { SharedLocationStateRepository } from './repository';
import { reconcileCompatibleBeachSetPendingState } from './appDataPendingRecovery';
import {
  createBrowserPendingSharedStateStore,
  type PendingSharedStateStore,
} from './pendingSharedStateStore';
import {
  SharedStateController,
  type NormalizeSharedState,
  type SharedStateControllerState,
} from './sharedStateController';
import { createSupabaseSharedLocationStateRepository } from './supabaseRepository';

export type SharedAppDataSession = {
  state: SharedStateControllerState<AppData>;
  update(nextState: AppData): void;
  reload(): Promise<void>;
};

export type UserScopedSharedState<T> = {
  userId: string | null;
  state: SharedStateControllerState<T>;
};

const LOADING_SHARED_STATE = { status: 'loading' } as const;

export function scopeSharedStateToAuthenticatedUser<T>(
  authenticatedUserId: string | null,
  scopedState: UserScopedSharedState<T>,
): SharedStateControllerState<T> {
  return authenticatedUserId && scopedState.userId === authenticatedUserId
    ? scopedState.state
    : LOADING_SHARED_STATE;
}

export function useSharedAppData(
  authenticatedUserId: string | null,
  normalize: NormalizeSharedState<AppData>,
  repository?: SharedLocationStateRepository<AppData>,
  pendingStore?: PendingSharedStateStore<AppData>,
): SharedAppDataSession {
  const [configuration] = useState(() => ({
    repository: repository ?? createSupabaseSharedLocationStateRepository<AppData>(),
    pendingStore: pendingStore ?? createBrowserPendingSharedStateStore<AppData>(),
    normalize,
  }));
  const controllerRef = useRef<{
    userId: string;
    controller: SharedStateController<AppData>;
  } | null>(null);
  const [scopedState, setScopedState] = useState<UserScopedSharedState<AppData>>(
    {
      userId: null,
      state: LOADING_SHARED_STATE,
    },
  );

  useEffect(() => {
    if (!authenticatedUserId) {
      controllerRef.current = null;
      setScopedState({ userId: null, state: LOADING_SHARED_STATE });
      return;
    }

    const controller = new SharedStateController(
      configuration.repository,
      PETALON_LOCATION_ID,
      configuration.normalize,
      {
        userId: authenticatedUserId,
        pendingStore: configuration.pendingStore,
        reconcilePendingState: reconcileCompatibleBeachSetPendingState,
      },
    );
    const binding = { userId: authenticatedUserId, controller };
    controllerRef.current = binding;
    const unsubscribe = controller.observe((state) => {
      if (controllerRef.current === binding) {
        setScopedState({ userId: authenticatedUserId, state });
      }
    });
    controller.activate();
    void controller.reload();

    const handleResume = () => controller.resume();
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        controller.resume();
      }
    };
    window.addEventListener('online', handleResume);
    window.addEventListener('focus', handleResume);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('online', handleResume);
      window.removeEventListener('focus', handleResume);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      unsubscribe();
      controller.deactivate();
      if (controllerRef.current === binding) {
        controllerRef.current = null;
      }
    };
  }, [authenticatedUserId, configuration]);

  const update = useCallback(
    (nextState: AppData) => {
      const binding = controllerRef.current;
      if (binding?.userId === authenticatedUserId) {
        binding.controller.update(nextState);
      }
    },
    [authenticatedUserId],
  );
  const reload = useCallback(() => {
    const binding = controllerRef.current;
    return binding?.userId === authenticatedUserId
      ? binding.controller.reload()
      : Promise.resolve();
  }, [authenticatedUserId]);

  const state = scopeSharedStateToAuthenticatedUser(
    authenticatedUserId,
    scopedState,
  );

  return { state, update, reload };
}
