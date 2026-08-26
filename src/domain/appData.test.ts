import { describe, expect, it, vi } from 'vitest';
import {
  createDefaultAppData,
  type AppData,
  type AquaparkEntry,
  type Transaction,
} from './appData';
import type { SharedLocationStateRepository } from '../services/shared-state/repository';
import {
  areSharedStatesEqual,
  SharedStateController,
} from '../services/shared-state/sharedStateController';
import { createInMemoryPendingSharedStateStore } from '../services/shared-state/pendingSharedStateStore';
import { reconcileCompatibleBeachSetPendingState } from '../services/shared-state/appDataPendingRecovery';
import {
  consumeOperationalSnapshot,
  createOperationalAppDataBridge,
  stageAuthoritativeSnapshot,
} from '../services/shared-state/operationalAppDataBridge';

const LOCATION_ID = '00000000-0000-4000-8000-000000000001';

async function flushPromises() {
  for (let index = 0; index < 30; index += 1) {
    await Promise.resolve();
  }
}

function createDurabilityRepository(initialState: AppData) {
  let serverState = initialState;
  let revision = 5;
  let failSaves = true;
  const save = vi.fn(async (
    locationId: string,
    expectedRevision: number,
    nextState: AppData,
  ) => {
    if (failSaves) {
      return {
        status: 'unavailable' as const,
        error: { message: 'Network unavailable.', retryable: true },
      };
    }

    if (expectedRevision !== revision) {
      return {
        status: 'conflict' as const,
        current: {
          locationId,
          state: serverState,
          revision,
          updatedAt: '2026-08-26T12:00:00.000Z',
        },
      };
    }

    serverState = nextState;
    revision += 1;
    return {
      status: 'accepted' as const,
      value: {
        locationId,
        state: serverState,
        revision,
        updatedAt: '2026-08-26T12:00:00.000Z',
      },
    };
  });
  const repository: SharedLocationStateRepository<AppData> = {
    load: async () => ({
      status: 'found',
      value: {
        locationId: LOCATION_ID,
        state: serverState,
        revision,
        updatedAt: '2026-08-26T11:00:00.000Z',
      },
    }),
    save,
    subscribe: () => () => undefined,
  };

  return {
    repository,
    save,
    allowSaves() {
      failSaves = false;
    },
  };
}

