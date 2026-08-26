import type { BeachSet, SetPriceMode } from './appData';

export type SetPaymentDraft = {
  fixedTotal: number;
  priceMode: SetPriceMode;
  specialPrice: string;
};

/**
 * A paid-set editor always starts a new payment intent. Persisted Set fields
 * remain historical operational data and are deliberately not reused here.
 */
export function createFreshSetPaymentDraft(
  historicalSet: Pick<BeachSet, 'price' | 'priceMode'>,
): SetPaymentDraft {
  void historicalSet;
  return {
    fixedTotal: 0,
    priceMode: 'fixed',
    specialPrice: '',
  };
}

export function getSetPaymentDraftAmount(
  draft: SetPaymentDraft,
  parseSpecialPrice: (value: string) => number | null,
): number | null {
  if (draft.priceMode === 'special') {
    return parseSpecialPrice(draft.specialPrice);
  }

  return draft.fixedTotal > 0 ? draft.fixedTotal : null;
}
