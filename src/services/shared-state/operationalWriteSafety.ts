import type { SharedDeviceSafety, SharedSyncStatus } from './sharedStateController';

export const OPERATIONAL_ADMISSION_WINDOW_MS = 750;

export function shouldLockOperationalMutations(
  localMatchesController: boolean,
  deviceSafety: SharedDeviceSafety,
  locallyBlocked: boolean,
): boolean {
  return locallyBlocked
    || !localMatchesController
    || deviceSafety === 'securing'
    || deviceSafety === 'blocked';
}

export function shouldArmAdmissionWatchdog(
  localMatchesController: boolean,
  syncStatus: SharedSyncStatus,
  deviceSafety: SharedDeviceSafety,
): boolean {
  return !localMatchesController
    && syncStatus === 'saved'
    && deviceSafety === 'safe';
}

export function scheduleAdmissionWatchdog(
  onTimeout: () => void,
  delayMs = OPERATIONAL_ADMISSION_WINDOW_MS,
): () => void {
  const timer = globalThis.setTimeout(onTimeout, delayMs);
  return () => globalThis.clearTimeout(timer);
}