describe('operational AppData boundary', () => {
  it('creates a clean Petalon state with all sets and beds free and no fake activity', () => {
    const state = createDefaultAppData(new Date(2026, 7, 26, 12));

    expect(Object.values(state.sets)).toHaveLength(56);
    expect(Object.values(state.sets).every((set) => set.status === 'free')).toBe(true);
    expect(Object.values(state.extraBeds)).toHaveLength(4);
    expect(Object.values(state.extraBeds).every((bed) => bed.status === 'free')).toBe(true);
    expect(state).toMatchObject({
      beachReservations: [],
      savedSurnames: [],
      sunbedSales: [],
      aquaparkEntries: [],
      transactions: [],
      reportArchive: [],
      lastAutomaticResetDate: '2026-08-26',
    });
  });

  it('saves a full imported AppData snapshot through the normal revision-safe path', async () => {
    const initial = createDefaultAppData(new Date(2026, 7, 26, 12));
    const imported: AppData = { ...initial, savedSurnames: ['Imported Backup'] };
    const save = vi.fn(async (
      locationId: string,
      expectedRevision: number,
      nextState: AppData,
    ) => ({
      status: 'accepted' as const,
      value: {
        locationId,
        state: nextState,
        revision: expectedRevision + 1,
        updatedAt: '2026-08-26T12:00:00.000Z',
      },
    }));
    const repository: SharedLocationStateRepository<AppData> = {
      load: async () => ({
        status: 'found',
        value: {
          locationId: LOCATION_ID,
          state: initial,
          revision: 5,
          updatedAt: '2026-08-26T11:00:00.000Z',
        },
      }),
      save,
      subscribe: () => () => undefined,
    };
    const controller = new SharedStateController(
      repository,
      LOCATION_ID,
      (value) => value as AppData,
      {
        userId: 'test-user',
        pendingStore: createInMemoryPendingSharedStateStore<AppData>(),
      },
    );
    await controller.reload();

    controller.update(imported);
    await flushPromises();

    expect(save).toHaveBeenCalledWith(LOCATION_ID, 5, imported);
    expect(controller.getSnapshot()).toMatchObject({
      status: 'ready',
      revision: 6,
      data: { savedSurnames: ['Imported Backup'] },
    });
  });

  it('durably forwards a worker mutation interleaved with an authoritative snapshot', async () => {
    const initial = createDefaultAppData(new Date(2026, 7, 26, 12));
    const remote: AppData = {
      ...initial,
      sets: {
        ...initial.sets,
        21: { ...initial.sets[21], status: 'reserved', surname: 'Remote' },
      },
    };
    const remoteWithLocalMutation: AppData = {
      ...remote,
      sets: {
        ...remote.sets,
        20: { ...remote.sets[20], status: 'left' },
      },
    };
    const pendingStore = createInMemoryPendingSharedStateStore<AppData>();
    const remoteRepository = createDurabilityRepository(remote);
    const controller = new SharedStateController(
      remoteRepository.repository,
      LOCATION_ID,
      (value) => value as AppData,
      {
        userId: 'mark-user-id',
        pendingStore,
        scheduleRetry: () => () => undefined,
      },
    );
    const bridge = createOperationalAppDataBridge(initial);
    await controller.reload();

    stageAuthoritativeSnapshot(bridge, remote, areSharedStatesEqual);
    if (consumeOperationalSnapshot(
      bridge,
      remoteWithLocalMutation,
      areSharedStatesEqual,
    )) {
      controller.update(remoteWithLocalMutation);
    }
    await flushPromises();

    expect((await pendingStore.load('mark-user-id', LOCATION_ID))?.desiredState)
      .toEqual(remoteWithLocalMutation);
    expect(remoteRepository.save).toHaveBeenCalledWith(
      LOCATION_ID,
      5,
      remoteWithLocalMutation,
    );
  });

  it('recovers one Aquapark entry exactly once after a failed save and app restart', async () => {
    const base = createDefaultAppData(new Date(2026, 7, 26, 12));
    const createdAt = '2026-08-26T12:05:00.000Z';
    const entry: AquaparkEntry = {
      id: 'aquapark-entry-durable-test',
      wristbands: [41, 42],
      ticketType: '30min',
      defaultUnitPrice: 12,
      unitPrice: 12,
      totalPrice: 24,
      priceMode: 'default',
      status: 'active',
      startAt: createdAt,
      endAt: '2026-08-26T12:35:00.000Z',
      extraMinutes: 0,
      createdAt,
      returnedWristbands: [],
    };
    const transaction: Transaction = {
      id: 'transaction-aquapark-durable-test',
      type: 'aquapark',
      amount: 24,
      createdAt,
      resourceId: entry.id,
      resourceLabel: 'Wristbands 41, 42',
    };
    const desired: AppData = {
      ...base,
      aquaparkEntries: [entry],
      transactions: [transaction],
    };
    const pendingStore = createInMemoryPendingSharedStateStore<AppData>();
    const remote = createDurabilityRepository(base);
    const first = new SharedStateController(
      remote.repository,
      LOCATION_ID,
      (value) => value as AppData,
      {
        userId: 'vito-user-id',
        pendingStore,
        scheduleRetry: () => () => undefined,
      },
    );
    await first.reload();
    first.update(desired);
    await flushPromises();
    expect((await pendingStore.load('vito-user-id', LOCATION_ID))?.desiredState)
      .toEqual(desired);
    first.deactivate();

    remote.allowSaves();
    const reopened = new SharedStateController(
      remote.repository,
      LOCATION_ID,
      (value) => value as AppData,
      { userId: 'vito-user-id', pendingStore },
    );
    await reopened.reload();
    await flushPromises();

    expect(reopened.getSnapshot()).toMatchObject({
      status: 'ready',
      revision: 6,
      syncStatus: 'saved',
      data: {
        aquaparkEntries: [{ id: entry.id, wristbands: [41, 42] }],
        transactions: [{ id: transaction.id, resourceId: entry.id }],
      },
    });
    expect(remote.save).toHaveBeenCalledTimes(2);
    expect(await pendingStore.load('vito-user-id', LOCATION_ID)).toBeNull();
  });

  it('recovers a Beach set mutation after restart without duplicating state', async () => {
    const base = createDefaultAppData(new Date(2026, 7, 26, 12));
    const desired: AppData = {
      ...base,
      sets: {
        ...base.sets,
        40: {
          ...base.sets[40],
          status: 'left',
          updatedAt: '2026-08-26T12:10:00.000Z',
        },
      },
    };
    const pendingStore = createInMemoryPendingSharedStateStore<AppData>();
    const remote = createDurabilityRepository(base);
    const first = new SharedStateController(
      remote.repository,
      LOCATION_ID,
      (value) => value as AppData,
      {
        userId: 'vuk-user-id',
        pendingStore,
        scheduleRetry: () => () => undefined,
      },
    );
    await first.reload();
    first.update(desired);
    await flushPromises();
    first.deactivate();

    remote.allowSaves();
    const reopened = new SharedStateController(
      remote.repository,
      LOCATION_ID,
      (value) => value as AppData,
      { userId: 'vuk-user-id', pendingStore },
    );
    await reopened.reload();
    await flushPromises();

    expect(reopened.getSnapshot()).toMatchObject({
      status: 'ready',
      revision: 6,
      data: { sets: { 40: { status: 'left' } } },
    });
    expect(remote.save).toHaveBeenCalledTimes(2);
    expect(await pendingStore.load('vuk-user-id', LOCATION_ID)).toBeNull();
  });

  it('does not resurrect an attempted Beach state after the server later returns to its base value', async () => {
    const base = createDefaultAppData(new Date(2026, 7, 26, 12));
    const desired: AppData = {
      ...base,
      sets: {
        ...base.sets,
        20: { ...base.sets[20], status: 'left' },
      },
    };
    const pendingStore = createInMemoryPendingSharedStateStore<AppData>();
    await pendingStore.save({
      userId: 'vuk-user-id',
      locationId: LOCATION_ID,
      baseRevision: 40,
      baseState: base,
      desiredState: desired,
      attemptedRevision: 40,
      attemptedState: desired,
      createdAt: '2026-08-26T12:00:00.000Z',
      updatedAt: '2026-08-26T12:00:01.000Z',
    });
    const save = vi.fn();
    const repository: SharedLocationStateRepository<AppData> = {
      load: async () => ({
        status: 'found',
        value: {
          locationId: LOCATION_ID,
          state: base,
          revision: 42,
          updatedAt: '2026-08-26T12:02:00.000Z',
        },
      }),
      save,
      subscribe: () => () => undefined,
    };
    const controller = new SharedStateController(
      repository,
      LOCATION_ID,
      (value) => value as AppData,
      {
        userId: 'vuk-user-id',
        pendingStore,
        reconcilePendingState: reconcileCompatibleBeachSetPendingState,
      },
    );

    await controller.reload();

    expect(controller.getSnapshot()).toMatchObject({
      status: 'conflict',
      local: { sets: { 20: { status: 'left' } } },
      current: { revision: 42, state: { sets: { 20: { status: 'free' } } } },
      pendingPreserved: true,
    });
    expect(save).not.toHaveBeenCalled();
    expect(await pendingStore.load('vuk-user-id', LOCATION_ID)).not.toBeNull();
  });

  it('still reconciles an unattempted compatible Beach change over unrelated server set work', async () => {
    const base = createDefaultAppData(new Date(2026, 7, 26, 12));
    const desired: AppData = {
      ...base,
      sets: {
        ...base.sets,
        20: { ...base.sets[20], status: 'left' },
      },
    };
    const server: AppData = {
      ...base,
      sets: {
        ...base.sets,
        21: { ...base.sets[21], status: 'reserved', surname: 'Other' },
      },
    };
    const expectedMerged: AppData = {
      ...server,
      sets: { ...server.sets, 20: desired.sets[20] },
    };
    const pendingStore = createInMemoryPendingSharedStateStore<AppData>();
    await pendingStore.save({
      userId: 'vuk-user-id',
      locationId: LOCATION_ID,
      baseRevision: 40,
      baseState: base,
      desiredState: desired,
      createdAt: '2026-08-26T12:00:00.000Z',
      updatedAt: '2026-08-26T12:00:01.000Z',
    });
    const save = vi.fn(async (
      locationId: string,
      expectedRevision: number,
      nextState: AppData,
    ) => ({
      status: 'accepted' as const,
      value: {
        locationId,
        state: nextState,
        revision: expectedRevision + 1,
        updatedAt: '2026-08-26T12:02:01.000Z',
      },
    }));
    const repository: SharedLocationStateRepository<AppData> = {
      load: async () => ({
        status: 'found',
        value: {
          locationId: LOCATION_ID,
          state: server,
          revision: 41,
          updatedAt: '2026-08-26T12:02:00.000Z',
        },
      }),
      save,
      subscribe: () => () => undefined,
    };
    const controller = new SharedStateController(
      repository,
      LOCATION_ID,
      (value) => value as AppData,
      {
        userId: 'vuk-user-id',
        pendingStore,
        reconcilePendingState: reconcileCompatibleBeachSetPendingState,
      },
    );

    await controller.reload();
    await flushPromises();

    expect(save).toHaveBeenCalledWith(LOCATION_ID, 41, expectedMerged);
    expect(controller.getSnapshot()).toMatchObject({
      status: 'ready',
      revision: 42,
      data: {
        sets: {
          20: { status: 'left' },
          21: { status: 'reserved', surname: 'Other' },
        },
      },
    });
    expect(await pendingStore.load('vuk-user-id', LOCATION_ID)).toBeNull();
  });
});
