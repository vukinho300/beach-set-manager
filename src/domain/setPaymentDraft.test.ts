import { describe, expect, it } from 'vitest';
import { createDefaultAppData, type BeachSet, type Transaction } from './appData';
import {
  createFreshSetPaymentDraft,
  getSetPaymentDraftAmount,
} from './setPaymentDraft';

function parsePositiveTestMoney(value: string): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

describe('fresh paid-set editor draft', () => {
  it('does not initialize from a historical fixed EUR 12 payment', () => {
    const paidSet: BeachSet = {
      id: 40,
      beach: 2,
      status: 'paid',
      price: 12,
      priceMode: 'fixed',
    };

    const draft = createFreshSetPaymentDraft(paidSet);

    expect(draft).toEqual({
      fixedTotal: 0,
      priceMode: 'fixed',
      specialPrice: '',
    });
    expect(getSetPaymentDraftAmount(draft, parsePositiveTestMoney)).toBeNull();
  });

  it('does not initialize from a historical special price', () => {
    const paidSet: BeachSet = {
      id: 40,
      beach: 2,
      status: 'paid',
      price: 17.5,
      priceMode: 'special',
    };

    expect(createFreshSetPaymentDraft(paidSet)).toEqual({
      fixedTotal: 0,
      priceMode: 'fixed',
      specialPrice: '',
    });
  });

  it('creates no AppData mutation or fake transaction when the fresh draft opens', () => {
    const state = createDefaultAppData(new Date(2026, 7, 26, 12));
    const transaction: Transaction = {
      id: 'historical-set-40-payment',
      type: 'beach_set',
      amount: 12,
      createdAt: '2026-08-26T12:00:00.000Z',
      resourceId: '40',
      resourceLabel: 'Set 40',
    };
    const historicalState = {
      ...state,
      sets: {
        ...state.sets,
        40: {
          ...state.sets[40],
          status: 'paid' as const,
          price: 12,
          priceMode: 'fixed' as const,
        },
      },
      transactions: [transaction],
    };
    const before = JSON.stringify(historicalState);

    createFreshSetPaymentDraft(historicalState.sets[40]);

    expect(JSON.stringify(historicalState)).toBe(before);
    expect(historicalState.transactions).toEqual([transaction]);
  });

  it('still accepts newly selected fixed and special amounts', () => {
    const fresh = createFreshSetPaymentDraft({ price: 12, priceMode: 'fixed' });

    expect(getSetPaymentDraftAmount(
      { ...fresh, fixedTotal: 4 },
      parsePositiveTestMoney,
    )).toBe(4);
    expect(getSetPaymentDraftAmount(
      { ...fresh, fixedTotal: 12 },
      parsePositiveTestMoney,
    )).toBe(12);
    expect(getSetPaymentDraftAmount(
      { ...fresh, priceMode: 'special', specialPrice: '17.50' },
      parsePositiveTestMoney,
    )).toBe(17.5);
  });
});
