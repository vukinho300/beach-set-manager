import { useCallback, useEffect, useState } from 'react';
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

export function useSharedAppData(
  authenticatedUserId: string | null,
  normalize: NormalizeSharedState<AppData>,
  repository?: SharedLocationStateRepository<AppData>,
): SharedAppDataSession {
  const [controller] = useState(
    () =>
      new SharedStateController(
        repository ?? createSupabaseSharedLocationStateRepository<AppData>(),
        PETALON_LOCATION_ID,
        normalize,
      ),
  );
  const [state, setState] = useState(() => controller.getSnapshot());

  useEffect(() => controller.observe(setState), [controller]);

  useEffect(() => {
    if (authenticatedUserId) {
      void controller.reload();
    }
  }, [authenticatedUserId, controller]);

  const update = useCallback(
    (nextState: AppData) => controller.update(nextState),
    [controller],
  );
  const reload = useCallback(() => controller.reload(), [controller]);

  return { state, update, reload };
}
