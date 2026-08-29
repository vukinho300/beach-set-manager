import type { BeachSet, BedStatus, ExtraBed, SetStatus } from './appData';

function valuesMatch(first: unknown, second: unknown): boolean {
  return first === second || (first === undefined && second === undefined);
}

/**
 * Detects a status action that would only refresh `updatedAt`.
 * Paid actions are deliberately excluded because they create a new financial bundle.
 */
export function isBeachSetStatusMutationNoop(
  set: BeachSet,
  status: SetStatus,
  details: Partial<BeachSet> = {},
): boolean {
  if (status === 'paid' || set.status !== status) {
    return false;
  }

  const clearedDetails: Partial<BeachSet> = status === 'reserved'
    ? { price: undefined, priceMode: undefined, dailySaleId: undefined }
    : {
        beachReservationId: undefined,
        surname: undefined,
        reservedDays: undefined,
        price: undefined,
        priceMode: undefined,
        dailySaleId: undefined,
      };
  const candidate = { ...set, ...clearedDetails, ...details, status };
  const keys = new Set([...Object.keys(set), ...Object.keys(candidate)]);
  keys.delete('updatedAt');

  return [...keys].every((key) => valuesMatch(
    set[key as keyof BeachSet],
    candidate[key as keyof BeachSet],
  ));
}

/** Prevents the identical updatedAt-only revision in the parallel Bed editor flow. */
export function isExtraBedStatusMutationNoop(
  bed: ExtraBed,
  status: BedStatus,
  details: Partial<ExtraBed> = {},
): boolean {
  if (status === 'paid' || bed.status !== status) {
    return false;
  }

  const clearedDetails: Partial<ExtraBed> = status === 'reserved'
    ? { price: undefined, priceMode: undefined, dailySaleId: undefined }
    : {
        beachReservationId: undefined,
        surname: undefined,
        reservedDays: undefined,
        price: undefined,
        priceMode: undefined,
        dailySaleId: undefined,
      };
  const candidate = { ...bed, ...clearedDetails, ...details, status };
  const keys = new Set([...Object.keys(bed), ...Object.keys(candidate)]);
  keys.delete('updatedAt');

  return [...keys].every((key) => valuesMatch(
    bed[key as keyof ExtraBed],
    candidate[key as keyof ExtraBed],
  ));
}
