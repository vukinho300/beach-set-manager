import { describe, expect, it, vi } from 'vitest';
import {
  AQUAPARK_TICKETS,
  createDefaultAppData,
  type AppData,
  type AquaparkEntry,
  type BeachReservation,
  type NonNumberedSunbedSale,
  type Transaction,
} from '../../domain/appData';
import {
  isValidAppDataReconciliationSnapshot,
  reconcileKnownRejectedAppDataConflict,
} from './appDataKnownConflictReconciliation';
import { isMonotonicAppDataRevisionChain } from './appDataRevisionChainProof';
import { createInMemoryPendingSharedStateStore } from './pendingSharedStateStore';
import type {
  SaveSharedLocationStateResult,
  SharedLocationState,
  SharedLocationStateRepository,
} from './repository';
import { SharedStateController, areSharedStatesEqual } from './sharedStateController';

const LOCATION_ID = '00000000-0000-4000-8000-000000000001';
const NOW = '2026-08-29T12:30:00.000Z';

type Side = 'a' | 'b';
type OperationFamily = {
  name: string;
  apply(state: AppData, side: Side): AppData;
};

function clone<T>(value: T): T {
  return structuredClone(value);
}

function reservation(id: string): BeachReservation {
  return {
    id,
    surname: `Guest ${id}`,
    startDate: '2026-08-29',
    endDate: '2026-08-29',
    createdAt: NOW,
  };
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
    endAt: '2026-08-29T13:10:00.000Z',
    extraMinutes: 0,
    createdAt: NOW,
    returnedWristbands: [],
  };
}

function baseState(): AppData {
  const state = createDefaultAppData(new Date(NOW));
  state.beachReservations = [reservation('bed-reservation-a'), reservation('bed-reservation-b')];
  state.aquaparkEntries = [
    aquaparkEntry('return-entry-a', [1, 2]),
    aquaparkEntry('return-entry-b', [3, 4]),
    aquaparkEntry('close-entry-a', [5, 6]),
    aquaparkEntry('close-entry-b', [7, 8]),
  ];
  return state;
}

const operationFamilies: OperationFamily[] = [
  {
    name: 'numbered-set-status',
    apply(state, side) {
      const next = clone(state);
      const id = side === 'a' ? 1 : 2;
      next.sets[id] = { ...next.sets[id], status: 'left', updatedAt: `${NOW}-${side}` };
      return next;
    },
  },
  {
    name: 'numbered-set-payment',
    apply(state, side) {
      const next = clone(state);
      const id = side === 'a' ? 11 : 12;
      const transactionId = `set-payment-${side}`;
      next.sets[id] = {
        ...next.sets[id],
        status: 'paid',
        price: 12,
        priceMode: 'fixed',
        dailySaleId: transactionId,
        updatedAt: `${NOW}-${side}`,
      };
      next.transactions.push(transaction(
        transactionId,
        'beach_set',
        12,
        String(id),
        `Set ${id}`,
      ));
      return next;
    },
  },
  {
    name: 'extra-bed-status',
    apply(state, side) {
      const next = clone(state);
      const id = side === 'a' ? 1 : 2;
      const linked = next.beachReservations.find(({ id: reservationId }) =>
        reservationId === `bed-reservation-${side}`)!;
      next.extraBeds[id] = {
        ...next.extraBeds[id],
        status: 'reserved',
        beachReservationId: linked.id,
        surname: linked.surname,
        reservedDays: 1,
        updatedAt: `${NOW}-${side}`,
      };
      return next;
    },
  },
  {
    name: 'extra-bed-payment',
    apply(state, side) {
      const next = clone(state);
      const id = side === 'a' ? 3 : 4;
      const transactionId = `bed-payment-${side}`;
      next.extraBeds[id] = {
        ...next.extraBeds[id],
        status: 'paid',
        price: 8,
        priceMode: 'fixed',
        dailySaleId: transactionId,
        updatedAt: `${NOW}-${side}`,
      };
      next.transactions.push(transaction(transactionId, 'bed', 8, String(id), `Bed ${id}`));
      return next;
    },
  },
  {
    name: 'sunbed-add',
    apply(state, side) {
      const next = clone(state);
      const id = `sunbed-sale-${side}`;
      const sale: NonNumberedSunbedSale = {
        id,
        quantity: 2,
        totalAmount: 20,
        createdAt: NOW,
      };
      next.sunbedSales.unshift(sale);
      next.transactions.push(transaction(`sunbed-payment-${side}`, 'sunbed', 20, id, '2 sunbeds', {
        metadata: { quantity: 2 },
      }));
      return next;
    },
  },
  {
    name: 'aquapark-add',
    apply(state, side) {
      const next = clone(state);
      const entry = aquaparkEntry(`aquapark-add-${side}`, [side === 'a' ? 101 : 102]);
      next.aquaparkEntries.unshift(entry);
      next.transactions.push(transaction(
        `aquapark-payment-${side}`,
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
      ));
      return next;
    },
  },
  {
    name: 'aquapark-return',
    apply(state, side) {
      const next = clone(state);
      const id = `return-entry-${side}`;
      next.aquaparkEntries = next.aquaparkEntries.map((entry) => entry.id === id
        ? { ...entry, returnedWristbands: [entry.wristbands[0]] }
        : entry);
      return next;
    },
  },
  {
    name: 'aquapark-close',
    apply(state, side) {
      const next = clone(state);
      const id = `close-entry-${side}`;
      next.aquaparkEntries = next.aquaparkEntries.map((entry) => entry.id === id
        ? { ...entry, status: 'closed', closedAt: `${NOW}-${side}` }
        : entry);
      return next;
    },
  },
];

