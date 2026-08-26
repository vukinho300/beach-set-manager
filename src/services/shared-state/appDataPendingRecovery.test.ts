import { describe, expect, it } from 'vitest';
import { createDefaultAppData } from '../../domain/appData';
import { reconcileCompatibleBeachSetPendingState } from './appDataPendingRecovery';

describe('compatible Beach-set pending recovery', () => {
  it('rebases non-conflicting local set work over accepted and independent server set work', () => {
    const base = createDefaultAppData(new Date(2026, 7, 26, 12));
    const desired = {
      ...base,
      sets: {
        ...base.sets,
        40: { ...base.sets[40], status: 'left' as const },
        41: { ...base.sets[41], status: 'left' as const },
      },
    };
    const server = {
      ...base,
      sets: {
        ...base.sets,
        40: desired.sets[40],
        42: { ...base.sets[42], status: 'reserved' as const, surname: 'Other' },
      },
    };

    const recovered = reconcileCompatibleBeachSetPendingState(base, desired, server);

    expect(recovered?.sets[40]).toEqual(desired.sets[40]);
    expect(recovered?.sets[41]).toEqual(desired.sets[41]);
    expect(recovered?.sets[42]).toEqual(server.sets[42]);
  });

  it('refuses same-set conflicts and all non-set pending mutations', () => {
    const base = createDefaultAppData(new Date(2026, 7, 26, 12));
    const desiredSetChange = {
      ...base,
      sets: {
        ...base.sets,
        40: { ...base.sets[40], status: 'left' as const },
      },
    };
    const conflictingServer = {
      ...base,
      sets: {
        ...base.sets,
        40: { ...base.sets[40], status: 'paid' as const, price: 20 },
      },
    };
    const desiredAquaparkChange = {
      ...base,
      aquaparkEntries: [{
        id: 'pending-aquapark',
        wristbands: [91],
        ticketType: '30min' as const,
        defaultUnitPrice: 12,
        unitPrice: 12,
        totalPrice: 12,
        priceMode: 'default' as const,
        status: 'active' as const,
        startAt: '2026-08-26T12:00:00.000Z',
        extraMinutes: 0,
        createdAt: '2026-08-26T12:00:00.000Z',
        returnedWristbands: [],
      }],
    };

    expect(
      reconcileCompatibleBeachSetPendingState(base, desiredSetChange, conflictingServer),
    ).toBeNull();
    expect(
      reconcileCompatibleBeachSetPendingState(base, desiredAquaparkChange, base),
    ).toBeNull();
  });
});
