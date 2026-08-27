import { describe, expect, it } from 'vitest';
import { createDefaultAppData } from '../../domain/appData';
import {
  createPreservedAppDataRecoveryFile,
  findPreservedPaidSetPayments,
} from './preservedAppDataRecovery';

describe('preserved AppData recovery', () => {
  it('lists paid-set transactions present only in the preserved device state', () => {
    const current = createDefaultAppData(new Date('2026-08-27T08:00:00Z'));
    const preserved = structuredClone(current);
    preserved.transactions.push({
      id: 'transaction-17',
      type: 'beach_set',
      amount: 12,
      createdAt: '2026-08-27T09:12:00Z',
      resourceId: '17',
      resourceLabel: 'Set 17',
    });
    preserved.sets[17] = {
      ...preserved.sets[17],
      status: 'paid',
      price: 12,
      dailySaleId: 'transaction-17',
    };

    expect(findPreservedPaidSetPayments(preserved, current)).toEqual([{
      transactionId: 'transaction-17',
      setId: 17,
      amount: 12,
      createdAt: '2026-08-27T09:12:00Z',
    }]);
  });

  it('does not report an already accepted transaction as missing', () => {
    const current = createDefaultAppData(new Date('2026-08-27T08:00:00Z'));
    current.transactions.push({
      id: 'accepted',
      type: 'beach_set',
      amount: 12,
      createdAt: '2026-08-27T09:12:00Z',
      resourceId: '17',
    });
    current.sets[17] = {
      ...current.sets[17],
      status: 'paid',
      price: 12,
      dailySaleId: 'accepted',
    };

    expect(findPreservedPaidSetPayments(current, current)).toEqual([]);
  });

  it('creates a location- and revision-labelled recovery file', () => {
    const preserved = createDefaultAppData(new Date('2026-08-27T08:00:00Z'));

    expect(createPreservedAppDataRecoveryFile(
      preserved,
      '00000000-0000-4000-8000-000000000001',
      279,
      '2026-08-27T11:30:00.000Z',
    )).toMatchObject({
      app: 'Beach Set Manager',
      kind: 'preserved-unsaved-app-data',
      version: 1,
      locationId: '00000000-0000-4000-8000-000000000001',
      serverRevision: 279,
      exportedAt: '2026-08-27T11:30:00.000Z',
      preservedData: preserved,
    });
  });
});
