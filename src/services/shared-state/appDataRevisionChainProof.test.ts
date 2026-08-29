import { describe, expect, it } from 'vitest';
import { createDefaultAppData, type AquaparkEntry, type Transaction } from '../../domain/appData';
import { isMonotonicAppDataRevisionChain } from './appDataRevisionChainProof';

const NOW = '2026-08-29T12:30:00.000Z';

function clone<T>(value: T): T {
  return structuredClone(value);
}

function transaction(id: string): Transaction {
  return {
    id,
    type: 'beach_set',
    amount: 12,
    createdAt: NOW,
    resourceId: '13',
    resourceLabel: 'Set 13',
  };
}

function aquaparkEntry(): AquaparkEntry {
  return {
    id: '52b01ca1-d713-4029-9e9e-0ae0c7cb2829',
    wristbands: [15, 48],
    ticketType: '30min',
    defaultUnitPrice: 8,
    unitPrice: 8,
    totalPrice: 16,
    priceMode: 'default',
    status: 'active',
    startAt: NOW,
    endAt: '2026-08-29T13:10:00.000Z',
    extraMinutes: 0,
    createdAt: NOW,
    returnedWristbands: [],
  };
}

describe('multi-revision semantic proof', () => {
  it('accepts Incident 3 updatedAt-only then final Set transition', () => {
    const base = createDefaultAppData(new Date(NOW));
    base.aquaparkEntries = [aquaparkEntry()];
    const revision522 = clone(base);
    revision522.sets[53].updatedAt = '2026-08-29T12:30:34.605Z';
    const revision523 = clone(revision522);
    revision523.sets[53].status = 'left';
    revision523.sets[53].updatedAt = '2026-08-29T12:30:40.404Z';

    expect(isMonotonicAppDataRevisionChain([base, revision522, revision523])).toBe(true);
  });

  it('accepts several disjoint resources reaching their final values', () => {
    const base = createDefaultAppData(new Date(NOW));
    const first = clone(base);
    first.sets[13] = {
      ...first.sets[13],
      status: 'paid',
      price: 12,
      priceMode: 'fixed',
      dailySaleId: 'transaction-a',
      updatedAt: NOW,
    };
    first.transactions.push(transaction('transaction-a'));
    const second = clone(first);
    second.sets[14] = { ...second.sets[14], status: 'left', updatedAt: NOW };

    expect(isMonotonicAppDataRevisionChain([base, first, second])).toBe(true);
  });

  it('rejects a touched resource that is later restored', () => {
    const base = createDefaultAppData(new Date(NOW));
    const intermediate = clone(base);
    intermediate.sets[53] = { ...intermediate.sets[53], status: 'left', updatedAt: NOW };
    const final = clone(base);
    final.sets[54] = { ...final.sets[54], status: 'left', updatedAt: NOW };

    expect(isMonotonicAppDataRevisionChain([base, intermediate, final])).toBe(false);
  });

  it('rejects financial state that is added and later hidden', () => {
    const base = createDefaultAppData(new Date(NOW));
    const intermediate = clone(base);
    intermediate.transactions.push(transaction('transient-payment'));
    const final = clone(base);
    final.sets[53] = { ...final.sets[53], status: 'left', updatedAt: NOW };

    expect(isMonotonicAppDataRevisionChain([base, intermediate, final])).toBe(false);
  });

  it('rejects reset-and-restore history hidden by the final snapshot', () => {
    const base = createDefaultAppData(new Date(NOW));
    base.lastAutomaticResetDate = '2026-08-28';
    const reset = clone(base);
    reset.lastAutomaticResetDate = '2026-08-29';
    const final = clone(base);
    final.sets[53] = { ...final.sets[53], status: 'left', updatedAt: NOW };

    expect(isMonotonicAppDataRevisionChain([base, reset, final])).toBe(false);
  });

  it('rejects a third intermediate value on the same business resource', () => {
    const base = createDefaultAppData(new Date(NOW));
    const reserved = clone(base);
    reserved.beachReservations = [{
      id: 'reservation-a',
      surname: 'Guest',
      startDate: '2026-08-29',
      endDate: '2026-08-29',
      createdAt: NOW,
    }];
    reserved.sets[53] = {
      ...reserved.sets[53],
      status: 'reserved',
      beachReservationId: 'reservation-a',
      surname: 'Guest',
      reservedDays: 1,
      updatedAt: NOW,
    };
    const left = clone(base);
    left.sets[53] = { ...left.sets[53], status: 'left', updatedAt: NOW };

    expect(isMonotonicAppDataRevisionChain([base, reserved, left])).toBe(false);
  });
});