function sharedState(state: AppData, revision: number, updatedBy = 'server'): SharedLocationState<AppData> {
  return {
    locationId: LOCATION_ID,
    state: clone(state),
    revision,
    updatedAt: `${NOW}-${revision}`,
    updatedBy,
  };
}

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((resolvePromise) => { resolve = resolvePromise; });
  return { promise, resolve };
}

async function settleUntil(condition: () => boolean, message: string) {
  for (let index = 0; index < 500; index += 1) {
    if (condition()) return;
    await Promise.resolve();
  }
  throw new Error(`Timed out waiting for ${message}.`);
}

class CasServer {
  current: SharedLocationState<AppData>;
  readonly history = new Map<number, AppData>();
  readonly calls: Array<{ device: string; expectedRevision: number; state: AppData }> = [];

  constructor(state: AppData, revision = 100) {
    this.current = sharedState(state, revision);
    this.history.set(revision, clone(state));
  }

  repository(device: string, holdFirstSave?: Promise<void>): SharedLocationStateRepository<AppData> {
    let held = false;
    return {
      load: vi.fn(async () => ({ status: 'found' as const, value: clone(this.current) })),
      save: vi.fn(async (_locationId, expectedRevision, nextState) => {
        this.calls.push({ device, expectedRevision, state: clone(nextState) });
        if (holdFirstSave && !held) {
          held = true;
          await holdFirstSave;
        }
        return this.save(device, expectedRevision, nextState);
      }),
      subscribe: () => () => undefined,
    };
  }

  private save(
    device: string,
    expectedRevision: number,
    nextState: AppData,
  ): SaveSharedLocationStateResult<AppData> {
    if (expectedRevision === this.current.revision) {
      this.current = sharedState(nextState, expectedRevision + 1, device);
      this.history.set(this.current.revision, clone(nextState));
      return { status: 'accepted', value: clone(this.current) };
    }
    const states: AppData[] = [];
    for (let revision = expectedRevision; revision <= this.current.revision; revision += 1) {
      const state = this.history.get(revision);
      if (!state) {
        return { status: 'conflict', current: clone(this.current) };
      }
      states.push(state);
    }
    return {
      status: 'conflict',
      current: clone(this.current),
      ...(states.length > 2 && isMonotonicAppDataRevisionChain(states)
        ? { revisionChainVerified: true }
        : {}),
    };
  }
}

