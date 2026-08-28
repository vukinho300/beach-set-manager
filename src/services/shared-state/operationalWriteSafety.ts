import type { SharedDeviceSafety, SharedSyncStatus } from './sharedStateController';

export const OPERATIONAL_ADMISSION_WINDOW_MS = 750;

export function shouldLockOperationalMutations(
  visibleStateTrackedByController: boolean,
  deviceSafety: SharedDeviceSafety,
  locallyBlocked: boolean,
): boolean {
  return locallyBlocked
    || !visibleStateTrackedByController
    || deviceSafety === 'securing'
    || deviceSafety === 'blocked';
}

export function shouldArmAdmissionWatchdog(
  visibleStateTrackedByController: boolean,
  syncStatus: SharedSyncStatus,
  deviceSafety: SharedDeviceSafety,
): boolean {
  return !visibleStateTrackedByController
    && syncStatus === 'saved'
    && deviceSafety === 'safe';
}

export function canSwitchOperationalLocation(
  localMatchesController: boolean,
  syncStatus: SharedSyncStatus,
  deviceSafety: SharedDeviceSafety,
  locallyBlocked: boolean,
): boolean {
  return localMatchesController
    && syncStatus === 'saved'
    && deviceSafety === 'safe'
    && !locallyBlocked;
}

export function scheduleAdmissionWatchdog(
  onTimeout: () => void,
  delayMs = OPERATIONAL_ADMISSION_WINDOW_MS,
): () => void {
  const timer = globalThis.setTimeout(onTimeout, delayMs);
  return () => globalThis.clearTimeout(timer);
}
