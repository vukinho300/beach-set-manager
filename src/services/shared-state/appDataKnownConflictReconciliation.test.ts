import { describe, expect, it, vi } from 'vitest';
import {
  AQUAPARK_TICKETS,
  createDefaultAppData,
  type AppData,
  type AquaparkEntry,
  type BedId,
  type NonNumberedSunbedSale,
  type Transaction,
} from '../../domain/appData';
import type {
  PendingSharedStateRecord,
  PendingSharedStateStore,
} from './pendingSharedStateStore';
import type {
  LoadSharedLocationStateResult,
  SaveSharedLocationStateResult,
  SharedLocationState,
  SharedLocationStateRepository,
} from './repository';
import {
  isValidAppDataReconciliationSnapshot,
  reconcileKnownRejectedAppDataConflict,
} from './appDataKnownConflictReconciliation';
import { SharedStateController, areSharedStatesEqual } from './sharedStateController';
import type { ClientSyncEvent } from './syncTelemetry';

const LOCATION_ID = '00000000-0000-4000-8000-000000000001';
const USER_ID = 'vito-user-id';
const INCIDENT_TRANSACTION_ID = '3e1ea3a5-8c83-46d0-b7ff-acbd49c867f5';
const NOW = '2026-08-28T10:00:00.000Z';

function clone<T>(value: T): T {
  return structuredClone(value);
}

function baseState(): AppData {
  return createDefaultAppData(new Date('2026-08-28T10:00:00.000Z'));
}

function transaction(
  id: string,
  type: Transaction['type'],
  amount: number,
  resourceId: string,
  resourceLabel: string,
  extra: Partial<Transaction> = {},
): Transaction {
  return { id, type, amount, createdAt: NOW, resourceId, resourceLabel, ...extra };
}

function paySet(state: AppData, setId: number, id: string, amount = 12): AppData {
  const payment = transaction(id, 'beach_set', amount, String(setId), `Set ${setId}`);
  return {
    ...state,
    sets: {
      ...state.sets,
      [setId]: {
        ...state.sets[setId],
        status: 'paid',
        price: amount,
        priceMode: 'fixed',
        dailySaleId: id,
        updatedAt: NOW,
      },
    },
    transactions: [...state.transactions, payment],
  };
}

function payBed(state: AppData, bedId: BedId, id: string, amount = 8): AppData {
  const payment = transaction(id, 'bed', amount, String(bedId), `Bed ${bedId}`);
  return {
    ...state,
    extraBeds: {
      ...state.extraBeds,
      [bedId]: {
        ...state.extraBeds[bedId],
        status: 'paid',
        price: amount,
        priceMode: 'fixed',
        dailySaleId: id,
        updatedAt: NOW,
      },
    },
    transactions: [...state.transactions, payment],
  };
}

function aquaparkEntry(id: string, wristbands: number[]): AquaparkEntry {
  return {
    id,
    wristbands,
    ticketType: '30min',
    defaultUnitPrice: AQUAPARK_TICKETS['30min'].price,
    unitPrice: AQUAPARK_TICKETS['30min'].price,
    totalPrice: AQUAPARK_TICKETS['30min'].price * wristbands.length,
    priceMode: 'default',
    status: 'active',
    startAt: NOW,
    endAt: '2026-08-28T10:30:00.000Z',
    extraMinutes: 0,
    createdAt: NOW,
    returnedWristbands: [],
  };
}

function addAquaparkEntry(state: AppData, entry: AquaparkEntry, transactionId: string): AppData {
  return {
    ...state,
    aquaparkEntries: [entry, ...state.aquaparkEntries],
    transactions: [
      ...state.transactions,
      transaction(
        transactionId,
        'aquapark',
        entry.totalPrice,
        entry.id,
        `Wristbands ${entry.wristbands.join(', ')}`,
        {
          description: AQUAPARK_TICKETS[entry.ticketType].label,
          metadata: {
            ticketType: entry.ticketType,
            wristbandCount: entry.wristbands.length,
            unitPrice: entry.unitPrice,
            customDays: entry.customDays,
          },
        },
      ),
    ],
  };
}