function controller(
  repository: SharedLocationStateRepository<AppData>,
  userId: string,
) {
  const pendingStore = createInMemoryPendingSharedStateStore<AppData>();
  const value = new SharedStateController(
    repository,
    LOCATION_ID,
    (candidate) => isValidAppDataReconciliationSnapshot(candidate) ? candidate : null,
    {
      userId,
      pendingStore,
      reconcileKnownRejectedConflict: reconcileKnownRejectedAppDataConflict,
      validateKnownConflictCurrent: isValidAppDataReconciliationSnapshot,
      retryDelaysMs: [60_000],
    },
  );
  return { controller: value, pendingStore };
}

function family(name: string): OperationFamily {
  const result = operationFamilies.find((candidate) => candidate.name === name);
  if (!result) throw new Error(`Unknown operation family: ${name}`);
  return result;
}

function paySetAt(state: AppData, setId: number, transactionId: string, amount = 12): AppData {
  const next = clone(state);
  next.sets[setId] = {
    ...next.sets[setId],
    status: 'paid',
    price: amount,
    priceMode: 'fixed',
    dailySaleId: transactionId,
    updatedAt: NOW,
  };
  next.transactions.push(transaction(
    transactionId,
    'beach_set',
    amount,
    String(setId),
    `Set ${setId}`,
  ));
  return next;
}

function payBedAt(state: AppData, bedId: 1 | 2 | 3 | 4, transactionId: string): AppData {
  const next = clone(state);
  next.extraBeds[bedId] = {
    ...next.extraBeds[bedId],
    status: 'paid',
    price: 8,
    priceMode: 'fixed',
    dailySaleId: transactionId,
    updatedAt: NOW,
  };
  next.transactions.push(transaction(transactionId, 'bed', 8, String(bedId), `Bed ${bedId}`));
  return next;
}

function addAquaparkAt(state: AppData, id: string, wristband: number, transactionId: string): AppData {
  const next = clone(state);
  const entry = aquaparkEntry(id, [wristband]);
  next.aquaparkEntries.unshift(entry);
  next.transactions.push(transaction(
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
  ));
  return next;
}

async function runRace(localFamily: OperationFamily, remoteFamily: OperationFamily) {
  const base = baseState();
  const gate = deferred();
  const server = new CasServer(base);
  const local = controller(server.repository('local', gate.promise), 'local-user');
  const remote = controller(server.repository('remote'), 'remote-user');
  const statuses: string[] = [];
  local.controller.observe((state) => statuses.push(state.status));
  await Promise.all([local.controller.reload(), remote.controller.reload()]);

  const localDesired = localFamily.apply(base, 'a');
  const remoteDesired = remoteFamily.apply(base, 'b');
  expect(local.controller.update(localDesired)).toMatchObject({ status: 'accepted' });
  await settleUntil(
    () => server.calls.some(({ device }) => device === 'local'),
    'held local save',
  );
  expect(remote.controller.update(remoteDesired)).toMatchObject({ status: 'accepted' });
  await settleUntil(() => server.current.revision === 101, 'remote winner');
  gate.resolve();
  await settleUntil(() => server.current.revision === 102, 'local durable rebase retry');

  return { base, server, local, remoteDesired, localDesired, statuses };
}

async function runConflictRace(
  base: AppData,
  localDesired: AppData,
  remoteDesired: AppData,
) {
  const gate = deferred();
  const server = new CasServer(base);
  const local = controller(server.repository('local', gate.promise), 'local-user');
  const remote = controller(server.repository('remote'), 'remote-user');
  await Promise.all([local.controller.reload(), remote.controller.reload()]);
  local.controller.update(localDesired);
  await settleUntil(() => server.calls.some(({ device }) => device === 'local'), 'held local save');
  remote.controller.update(remoteDesired);
  await settleUntil(() => server.current.revision === 101, 'remote winner');
  gate.resolve();
  await settleUntil(() => {
    const status = local.controller.getSnapshot().status;
    return status === 'conflict' || status === 'unavailable';
  }, 'fail-closed loser');
  return { server, local };
}

