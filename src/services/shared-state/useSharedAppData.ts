import { useCallback, useEffect, useRef, useState } from 'react';
import type { AppData } from '../../domain/appData';
import type { SharedLocationStateRepository } from './repository';
import {
  SharedStateController,
  type NormalizeSharedState,
  type SharedStateControllerState,
} from './sharedStateController';
import { createSupabaseSharedLocationStateRepository } from './supabaseRepository';

export const PETALON_LOCATION_ID = '00000000-0000-4000-8000-000000000001';

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
): SharedAppDataSession {
  const [configuration] = useState(() => ({
    repository: repository ?? createSupabaseSharedLocationStateRepository<AppData>(),
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

    return () => {
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
