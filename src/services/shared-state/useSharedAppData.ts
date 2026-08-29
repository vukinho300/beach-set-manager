import { useCallback, useEffect, useRef, useState } from 'react';
import type { AppData } from '../../domain/appData';
import { PETALON_LOCATION_ID } from '../../domain/petalon';
import type { SharedLocationStateRepository } from './repository';
import {
  isValidAppDataReconciliationSnapshot,
  reconcileKnownRejectedAppDataConflict,
} from './appDataKnownConflictReconciliation';
import { reconcileCompatibleBeachSetPendingState } from './appDataPendingRecovery';
import {
  createBrowserPendingSharedStateStore,
  type PendingSharedStateStore,
} from './pendingSharedStateStore';
import {
  SharedStateController,
  type NormalizeSharedState,
  type SharedConflictDiscardResult,
  type SharedStateControllerState,
  type SharedUpdateAdmission,
} from './sharedStateController';
import { createSupabaseSharedLocationStateRepository } from './supabaseRepository';
import { createClientSyncTelemetry } from './syncTelemetry';

export type SharedAppDataSession = {
  state: SharedStateControllerState<AppData>;
  noteVisibleMutation(): number;
  update(nextState: AppData, mutationSequence?: number): SharedUpdateAdmission;
  recordLocalSafetyBlock(mutationSequence?: number): void;
  retrySecuringChange(): SharedUpdateAdmission;
  discardPendingConflictAndUseLatest(): Promise<SharedConflictDiscardResult>;
  reload(): Promise<void>;
};

export type UserScopedSharedState<T> = {
  userId: string | null;
  state: SharedStateControllerState<T>;
};

export type SharedControllerBinding<T> = {
  userId: string;
  controller: Pick<SharedStateController<T>, 'update'>;
};

export function admitSharedUpdateForBinding<T>(
  authenticatedUserId: string | null,
  binding: SharedControllerBinding<T> | null,
  nextState: T,
  mutationSequence?: number,
): SharedUpdateAdmission {
  if (!binding) {
    return { status: 'rejected', reason: 'controller_unavailable' };
  }
  if (binding.userId !== authenticatedUserId) {
    return { status: 'rejected', reason: 'identity_mismatch' };
  }
  return binding.controller.update(nextState, mutationSequence);
}

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
    telemetry: createClientSyncTelemetry(PETALON_LOCATION_ID),
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
  const mutationSequenceRef = useRef(0);

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
        reconcileKnownRejectedConflict: reconcileKnownRejectedAppDataConflict,
        validateKnownConflictCurrent: isValidAppDataReconciliationSnapshot,
        telemetry: configuration.telemetry,
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
    configuration.telemetry.record({ eventCode: 'APP_BOOT' });
    void controller.reload();

    const handleResume = () => controller.resume();
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        configuration.telemetry.record({ eventCode: 'VISIBILITY_RESUME' });
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
    (nextState: AppData, suppliedMutationSequence?: number): SharedUpdateAdmission => {
      const binding = controllerRef.current;
      const mutationSequence = suppliedMutationSequence ?? ++mutationSequenceRef.current;
      configuration.telemetry.record({ eventCode: 'BRIDGE_FORWARDED', mutationSequence });
      if (!binding) {
        configuration.telemetry.record({
          eventCode: 'CONTROLLER_REJECTED',
          mutationSequence,
          errorCategory: 'controller_unavailable',
        });
        return admitSharedUpdateForBinding(
          authenticatedUserId,
          binding,
          nextState,
          mutationSequence,
        );
      }
      if (binding.userId !== authenticatedUserId) {
        configuration.telemetry.record({
          eventCode: 'CONTROLLER_REJECTED',
          mutationSequence,
          errorCategory: 'identity_mismatch',
        });
        return admitSharedUpdateForBinding(
          authenticatedUserId,
          binding,
          nextState,
          mutationSequence,
        );
      }
      return admitSharedUpdateForBinding(
        authenticatedUserId,
        binding,
        nextState,
        mutationSequence,
      );
    },
    [authenticatedUserId, configuration],
  );
  const noteVisibleMutation = useCallback(() => {
    const mutationSequence = ++mutationSequenceRef.current;
    configuration.telemetry.record({ eventCode: 'MUTATION_VISIBLE', mutationSequence });
    return mutationSequence;
  }, [configuration]);
  const recordLocalSafetyBlock = useCallback((mutationSequence?: number) => {
    configuration.telemetry.record({
      eventCode: 'CONTROLLER_BLOCKED',
      mutationSequence,
      errorCategory: 'admission_timeout',
    });
  }, [configuration]);
  const retrySecuringChange = useCallback((): SharedUpdateAdmission => {
    const binding = controllerRef.current;
    if (!binding) {
      return { status: 'rejected', reason: 'controller_unavailable' };
    }
    if (binding.userId !== authenticatedUserId) {
      return { status: 'rejected', reason: 'identity_mismatch' };
    }
    return binding.controller.retrySecuringChange();
  }, [authenticatedUserId]);
  const reload = useCallback(() => {
    const binding = controllerRef.current;
    return binding?.userId === authenticatedUserId
      ? binding.controller.reload()
      : Promise.resolve();
  }, [authenticatedUserId]);
  const discardPendingConflictAndUseLatest = useCallback(async (): Promise<SharedConflictDiscardResult> => {
    const binding = controllerRef.current;
    if (!binding || binding.userId !== authenticatedUserId) {
      return {
        status: 'rejected',
        reason: 'not_conflict',
        message: 'The preserved conflict is not available for this account.',
      };
    }
    return binding.controller.discardPendingConflictAndUseLatest();
  }, [authenticatedUserId]);

  const state = scopeSharedStateToAuthenticatedUser(
    authenticatedUserId,
    scopedState,
  );

  return {
    state,
    noteVisibleMutation,
    update,
    recordLocalSafetyBlock,
    retrySecuringChange,
    discardPendingConflictAndUseLatest,
    reload,
  };
}