const orderedPairings = operationFamilies.flatMap((localFamily) =>
  operationFamilies.map((remoteFamily) => ({ localFamily, remoteFamily })));

describe('two-controller simultaneous supported-operation matrix', () => {
  it.each(orderedPairings)(
    '$localFamily.name loser + $remoteFamily.name winner preserves both',
    async ({ localFamily, remoteFamily }) => {
      const result = await runRace(localFamily, remoteFamily);
      const expected = reconcileKnownRejectedAppDataConflict({
        baseState: result.base,
        desiredState: result.localDesired,
        currentState: result.remoteDesired,
        rawCurrentState: result.remoteDesired,
      });
      expect(expected.status).toBe('rebased');
      if (expected.status !== 'rebased') return;

      expect(result.server.current.state).toEqual(expected.state);
      expect(new Set(result.server.current.state.transactions.map(({ id }) => id)).size)
        .toBe(result.server.current.state.transactions.length);
      await expect(result.local.pendingStore.load('local-user', LOCATION_ID)).resolves.toBeNull();
      expect(result.statuses).not.toContain('conflict');
      expect(result.local.controller.getSnapshot()).toMatchObject({
        status: 'ready',
        revision: 102,
        syncStatus: 'saved',
        deviceSafety: 'safe',
      });
    },
  );
});

async function runMultiRevisionRace(
  localFamily: OperationFamily,
  remoteSteps: Array<(state: AppData) => AppData>,
) {
  const base = baseState();
  const gate = deferred();
  const server = new CasServer(base, 521);
  const local = controller(server.repository('local', gate.promise), 'local-user');
  const remote = controller(server.repository('remote'), 'remote-user');
  const statuses: string[] = [];
  local.controller.observe((state) => statuses.push(state.status));
  await Promise.all([local.controller.reload(), remote.controller.reload()]);
  const localDesired = localFamily.apply(base, 'a');
  local.controller.update(localDesired);
  await settleUntil(() => server.calls.some(({ device }) => device === 'local'), 'held local save');

  for (const applyStep of remoteSteps) {
    const snapshot = remote.controller.getSnapshot();
    expect(snapshot.status).toBe('ready');
    if (snapshot.status !== 'ready') throw new Error('Remote controller is not ready.');
    remote.controller.update(applyStep(snapshot.data));
    const targetRevision = server.current.revision + 1;
    await settleUntil(() => server.current.revision === targetRevision, `remote revision ${targetRevision}`);
  }
  const remoteFinal = clone(server.current.state);
  const remoteRevision = server.current.revision;
  gate.resolve();
  await settleUntil(
    () => server.current.revision === remoteRevision + 1,
    'multi-revision local rebase retry',
  );
  return { base, localDesired, local, remoteFinal, server, statuses };
}

