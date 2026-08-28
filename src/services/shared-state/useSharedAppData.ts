import { useCallback, useEffect, useRef, useState } from 'react';
import type { AppData } from '../../domain/appData';
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
  type SharedUpdateAdmission,
} from './sharedStateController';
import { createSupabaseSharedLocationStateRepository } from './supabaseRepository';
import {
  createClientSyncTelemetry,
  createNoopClientSyncTelemetry,
  type ClientSyncTelemetry,
} from './syncTelemetry';

export type SharedAppDataSession = {
  state: SharedStateControllerState<AppData>;
  noteVisibleMutation(): number;
  update(nextState: AppData, mutationSequence?: number): SharedUpdateAdmission;
  recordLocalSafetyBlock(mutationSequence?: number): void;
  retrySecuringChange(): SharedUpdateAdmission;
  reload(): Promise<void>;
};

export type UserScopedSharedState<T> = {
  userId: string | null;
  locationId: string | null;
  state: SharedStateControllerState<T>;
};

export type SharedControllerBinding<T> = {
  userId: string;
  locationId: string;
  controller: Pick<SharedStateController<T>, 'update'>;
  telemetry?: ClientSyncTelemetry;
};

export function admitSharedUpdateForBinding<T>(
  authenticatedUserId: string | null,
  selectedLocationId: string | null,
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
  if (binding.locationId !== selectedLocationId) {
    return { status: 'rejected', reason: 'location_mismatch' };
  }
  return binding.controller.update(nextState, mutationSequence);
}

const LOADING_SHARED_STATE = { status: 'loading' } as const;

export function scopeSharedStateToSelection<T>(
  authenticatedUserId: string | null,
  selectedLocationId: string | null,
  scopedState: UserScopedSharedState<T>,
): SharedStateControllerState<T> {
  return authenticatedUserId
    && selectedLocationId
    && scopedState.userId === authenticatedUserId
    && scopedState.locationId === selectedLocationId
    ? scopedState.state
    : LOADING_SHARED_STATE;
}

export function useSharedAppData(
  authenticatedUserId: string | null,
  selectedLocationId: string | null,
  normalize: NormalizeSharedState<AppData>,
  repository?: SharedLocationStateRepository<AppData>,
  pendingStore?: PendingSharedStateStore<AppData>,
): SharedAppDataSession {
  const [configuration] = useState(() => ({
    repository: repository ?? createSupabaseSharedLocationStateRepository<AppData>(),
    pendingStore: pendingStore ?? createBrowserPendingSharedStateStore<AppData>(),
  }));
  const controllerRef = useRef<{
    userId: string;
    locationId: string;
    controller: SharedStateController<AppData>;
    telemetry: ClientSyncTelemetry;
  } | null>(null);
  const telemetryRef = useRef<{
    locationId: string;
    telemetry: ClientSyncTelemetry;
  } | null>(null);
  const [scopedState, setScopedState] = useState<UserScopedSharedState<AppData>>({
    userId: null,
    locationId: null,
    state: LOADING_SHARED_STATE,
  });
  const mutationSequenceRef = useRef(0);

  useEffect(() => {
    if (!authenticatedUserId || !selectedLocationId) {
      controllerRef.current = null;
      telemetryRef.current = null;
      setScopedState({
        userId: null,
        locationId: null,
        state: LOADING_SHARED_STATE,
      });
      return;
    }

    const telemetry = createClientSyncTelemetry(selectedLocationId);
    const telemetryBinding = { locationId: selectedLocationId, telemetry };
    telemetryRef.current = telemetryBinding;
    const controller = new SharedStateController(
      configuration.repository,
      selectedLocationId,
      normalize,
      {
        userId: authenticatedUserId,
        pendingStore: configuration.pendingStore,
        reconcilePendingState: reconcileCompatibleBeachSetPendingState,
        telemetry,
      },
    );
    const binding = {
      userId: authenticatedUserId,
      locationId: selectedLocationId,
      controller,
      telemetry,
    };
    controllerRef.current = binding;
    mutationSequenceRef.current = 0;
    setScopedState({
      userId: authenticatedUserId,
      locationId: selectedLocationId,
      state: LOADING_SHARED_STATE,
    });
    const unsubscribe = controller.observe((state) => {
      if (controllerRef.current === binding) {
        setScopedState({
          userId: authenticatedUserId,
          locationId: selectedLocationId,
          state,
        });
      }
    });
    controller.activate();
    telemetry.record({ eventCode: 'APP_BOOT' });
    void controller.reload();

    const handleResume = () => controller.resume();
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        telemetry.record({ eventCode: 'VISIBILITY_RESUME' });
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
      if (telemetryRef.current === telemetryBinding) {
        telemetryRef.current = null;
      }
    };
  }, [authenticatedUserId, configuration, normalize, selectedLocationId]);

  const update = useCallback(
    (nextState: AppData, suppliedMutationSequence?: number): SharedUpdateAdmission => {
      const binding = controllerRef.current;
      const telemetry = binding?.telemetry
        ?? (telemetryRef.current?.locationId === selectedLocationId
          ? telemetryRef.current.telemetry
          : createNoopClientSyncTelemetry());
      const mutationSequence = suppliedMutationSequence ?? ++mutationSequenceRef.current;
      telemetry.record({ eventCode: 'BRIDGE_FORWARDED', mutationSequence });
      const admission = admitSharedUpdateForBinding(
        authenticatedUserId,
        selectedLocationId,
        binding,
        nextState,
        mutationSequence,
      );
      if (admission.status === 'rejected' && (
        admission.reason === 'controller_unavailable'
        || admission.reason === 'identity_mismatch'
        || admission.reason === 'location_mismatch'
      )) {
        telemetry.record({
          eventCode: 'CONTROLLER_REJECTED',
          mutationSequence,
          errorCategory: admission.reason,
        });
      }
      return admission;
    },
    [authenticatedUserId, selectedLocationId],
  );

  const noteVisibleMutation = useCallback(() => {
    const mutationSequence = ++mutationSequenceRef.current;
    (controllerRef.current?.telemetry ?? telemetryRef.current?.telemetry)?.record({
      eventCode: 'MUTATION_VISIBLE',
      mutationSequence,
    });
    return mutationSequence;
  }, []);

  const recordLocalSafetyBlock = useCallback((mutationSequence?: number) => {
    (controllerRef.current?.telemetry ?? telemetryRef.current?.telemetry)?.record({
      eventCode: 'CONTROLLER_BLOCKED',
      mutationSequence,
      errorCategory: 'admission_timeout',
    });
  }, []);

  const retrySecuringChange = useCallback((): SharedUpdateAdmission => {
    const binding = controllerRef.current;
    if (!binding) {
      return { status: 'rejected', reason: 'controller_unavailable' };
    }
    if (binding.userId !== authenticatedUserId) {
      return { status: 'rejected', reason: 'identity_mismatch' };
    }
    if (binding.locationId !== selectedLocationId) {
      return { status: 'rejected', reason: 'location_mismatch' };
    }
    return binding.controller.retrySecuringChange();
  }, [authenticatedUserId, selectedLocationId]);

  const reload = useCallback(() => {
    const binding = controllerRef.current;
    return binding?.userId === authenticatedUserId
      && binding.locationId === selectedLocationId
      ? binding.controller.reload()
      : Promise.resolve();
  }, [authenticatedUserId, selectedLocationId]);

  return {
    state: scopeSharedStateToSelection(
      authenticatedUserId,
      selectedLocationId,
      scopedState,
    ),
    noteVisibleMutation,
    update,
    recordLocalSafetyBlock,
    retrySecuringChange,
    reload,
  };
}