function addSunbedSale(state: AppData, id: string, transactionId: string): AppData {
  const sale: NonNumberedSunbedSale = {
    id,
    quantity: 2,
    totalAmount: 20,
    createdAt: NOW,
  };
  return {
    ...state,
    sunbedSales: [sale, ...state.sunbedSales],
    transactions: [
      ...state.transactions,
      transaction(transactionId, 'sunbed', 20, id, '2 sunbeds', {
        metadata: { quantity: 2 },
      }),
    ],
  };
}

function reconcile(base: AppData, local: AppData, current: AppData, raw: unknown = current) {
  return reconcileKnownRejectedAppDataConflict({
    baseState: base,
    desiredState: local,
    currentState: current,
    rawCurrentState: raw,
  });
}

function expectRejected(result: ReturnType<typeof reconcile>) {
  expect(['conflicting', 'unsupported']).toContain(result.status);
}

function sharedState(state: AppData, revision: number): SharedLocationState<AppData> {
  return {
    locationId: LOCATION_ID,
    state,
    revision,
    updatedAt: NOW,
    updatedBy: 'worker-id',
  };
}

async function flushPromises() {
  for (let index = 0; index < 80; index += 1) {
    await Promise.resolve();
  }
}

describe('known rejected AppData conflict reconciliation', () => {
  it('reproduces Incident 2 and durably rebases Set 13 over Vuk Aquapark work', async () => {
    const base = baseState();
    const existingEntry = aquaparkEntry('aquapark-existing', [8]);
    base.aquaparkEntries = [existingEntry];
    const local = paySet(base, 13, INCIDENT_TRANSACTION_ID);
    const remote = clone(base);
    remote.aquaparkEntries[0].returnedWristbands = [8];
    const events: string[] = [];
    const records: PendingSharedStateRecord<AppData>[] = [];
    let stored: PendingSharedStateRecord<AppData> | null = null;
    const pendingStore: PendingSharedStateStore<AppData> = {
      load: vi.fn(async () => stored),
      save: vi.fn(async (record) => {
        stored = clone(record);
        records.push(clone(record));
        events.push(record.baseRevision === 444 && record.attemptedRevision === undefined
          ? 'pending:rebased'
          : `pending:${record.baseRevision}:${record.attemptedRevision ?? 'none'}`);
      }),
      remove: vi.fn(async () => {
        events.push('pending:removed');
        stored = null;
      }),
    };
    let server = sharedState(base, 443);
    let saveCount = 0;
    const telemetryEvents: ClientSyncEvent[] = [];
    const repository: SharedLocationStateRepository<AppData> = {
      load: vi.fn(async (): Promise<LoadSharedLocationStateResult<AppData>> => ({
        status: 'found',
        value: server,
      })),
      save: vi.fn(async (
        _locationId,
        expectedRevision,
        nextState,
      ): Promise<SaveSharedLocationStateResult<AppData>> => {
        saveCount += 1;
        events.push(`repository:${expectedRevision}`);
        if (saveCount === 1) {
          expect(expectedRevision).toBe(443);
          server = sharedState(remote, 444);
          return { status: 'conflict', current: server };
        }
        expect(expectedRevision).toBe(444);
        expect(events.indexOf('pending:rebased')).toBeLessThan(events.indexOf('repository:444'));
        server = sharedState(nextState, 445);
        return { status: 'accepted', value: server };
      }),
      subscribe: () => () => undefined,
    };
    const controller = new SharedStateController(
      repository,
      LOCATION_ID,
      (value) => isValidAppDataReconciliationSnapshot(value) ? value : null,
      {
        userId: USER_ID,
        pendingStore,
        reconcileKnownRejectedConflict: reconcileKnownRejectedAppDataConflict,
        validateKnownConflictCurrent: isValidAppDataReconciliationSnapshot,
        telemetry: {
          bootSessionId: '00000000-0000-4000-8000-000000000021',
          record: (event) => telemetryEvents.push(event),
        },
      },
    );
    const observedStatuses: string[] = [];
    controller.observe((state) => observedStatuses.push(state.status));

    await controller.reload();
    expect(controller.update(local)).toEqual({ status: 'accepted', kind: 'queued' });
    await flushPromises();

    expect(repository.save).toHaveBeenNthCalledWith(1, LOCATION_ID, 443, local);
    expect(repository.save).toHaveBeenCalledTimes(2);
    const rebasedRecord = records.find((record) =>
      record.baseRevision === 444 && record.attemptedRevision === undefined);
    expect(rebasedRecord).toMatchObject({
      baseRevision: 444,
      baseState: remote,
      automaticRebaseCount: 1,
    });
    expect(rebasedRecord?.attemptedRevision).toBeUndefined();
    expect(rebasedRecord?.attemptedState).toBeUndefined();
    const secondState = vi.mocked(repository.save).mock.calls[1][2];
    expect(secondState.aquaparkEntries[0].returnedWristbands).toEqual([8]);
    expect(secondState.sets[13]).toMatchObject({
      status: 'paid',
      price: 12,
      dailySaleId: INCIDENT_TRANSACTION_ID,
    });
    expect(secondState.transactions.filter(({ id }) => id === INCIDENT_TRANSACTION_ID)).toHaveLength(1);
    expect(secondState.sets[14]).toEqual(remote.sets[14]);
    expect(events.indexOf('repository:444')).toBeLessThan(events.indexOf('pending:removed'));
    const conflictTelemetry = telemetryEvents.findIndex((event) =>
      event.eventCode === 'REPOSITORY_SAVE_RESULT'
      && event.expectedRevision === 443
      && event.errorCategory === 'conflict');
    const rebasedDurabilityStart = telemetryEvents.findIndex((event) =>
      event.eventCode === 'DURABILITY_START'
      && event.expectedRevision === 444
      && event.errorCategory === undefined);
    const rebasedDurabilityConfirmed = telemetryEvents.findIndex((event) =>
      event.eventCode === 'DURABILITY_CONFIRMED'
      && event.expectedRevision === 444
      && event.errorCategory === undefined);
    const retryStart = telemetryEvents.findIndex((event) =>
      event.eventCode === 'REPOSITORY_SAVE_START' && event.expectedRevision === 444);
    expect(conflictTelemetry).toBeGreaterThanOrEqual(0);
    expect(rebasedDurabilityStart).toBeGreaterThan(conflictTelemetry);
    expect(rebasedDurabilityConfirmed).toBeGreaterThan(rebasedDurabilityStart);
    expect(retryStart).toBeGreaterThan(rebasedDurabilityConfirmed);
    expect(stored).toBeNull();
    expect(observedStatuses).not.toContain('conflict');
    expect(controller.getSnapshot()).toMatchObject({
      status: 'ready',
      revision: 445,
      syncStatus: 'saved',
      deviceSafety: 'safe',
      data: secondState,
    });
  });

  it('rejects different changes to the same Set', () => {
    const base = baseState();
    const reservation = {
      id: 'reservation-1', surname: 'Guest', startDate: '2026-08-28', endDate: '2026-08-28',
      createdAt: NOW,
    };
    base.beachReservations = [reservation];
    const local = paySet(base, 13, 'local-payment');
    const remote = clone(base);
    remote.sets[13] = {
      ...remote.sets[13], status: 'reserved', beachReservationId: reservation.id,
      surname: reservation.surname, reservedDays: 1, updatedAt: NOW,
    };

    expect(reconcile(base, local, remote)).toMatchObject({ status: 'conflicting' });
  });

  it('rejects two different payments on the same Set', () => {
    const base = baseState();
    expect(reconcile(
      base,
      paySet(base, 13, 'local-payment'),
      paySet(base, 13, 'remote-payment'),
    )).toMatchObject({ status: 'conflicting' });
  });

  it('rejects different changes to the same Aquapark entry', () => {
    const base = baseState();
    base.aquaparkEntries = [aquaparkEntry('entry-1', [8])];
    const local = clone(base);
    local.aquaparkEntries[0].returnedWristbands = [8];
    const remote = clone(base);
    remote.aquaparkEntries[0].status = 'closed';
    remote.aquaparkEntries[0].closedAt = NOW;

    expect(reconcile(base, local, remote)).toMatchObject({ status: 'conflicting' });
  });

  it('rejects the same transaction ID with divergent payloads', () => {
    const base = baseState();
    expect(reconcile(
      base,
      paySet(base, 13, 'shared-id', 12),
      payBed(base, 2, 'shared-id', 8),
    )).toMatchObject({ status: 'conflicting' });
  });

  it('rejects active-to-deleted transaction changes and never resurrects them', () => {
    const base = baseState();
    base.transactions = [transaction('existing', 'beach_set', 12, '13', 'Set 13')];
    const remote = clone(base);
    remote.transactions[0] = { ...remote.transactions[0], status: 'deleted', deletedAt: NOW };

    expectRejected(reconcile(base, paySet(base, 14, 'local-payment'), remote));
  });

  it('preserves distinct valid local and remote financial bundles exactly once', () => {
    const base = baseState();
    const result = reconcile(
      base,
      paySet(base, 13, 'local-payment'),
      payBed(base, 2, 'remote-payment'),
    );

    expect(result.status).toBe('rebased');
    if (result.status !== 'rebased') return;
    expect(result.state.sets[13].status).toBe('paid');
    expect(result.state.extraBeds[2].status).toBe('paid');
    expect(result.state.transactions.map(({ id }) => id)).toEqual(['remote-payment', 'local-payment']);
  });

  it('recognizes an identical complete payment bundle and keeps one transaction', () => {
    const base = baseState();
    const payment = paySet(base, 13, 'same-payment');
    const result = reconcile(base, payment, clone(payment));

    expect(result.status).toBe('already-present');
    if (result.status !== 'already-present') return;
    expect(result.state.transactions.filter(({ id }) => id === 'same-payment')).toHaveLength(1);
  });

  it('rejects partial Set and Bed payment bundles', () => {
    const base = baseState();
    const localSet = paySet(base, 13, 'set-payment');
    localSet.transactions = [];
    const localBed = payBed(base, 2, 'bed-payment');
    localBed.transactions = [];

    expectRejected(reconcile(base, localSet, base));
    expectRejected(reconcile(base, localBed, base));
  });

  it('rejects duplicate transaction and entity identities before merging', () => {
    const base = baseState();
    const local = paySet(base, 13, 'duplicate');
    local.transactions.push(clone(local.transactions[0]));
    expectRejected(reconcile(base, local, base));

    const duplicateEntries = clone(base);
    const entry = aquaparkEntry('duplicate-entry', [8]);
    duplicateEntries.aquaparkEntries = [entry, clone(entry)];
    expectRejected(reconcile(base, paySet(base, 13, 'safe-local'), duplicateEntries));
  });

  it('rejects reservation, saved-surname, and standalone transaction mutations', () => {
    const base = baseState();
    const reservation = clone(base);
    reservation.beachReservations = [{
      id: 'reservation', surname: 'Guest', startDate: '2026-08-28', endDate: '2026-08-28', createdAt: NOW,
    }];
    const surname = { ...base, savedSurnames: ['Guest'] };
    const standalone = {
      ...base,
      transactions: [...base.transactions, transaction('standalone', 'beach_set', 12, '13', 'Set 13')],
    };

    expectRejected(reconcile(base, reservation, base));
    expectRejected(reconcile(base, surname, base));
    expectRejected(reconcile(base, standalone, base));
  });

  it('rejects transaction deletion, Daily Reset, automatic Reset, Import, and Full Reset shapes', () => {
    const active = paySet(baseState(), 13, 'active-payment');
    const deletion = clone(active);
    deletion.transactions[0] = { ...deletion.transactions[0], status: 'deleted', deletedAt: NOW };
    expectRejected(reconcile(active, deletion, active));

    const dailyReset = baseState();
    dailyReset.reportArchive = [{ date: '2026-08-28', archivedAt: NOW, transactions: [] }];
    expectRejected(reconcile(baseState(), dailyReset, baseState()));

    const automaticReset = { ...baseState(), lastAutomaticResetDate: '2026-08-29' };
    expectRejected(reconcile(baseState(), automaticReset, baseState()));

    const imported = { ...baseState(), savedSurnames: ['Imported'] };
    expectRejected(reconcile(baseState(), imported, baseState()));

    const resetBase = paySet(baseState(), 13, 'reset-payment');
    expectRejected(reconcile(resetBase, baseState(), resetBase));
  });

  it('rejects an Aquapark add that also rewrites an existing entry', () => {
    const base = baseState();
    base.aquaparkEntries = [aquaparkEntry('existing', [8])];
    const local = addAquaparkEntry(base, aquaparkEntry('new-entry', [9]), 'new-transaction');
    local.aquaparkEntries[1] = { ...local.aquaparkEntries[1], returnedWristbands: [8] };

    expectRejected(reconcile(base, local, base));
  });

  it('rejects overlapping Aquapark wristband claims', () => {
    const base = baseState();
    const local = addAquaparkEntry(base, aquaparkEntry('local-entry', [8]), 'local-transaction');
    const remote = addAquaparkEntry(base, aquaparkEntry('remote-entry', [8]), 'remote-transaction');

    expect(reconcile(base, local, remote)).toMatchObject({ status: 'conflicting' });
  });

  it('rejects arbitrary array reorder', () => {
    const base = baseState();
    base.transactions = [
      transaction('first', 'beach_set', 12, '13', 'Set 13'),
      transaction('second', 'bed', 8, '2', 'Bed 2'),
    ];
    const reordered = { ...base, transactions: [...base.transactions].reverse() };

    expectRejected(reconcile(base, reordered, base));
  });

  it('supports the remaining narrow allowlist without recursive merging', () => {
    const base = baseState();
    base.aquaparkEntries = [aquaparkEntry('existing', [8])];
    let local = clone(base);
    local.sets[13] = { ...local.sets[13], status: 'left', updatedAt: NOW };
    local = payBed(local, 2, 'bed-payment');
    local = addSunbedSale(local, 'sunbed-sale', 'sunbed-payment');
    const remote = clone(base);
    remote.aquaparkEntries[0] = {
      ...remote.aquaparkEntries[0], status: 'closed', closedAt: NOW,
    };

    const result = reconcile(base, local, remote);
    expect(result.status).toBe('rebased');
    if (result.status !== 'rebased') return;
    expect(result.state.sets[13].status).toBe('left');
    expect(result.state.extraBeds[2].status).toBe('paid');
    expect(result.state.sunbedSales).toHaveLength(1);
    expect(result.state.aquaparkEntries[0].status).toBe('closed');
    expect(result.state.transactions.map(({ id }) => id)).toEqual(['bed-payment', 'sunbed-payment']);
  });

  it('supports a Bed status change and Aquapark add over a disjoint Set status change', () => {
    const base = baseState();
    const reservation = {
      id: 'reservation-1', surname: 'Guest', startDate: '2026-08-28', endDate: '2026-08-28',
      createdAt: NOW,
    };
    base.beachReservations = [reservation];
    let local = clone(base);
    local.extraBeds[2] = {
      ...local.extraBeds[2],
      status: 'reserved',
      beachReservationId: reservation.id,
      surname: reservation.surname,
      reservedDays: 1,
      updatedAt: NOW,
    };
    local = addAquaparkEntry(local, aquaparkEntry('new-entry', [9]), 'aquapark-payment');
    const remote = clone(base);
    remote.sets[13] = { ...remote.sets[13], status: 'left', updatedAt: NOW };

    const result = reconcile(base, local, remote);
    expect(result.status).toBe('rebased');
    if (result.status !== 'rebased') return;
    expect(result.state.sets[13].status).toBe('left');
    expect(result.state.extraBeds[2]).toMatchObject({
      status: 'reserved', beachReservationId: reservation.id,
    });
    expect(result.state.aquaparkEntries[0].id).toBe('new-entry');
    expect(result.state.transactions.map(({ id }) => id)).toEqual(['aquapark-payment']);
  });

  it('rejects unknown top-level AppData fields', () => {
    const base = baseState();
    const local = { ...paySet(base, 13, 'local-payment'), unknownDomain: { value: 1 } };

    expectRejected(reconcile(base, local, base));
  });

  it('rejects a Daily Reset racing a valid local operation', () => {
    const base = payBed(baseState(), 1, 'earlier-payment');
    const local = paySet(base, 13, 'local-payment');
    const remote = baseState();
    remote.reportArchive = [{
      date: '2026-08-28', archivedAt: NOW, transactions: clone(base.transactions),
    }];

    expectRejected(reconcile(base, local, remote));
  });

  it('rejects a normalized current snapshot whose raw payload contains duplicate IDs', () => {
    const base = baseState();
    const current = payBed(base, 2, 'remote-payment');
    const raw = clone(current);
    raw.transactions.push(clone(raw.transactions[0]));

    expect(isValidAppDataReconciliationSnapshot(raw)).toBe(false);
    expectRejected(reconcile(base, paySet(base, 13, 'local-payment'), current, raw));
  });
});
