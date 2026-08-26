import type { AppData, BeachSetMap } from '../../domain/appData';
import { areSharedStatesEqual } from './sharedStateController';

const NON_SET_FIELDS: ReadonlyArray<Exclude<keyof AppData, 'sets'>> = [
  'extraBeds',
  'beachReservations',
  'savedSurnames',
  'sunbedSales',
  'aquaparkEntries',
  'transactions',
  'reportArchive',
  'lastAutomaticResetDate',
];

/**
 * Recovers only compatible Beach-set edits from a legacy/incomplete pending
 * snapshot. Every non-set field must still equal the pending base. For each
 * locally changed set, the server must contain either the base value or the
 * identical desired value. Anything else remains a deliberate conflict.
 */
export function reconcileCompatibleBeachSetPendingState(
  baseState: AppData,
  desiredState: AppData,
  serverState: AppData,
): AppData | null {
  if (
    NON_SET_FIELDS.some(
      (field) => !areSharedStatesEqual(desiredState[field], baseState[field]),
    )
  ) {
    return null;
  }

  const mergedSets: BeachSetMap = { ...serverState.sets };
  let localSetChanged = false;

  for (const key of Object.keys(baseState.sets)) {
    const setId = Number(key);
    const baseSet = baseState.sets[setId];
    const desiredSet = desiredState.sets[setId];
    const serverSet = serverState.sets[setId];

    if (!baseSet || !desiredSet || !serverSet) {
      return null;
    }

    if (areSharedStatesEqual(desiredSet, baseSet)) {
      continue;
    }

    localSetChanged = true;
    if (
      !areSharedStatesEqual(serverSet, baseSet) &&
      !areSharedStatesEqual(serverSet, desiredSet)
    ) {
      return null;
    }
    mergedSets[setId] = desiredSet;
  }

  return localSetChanged ? { ...serverState, sets: mergedSets } : null;
}