describe('multi-revision two-controller proof', () => {
  it('reproduces Incident 3 revision 521 -> 522 -> 523 and accepts both intentions at 524', async () => {
    const close = operationFamilies.find(({ name }) => name === 'aquapark-close')!;
    const result = await runMultiRevisionRace(close, [
      (state) => {
        const next = clone(state);
        next.sets[53] = {
          ...next.sets[53],
          updatedAt: '2026-08-29T12:30:34.605Z',
        };
        return next;
      },
      (state) => {
        const next = clone(state);
        next.sets[53] = {
          ...next.sets[53],
          status: 'left',
          updatedAt: '2026-08-29T12:30:40.404Z',
        };
        return next;
      },
    ]);

    expect(result.server.current.revision).toBe(524);
    expect(result.server.current.state.sets[53]).toMatchObject({ status: 'left' });
    expect(result.server.current.state.aquaparkEntries.find(({ id }) => id === 'close-entry-a'))
      .toMatchObject({ status: 'closed' });
    expect(result.statuses).not.toContain('conflict');
  });

  it.each([
    {
      name: 'two remote Set payments vs local Aquapark close',
      local: 'aquapark-close',
      remote: ['numbered-set-payment', 'numbered-set-payment'],
    },
    {
      name: 'remote Sunbed and Set payment vs local Bed payment',
      local: 'extra-bed-payment',
      remote: ['sunbed-add', 'numbered-set-payment'],
    },
    {
      name: 'three disjoint remote operations vs local Aquapark return',
      local: 'aquapark-return',
      remote: ['numbered-set-payment', 'extra-bed-payment', 'sunbed-add'],
    },
  ])('$name', async ({ local: localName, remote: remoteNames }) => {
    const localFamily = operationFamilies.find(({ name }) => name === localName)!;
    const steps = remoteNames.map((name, index) => {
      const family = operationFamilies.find(({ name: candidate }) => candidate === name)!;
      return (state: AppData) => family.apply(state, index % 2 === 0 ? 'b' : 'a');
    });
    const result = await runMultiRevisionRace(localFamily, steps);
    const expected = reconcileKnownRejectedAppDataConflict({
      baseState: result.base,
      desiredState: result.localDesired,
      currentState: result.remoteFinal,
      rawCurrentState: result.remoteFinal,
    });
    expect(expected.status).toBe('rebased');
    if (expected.status !== 'rebased') return;
    expect(result.server.current.state).toEqual(expected.state);
    expect(result.statuses).not.toContain('conflict');
  });

  it('conservatively conflicts when a final multi-revision Aquapark delta mixes add and update', async () => {
    const base = baseState();
    const gate = deferred();
    const server = new CasServer(base, 521);
    const local = controller(server.repository('local', gate.promise), 'local-user');
    const remote = controller(server.repository('remote'), 'remote-user');
    await Promise.all([local.controller.reload(), remote.controller.reload()]);
    const localFamily = operationFamilies.find(({ name }) => name === 'numbered-set-payment')!;
    local.controller.update(localFamily.apply(base, 'a'));
    await settleUntil(() => server.calls.some(({ device }) => device === 'local'), 'held local save');

    const add = operationFamilies.find(({ name }) => name === 'aquapark-add')!;
    remote.controller.update(add.apply(base, 'b'));
    await settleUntil(() => server.current.revision === 522, 'Aquapark add');
    const close = operationFamilies.find(({ name }) => name === 'aquapark-close')!;
    const remoteReady = remote.controller.getSnapshot();
    expect(remoteReady.status).toBe('ready');
    if (remoteReady.status !== 'ready') throw new Error('Remote controller is not ready.');
    remote.controller.update(close.apply(remoteReady.data, 'b'));
    await settleUntil(() => server.current.revision === 523, 'Aquapark close');
    gate.resolve();
    await settleUntil(() => local.controller.getSnapshot().status === 'conflict', 'preserved conflict');

    expect(server.current.revision).toBe(523);
    expect(server.calls.filter(({ device }) => device === 'local')).toHaveLength(1);
    expect(local.controller.getSnapshot()).toMatchObject({ status: 'conflict', pendingPreserved: true });
  });

  it('rejects a hidden touch-and-restore chain even when the final delta is disjoint', async () => {
    const localFamily = operationFamilies.find(({ name }) => name === 'aquapark-close')!;
    const base = baseState();
    const gate = deferred();
    const server = new CasServer(base, 521);
    const local = controller(server.repository('local', gate.promise), 'local-user');
    const remote = controller(server.repository('remote'), 'remote-user');
    await Promise.all([local.controller.reload(), remote.controller.reload()]);
    local.controller.update(localFamily.apply(base, 'a'));
    await settleUntil(() => server.calls.some(({ device }) => device === 'local'), 'held local save');

    const touched = clone(base);
    touched.sets[53] = { ...touched.sets[53], status: 'left', updatedAt: NOW };
    remote.controller.update(touched);
    await settleUntil(() => server.current.revision === 522, 'transient touch');
    const restoredWithOtherChange = clone(base);
    restoredWithOtherChange.sets[54] = {
      ...restoredWithOtherChange.sets[54],
      status: 'left',
      updatedAt: NOW,
    };
    remote.controller.update(restoredWithOtherChange);
    await settleUntil(() => server.current.revision === 523, 'touch restore');
    gate.resolve();
    await settleUntil(() => local.controller.getSnapshot().status === 'conflict', 'preserved conflict');

    expect(server.current.revision).toBe(523);
    expect(server.calls.filter(({ device }) => device === 'local')).toHaveLength(1);
    expect(local.controller.getSnapshot()).toMatchObject({ status: 'conflict', pendingPreserved: true });
  });
});

