import { describe, expect, it } from 'vitest';
import { createDefaultAppData } from '../../domain/appData';
import {
  createPreservedAppDataRecoveryFile,
  findPreservedFinancialActivity,
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

  it('lists device-only activity across sets, beds, sunbeds, and Aquapark', () => {
    const current = createDefaultAppData(new Date('2026-08-27T08:00:00Z'));
    const preserved = structuredClone(current);
    preserved.transactions.push(
      { id: 'set', type: 'beach_set', amount: 12, createdAt: '2026-08-27T09:30:00Z', resourceLabel: 'Set 22' },
      { id: 'bed', type: 'bed', amount: 20, createdAt: '2026-08-27T09:31:00Z', resourceLabel: 'Bed 3' },
      { id: 'sunbed', type: 'sunbed', amount: 16, createdAt: '2026-08-27T09:32:00Z', resourceLabel: '2 sunbeds' },
      { id: 'aquapark', type: 'aquapark', amount: 28, createdAt: '2026-08-27T09:33:00Z', resourceLabel: 'Wristbands 7, 8' },
      { id: 'deleted', type: 'aquapark', amount: 14, createdAt: '2026-08-27T09:34:00Z', status: 'deleted' },
    );

    expect(findPreservedFinancialActivity(preserved, current)).toEqual([
      { transactionId: 'set', type: 'beach_set', label: 'Set 22', amount: 12, createdAt: '2026-08-27T09:30:00Z' },
      { transactionId: 'bed', type: 'bed', label: 'Bed 3', amount: 20, createdAt: '2026-08-27T09:31:00Z' },
      { transactionId: 'sunbed', type: 'sunbed', label: '2 sunbeds', amount: 16, createdAt: '2026-08-27T09:32:00Z' },
      { transactionId: 'aquapark', type: 'aquapark', label: 'Wristbands 7, 8', amount: 28, createdAt: '2026-08-27T09:33:00Z' },
    ]);
  });

  it('does not report activity whose transaction already exists on the server', () => {
    const current = createDefaultAppData(new Date('2026-08-27T08:00:00Z'));
    current.transactions.push({
      id: 'accepted-aquapark',
      type: 'aquapark',
      amount: 28,
      createdAt: '2026-08-27T09:33:00Z',
      resourceLabel: 'Wristbands 7, 8',
    });

    expect(findPreservedFinancialActivity(current, current)).toEqual([]);
  });

  it('creates a location- and revision-labelled recovery file', () => {
    const preserved = createDefaultAppData(new Date('2026-08-27T08:00:00Z'));

    expect(createPreservedAppDataRecoveryFile(
      preserved,
      'b5771919-8ee9-49d5-b7f5-8e634ee1dcbf',
      '00000000-0000-4000-8000-000000000001',
      279,
      '2026-08-27T11:30:00.000Z',
    )).toMatchObject({
      app: 'Beach Set Manager',
      kind: 'preserved-unsaved-app-data',
      version: 2,
      userId: 'b5771919-8ee9-49d5-b7f5-8e634ee1dcbf',
      locationId: '00000000-0000-4000-8000-000000000001',
      serverRevision: 279,
      exportedAt: '2026-08-27T11:30:00.000Z',
      preservedData: preserved,
    });
  });
});
