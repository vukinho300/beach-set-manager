import { describe, expect, it } from 'vitest';
import type { BeachSet, ExtraBed } from './appData';
import {
  isBeachSetStatusMutationNoop,
  isExtraBedStatusMutationNoop,
} from './beachSetStatusMutation';

const freeSet: BeachSet = { id: 53, beach: 2, status: 'free' };

describe('Beach Set status mutation admission', () => {
  it('rejects the Incident 3 FREE-to-FREE updatedAt-only revision at its source', () => {
    expect(isBeachSetStatusMutationNoop(freeSet, 'free')).toBe(true);
  });

  it('keeps a real FREE-to-LEFT operation', () => {
    expect(isBeachSetStatusMutationNoop(freeSet, 'left')).toBe(false);
  });

  it('never suppresses a paid action that creates a financial bundle', () => {
    const paid: BeachSet = {
      ...freeSet,
      status: 'paid',
      price: 12,
      priceMode: 'fixed',
      dailySaleId: 'existing-payment',
      updatedAt: '2026-08-29T12:30:00.000Z',
    };

    expect(isBeachSetStatusMutationNoop(paid, 'paid', {
      price: 12,
      priceMode: 'fixed',
    })).toBe(false);
  });

  it('does not hide a same-status reservation detail change', () => {
    const reserved: BeachSet = {
      ...freeSet,
      status: 'reserved',
      beachReservationId: 'reservation-a',
      surname: 'Guest A',
      reservedDays: 2,
    };

    expect(isBeachSetStatusMutationNoop(reserved, 'reserved', {
      beachReservationId: 'reservation-b',
      surname: 'Guest B',
      reservedDays: 3,
    })).toBe(false);
  });

  it('also prevents a FREE-to-FREE Bed updatedAt-only revision', () => {
    const bed: ExtraBed = { id: 1, label: 'Bed 1', status: 'free' };
    expect(isExtraBedStatusMutationNoop(bed, 'free')).toBe(true);
  });
});