type NegativeCase = {
  name: string;
  create(): { base: AppData; local: AppData; remote: AppData; expectedStatus?: 'conflict' | 'unavailable' };
};

const negativeCases: NegativeCase[] = [
  {
    name: 'same Set changed differently',
    create() {
      const base = baseState();
      const local = clone(base);
      local.sets[1] = { ...local.sets[1], status: 'left', updatedAt: NOW };
      const remote = clone(base);
      remote.sets[1] = {
        ...remote.sets[1],
        status: 'reserved',
        beachReservationId: 'bed-reservation-b',
        surname: 'Guest bed-reservation-b',
        reservedDays: 1,
        updatedAt: NOW,
      };
      return { base, local, remote };
    },
  },
  {
    name: 'same Set receives two different payments',
    create() {
      const base = baseState();
      return { base, local: paySetAt(base, 13, 'local-payment'), remote: paySetAt(base, 13, 'remote-payment') };
    },
  },
  {
    name: 'same Bed changed differently',
    create() {
      const base = baseState();
      const local = clone(base);
      local.extraBeds[1] = {
        ...local.extraBeds[1], status: 'reserved', beachReservationId: 'bed-reservation-a',
        surname: 'Guest bed-reservation-a', reservedDays: 1, updatedAt: NOW,
      };
      const remote = clone(base);
      remote.extraBeds[1] = {
        ...remote.extraBeds[1], status: 'reserved', beachReservationId: 'bed-reservation-b',
        surname: 'Guest bed-reservation-b', reservedDays: 1, updatedAt: NOW,
      };
      return { base, local, remote };
    },
  },
  {
    name: 'same Aquapark entry changed differently',
    create() {
      const base = baseState();
      const local = clone(base);
      local.aquaparkEntries[0] = { ...local.aquaparkEntries[0], returnedWristbands: [1] };
      const remote = clone(base);
      remote.aquaparkEntries[0] = { ...remote.aquaparkEntries[0], status: 'closed', closedAt: NOW };
      return { base, local, remote };
    },
  },
  {
    name: 'overlapping active wristband claims',
    create() {
      const base = baseState();
      return {
        base,
        local: addAquaparkAt(base, 'local-aqua', 110, 'local-aqua-payment'),
        remote: addAquaparkAt(base, 'remote-aqua', 110, 'remote-aqua-payment'),
      };
    },
  },
  {
    name: 'same transaction ID has divergent payload',
    create() {
      const base = baseState();
      return { base, local: paySetAt(base, 13, 'shared-id'), remote: payBedAt(base, 3, 'shared-id') };
    },
  },
  {
    name: 'active transaction conflicts with deleted transaction',
    create() {
      const base = baseState();
      const local = paySetAt(base, 13, 'shared-active-deleted');
      const remote = payBedAt(base, 3, 'shared-active-deleted');
      remote.transactions[0] = { ...remote.transactions[0], status: 'deleted', deletedAt: NOW };
      return { base, local, remote };
    },
  },
  {
    name: 'partial Set payment bundle',
    create() {
      const base = baseState();
      const local = clone(base);
      local.sets[13] = {
        ...local.sets[13], status: 'paid', price: 12, priceMode: 'fixed',
        dailySaleId: 'missing-transaction', updatedAt: NOW,
      };
      return { base, local, remote: family('aquapark-close').apply(base, 'b') };
    },
  },
  {
    name: 'reservation mutation',
    create() {
      const base = baseState();
      const local = clone(base);
      local.beachReservations.push(reservation('unsupported-new-reservation'));
      return { base, local, remote: family('numbered-set-status').apply(base, 'b') };
    },
  },
  {
    name: 'existing Sunbed edit',
    create() {
      const base = family('sunbed-add').apply(baseState(), 'a');
      const local = clone(base);
      local.sunbedSales[0] = { ...local.sunbedSales[0], quantity: 3 };
      return { base, local, remote: family('numbered-set-status').apply(base, 'b') };
    },
  },
  {
    name: 'transaction deletion',
    create() {
      const base = paySetAt(baseState(), 13, 'existing-transaction');
      const local = clone(base);
      local.transactions[0] = { ...local.transactions[0], status: 'deleted', deletedAt: NOW };
      return { base, local, remote: family('aquapark-close').apply(base, 'b') };
    },
  },
  {
    name: 'Daily Reset mutation',
    create() {
      const base = baseState();
      const local = clone(base);
      local.reportArchive = [{ date: '2026-08-29', archivedAt: NOW, transactions: [] }];
      return { base, local, remote: family('numbered-set-status').apply(base, 'b') };
    },
  },
  {
    name: 'automatic Reset mutation',
    create() {
      const base = baseState();
      const local = clone(base);
      local.lastAutomaticResetDate = '2026-08-30';
      return { base, local, remote: family('extra-bed-payment').apply(base, 'b') };
    },
  },
  {
    name: 'Import Backup replacement',
    create() {
      const base = baseState();
      return {
        base,
        local: createDefaultAppData(new Date('2026-08-30T08:00:00.000Z')),
        remote: family('aquapark-return').apply(base, 'b'),
      };
    },
  },
  {
    name: 'Full Reset replacement',
    create() {
      const base = paySetAt(baseState(), 13, 'existing-payment');
      return {
        base,
        local: createDefaultAppData(new Date('2026-08-29T18:00:00.000Z')),
        remote: family('aquapark-close').apply(base, 'b'),
      };
    },
  },
  {
    name: 'malformed duplicate identity',
    create() {
      const base = baseState();
      const local = clone(base);
      local.aquaparkEntries.push(clone(local.aquaparkEntries[0]));
      return { base, local, remote: family('numbered-set-status').apply(base, 'b') };
    },
  },
  {
    name: 'malformed current authoritative identity',
    create() {
      const base = baseState();
      const remote = clone(base);
      remote.aquaparkEntries.push(clone(remote.aquaparkEntries[0]));
      return {
        base,
        local: family('numbered-set-status').apply(base, 'a'),
        remote,
        expectedStatus: 'unavailable',
      };
    },
  },
];

describe('two-controller incompatible-operation matrix', () => {
  it.each(negativeCases)('$name remains preserved and never overwrites the winner', async ({ create }) => {
    const { base, local, remote, expectedStatus = 'conflict' } = create();
    const result = await runConflictRace(base, local, remote);

    expect(result.server.current.revision).toBe(101);
    expect(result.server.current.state).toEqual(remote);
    expect(result.server.calls.filter(({ device }) => device === 'local')).toHaveLength(1);
    expect(result.local.controller.getSnapshot()).toMatchObject({
      status: expectedStatus,
      pendingPreserved: true,
    });
    await expect(result.local.pendingStore.load('local-user', LOCATION_ID)).resolves.not.toBeNull();
  });
});
