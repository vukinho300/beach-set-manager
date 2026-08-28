import { describe, expect, it, vi } from 'vitest';
import type {
  LoadSharedLocationStateResult,
  SaveSharedLocationStateResult,
  SharedLocationState,
  SharedLocationStateListener,
  SharedLocationStateRepository,
} from './repository';
import type {
  PendingSharedStateRecord,
  PendingSharedStateStore,
} from './pendingSharedStateStore';
import {
  createInMemoryPendingSharedStateStore,
  createMirroredPendingSharedStateStore,
} from './pendingSharedStateStore';
import {
  SharedStateController,
  type SharedStateControllerOptions,
} from './sharedStateController';

type TestData = { marker: string; value: number };

const LOCATION_ID = '00000000-0000-4000-8000-000000000001';

function sharedState(
  state: TestData,
  revision: number,
): SharedLocationState<TestData> {
  return {
    locationId: LOCATION_ID,
    state,
    revision,
    updatedAt: `2026-08-26T00:00:0${revision}.000Z`,
    updatedBy: 'user-id',
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

class FakeRepository implements SharedLocationStateRepository<TestData> {
  loadHandler: () => Promise<LoadSharedLocationStateResult<TestData>> = async () => ({
    status: 'found',
    value: sharedState({ marker: 'server', value: 1 }, 4),
  });
  saveHandler: (
    locationId: string,
    expectedRevision: number,
    nextState: TestData,
  ) => Promise<SaveSharedLocationStateResult<TestData>> = async (
    _locationId,
    expectedRevision,
    nextState,
  ) => ({
    status: 'accepted',
    value: sharedState(nextState, expectedRevision + 1),
  });

  readonly load = vi.fn((_locationId: string) => this.loadHandler());
  readonly save = vi.fn(
    (locationId: string, expectedRevision: number, nextState: TestData) =>
      this.saveHandler(locationId, expectedRevision, nextState),
  );
  readonly subscriptions: Array<{
    locationId: string;
    listener: SharedLocationStateListener;
    active: boolean;
    unsubscribe: ReturnType<typeof vi.fn>;
  }> = [];
  readonly subscribe = vi.fn(
    (locationId: string, listener: SharedLocationStateListener) => {
      const subscription = {
        locationId,
        listener,
        active: true,
        unsubscribe: vi.fn(),
      };
      subscription.unsubscribe.mockImplementation(() => {
        subscription.active = false;
      });
      this.subscriptions.push(subscription);
      return subscription.unsubscribe;
    },
  );

  emitRevision(revision: number, subscriptionIndex = this.subscriptions.length - 1) {
    const subscription = this.subscriptions[subscriptionIndex];
    if (subscription?.active) {
      subscription.listener({ locationId: LOCATION_ID, revision });
    }
  }

  emitSubscribed(subscriptionIndex = this.subscriptions.length - 1) {
    const subscription = this.subscriptions[subscriptionIndex];
    if (subscription?.active) {
      subscription.listener({ locationId: LOCATION_ID });
    }
  }

  emitStaleCallback(revision: number, subscriptionIndex: number) {
    this.subscriptions[subscriptionIndex]?.listener({
      locationId: LOCATION_ID,
      revision,
    });
  }
}

class FakePendingStore<T> implements PendingSharedStateStore<T> {
  readonly records = new Map<string, PendingSharedStateRecord<T>>();
  readonly load = vi.fn(async (userId: string, locationId: string) =>
    this.records.get(`${userId}:${locationId}`) ?? null,
  );
  readonly save = vi.fn(async (record: PendingSharedStateRecord<T>) => {
    this.records.set(`${record.userId}:${record.locationId}`, record);
  });
  readonly remove = vi.fn(async (userId: string, locationId: string) => {
    this.records.delete(`${userId}:${locationId}`);
  });
}

function normalize(value: unknown): TestData | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const candidate = value as Partial<TestData>;
  return typeof candidate.marker === 'string' && typeof candidate.value === 'number'
    ? { marker: candidate.marker, value: candidate.value }
    : null;
}

function createController(
  repository = new FakeRepository(),
  options: Partial<SharedStateControllerOptions<TestData>> = {},
) {
  const pendingStore = options.pendingStore ?? new FakePendingStore<TestData>();
  return {
    repository,
    pendingStore,
    controller: new SharedStateController(repository, LOCATION_ID, normalize, {
      userId: 'user-a',
      pendingStore,
      retryDelaysMs: [60_000],
      ...options,
    }),
  };
}

async function flushPromises() {
  for (let index = 0; index < 30; index += 1) {
    await Promise.resolve();
  }
}

describe('SharedStateController', () => {
  it('waits for the server load before exposing editable operational data', async () => {
    const { repository, controller } = createController();
    const load = deferred<LoadSharedLocationStateResult<TestData>>();
    repository.loadHandler = () => load.promise;

    const request = controller.reload();
    expect(controller.getSnapshot()).toEqual({ status: 'loading' });

    load.resolve({
      status: 'found',
      value: sharedState({ marker: 'server', value: 2 }, 7),
    });
    await request;

    expect(controller.getSnapshot()).toMatchObject({
      status: 'ready',
      data: { marker: 'server', value: 2 },
      revision: 7,
      syncStatus: 'saved',
    });
  });

  it('uses found server data and ignores a conflicting legacy localStorage value', async () => {
    const { controller } = createController();
    const legacyStorage = {
      getItem: vi.fn(() => JSON.stringify({ marker: 'legacy-browser', value: 99 })),
    };
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: legacyStorage,
    });

    try {
      await controller.reload();
      expect(controller.getSnapshot()).toMatchObject({
        status: 'ready',
        data: { marker: 'server', value: 1 },
      });
      expect(legacyStorage.getItem).not.toHaveBeenCalled();
    } finally {
      Reflect.deleteProperty(globalThis, 'localStorage');
    }
  });

  it('does not save merely because the server snapshot was mounted', async () => {
    const { repository, controller } = createController();
    await controller.reload();

    controller.update({ value: 1, marker: 'server' });
    await flushPromises();

    expect(repository.save).not.toHaveBeenCalled();
    expect(controller.getSnapshot()).toMatchObject({
      status: 'ready',
      revision: 4,
      syncStatus: 'saved',
    });
  });

  it('does not fall back to localStorage when loading is unavailable', async () => {
    const { repository, controller } = createController();
    repository.loadHandler = async () => ({
      status: 'unavailable',
      error: { message: 'Access denied.', retryable: false },
    });

    await controller.reload();

    expect(controller.getSnapshot()).toEqual({
      status: 'unavailable',
      phase: 'load',
      message: 'Access denied.',
      retryable: false,
    });
    expect(repository.save).not.toHaveBeenCalled();
  });

  it('does not fall back to localStorage when the shared row is missing', async () => {
    const { repository, controller } = createController();
    repository.loadHandler = async () => ({ status: 'not-found' });

    await controller.reload();

    expect(controller.getSnapshot()).toEqual({ status: 'not-found' });
    expect(repository.save).not.toHaveBeenCalled();
  });

  it('saves the first mutation with the loaded revision and advances only from accepted results', async () => {
    const { repository, controller } = createController();
    await controller.reload();

    controller.update({ marker: 'first', value: 2 });
    await flushPromises();
    controller.update({ marker: 'second', value: 3 });
    await flushPromises();

    expect(repository.save).toHaveBeenNthCalledWith(
      1,
      LOCATION_ID,
      4,
      { marker: 'first', value: 2 },
    );
    expect(repository.save).toHaveBeenNthCalledWith(
      2,
      LOCATION_ID,
      5,
      { marker: 'second', value: 3 },
    );
    expect(controller.getSnapshot()).toMatchObject({
      status: 'ready',
      data: { marker: 'second', value: 3 },
      revision: 6,
      syncStatus: 'saved',
    });
  });

  it('allows only one save in flight and coalesces rapid mutations to the latest snapshot', async () => {
    const { repository, controller } = createController();
    const firstSave = deferred<SaveSharedLocationStateResult<TestData>>();
    const secondSave = deferred<SaveSharedLocationStateResult<TestData>>();
    repository.saveHandler = vi
      .fn()
      .mockImplementationOnce(() => firstSave.promise)
      .mockImplementationOnce(() => secondSave.promise);
    await controller.reload();

    controller.update({ marker: 'first', value: 2 });
    await flushPromises();
    expect(controller.update({ marker: 'superseded', value: 3 })).toMatchObject({
      status: 'accepted',
    });
    expect(controller.update({ marker: 'latest', value: 4 })).toEqual({
      status: 'rejected',
      reason: 'safety_securing',
    });
    await flushPromises();
    expect(controller.update({ marker: 'latest', value: 4 })).toMatchObject({
      status: 'accepted',
    });

    expect(repository.save).toHaveBeenCalledTimes(1);
    firstSave.resolve({
      status: 'accepted',
      value: sharedState({ marker: 'first', value: 2 }, 5),
    });
    await flushPromises();

    expect(repository.save).toHaveBeenCalledTimes(2);
    expect(repository.save).toHaveBeenLastCalledWith(
      LOCATION_ID,
      5,
      { marker: 'latest', value: 4 },
    );

    secondSave.resolve({
      status: 'accepted',
      value: sharedState({ marker: 'latest', value: 4 }, 6),
    });
    await flushPromises();

    expect(controller.getSnapshot()).toMatchObject({
      status: 'ready',
      data: { marker: 'latest', value: 4 },
      revision: 6,
      syncStatus: 'saved',
    });
  });

  it('does not lose a newer mutation that arrives while an accepted record is clearing', async () => {
    const pendingStore = new FakePendingStore<TestData>();
    const removal = deferred<void>();
    pendingStore.remove
      .mockImplementationOnce(async (userId, locationId) => {
        await removal.promise;
        pendingStore.records.delete(`${userId}:${locationId}`);
      })
      .mockImplementation(async (userId, locationId) => {
        pendingStore.records.delete(`${userId}:${locationId}`);
      });
    const { repository, controller } = createController(new FakeRepository(), {
      pendingStore,
    });
    await controller.reload();

    controller.update({ marker: 'first', value: 2 });
    await flushPromises();
    expect(pendingStore.remove).toHaveBeenCalledTimes(1);

    controller.update({ marker: 'newer-during-clear', value: 3 });
    await flushPromises();
    removal.resolve(undefined);
    await flushPromises();

    expect(repository.save).toHaveBeenNthCalledWith(
      2,
      LOCATION_ID,
      5,
      { marker: 'newer-during-clear', value: 3 },
    );
    expect(controller.getSnapshot()).toMatchObject({
      status: 'ready',
      data: { marker: 'newer-during-clear', value: 3 },
      revision: 6,
      syncStatus: 'saved',
    });
    expect(pendingStore.records.size).toBe(0);
  });

  it('drops the previous user queued snapshot when that controller is deactivated', async () => {
    const { repository, controller } = createController();
    const firstSave = deferred<SaveSharedLocationStateResult<TestData>>();
    let authenticatedUserId = 'user-a';
    const savedAs: string[] = [];
    repository.saveHandler = () => {
      savedAs.push(authenticatedUserId);
      return firstSave.promise;
    };
    await controller.reload();

    controller.update({ marker: 'user-a-first', value: 2 });
    await flushPromises();
    controller.update({ marker: 'user-a-queued', value: 3 });
    expect(repository.save).toHaveBeenCalledTimes(1);

    controller.deactivate();
    authenticatedUserId = 'user-b';
    firstSave.resolve({
      status: 'accepted',
      value: sharedState({ marker: 'user-a-first', value: 2 }, 5),
    });
    await flushPromises();

    controller.update({ marker: 'user-a-after-switch', value: 4 });
    await flushPromises();

    expect(repository.save).toHaveBeenCalledTimes(1);
    expect(savedAs).toEqual(['user-a']);
  });

  it('pauses automatic saves on conflict and retains both local and current server state', async () => {
    const { repository, controller } = createController();
    repository.saveHandler = async () => ({
      status: 'conflict',
      current: sharedState({ marker: 'other-user', value: 8 }, 5),
    });
    await controller.reload();

    controller.update({ marker: 'local-unsaved', value: 2 });
    await flushPromises();

    expect(controller.getSnapshot()).toEqual({
      status: 'conflict',
      local: { marker: 'local-unsaved', value: 2 },
      current: sharedState({ marker: 'other-user', value: 8 }, 5),
      pendingPreserved: true,
    });

    controller.update({ marker: 'must-not-save', value: 9 });
    await flushPromises();
    expect(repository.save).toHaveBeenCalledTimes(1);
  });

  it('reloads the server after conflict without discarding preserved local work', async () => {
    const { repository, controller } = createController();
    repository.saveHandler = async () => ({
      status: 'conflict',
      current: sharedState({ marker: 'other-user', value: 8 }, 5),
    });
    await controller.reload();
    controller.update({ marker: 'local-unsaved', value: 2 });
    await flushPromises();
    repository.loadHandler = async () => ({
      status: 'found',
      value: sharedState({ marker: 'latest-server', value: 10 }, 6),
    });

    await controller.reload();

    expect(controller.getSnapshot()).toEqual({
      status: 'conflict',
      local: { marker: 'local-unsaved', value: 2 },
      current: sharedState({ marker: 'latest-server', value: 10 }, 6),
      pendingPreserved: true,
    });
    expect(repository.save).toHaveBeenCalledTimes(1);
  });

  it('surfaces save unavailability and suspends unsafe continued writes', async () => {
    const { repository, controller } = createController();
    repository.saveHandler = async () => ({
      status: 'unavailable',
      error: { message: 'Membership inactive.', retryable: false },
    });
    await controller.reload();

    controller.update({ marker: 'not-saved', value: 2 });
    await flushPromises();

    expect(controller.getSnapshot()).toEqual({
      status: 'unavailable',
      phase: 'save',
      message: 'Membership inactive.',
      retryable: false,
      local: { marker: 'not-saved', value: 2 },
      pendingPreserved: true,
    });
    controller.update({ marker: 'must-not-save', value: 3 });
    await flushPromises();
    expect(repository.save).toHaveBeenCalledTimes(1);
  });

  it('rejects malformed remote operational state instead of rendering it', async () => {
    const { repository, controller } = createController();
    repository.loadHandler = async () => ({
      status: 'found',
      value: sharedState({ marker: '', value: 1 }, 4),
    });
    const strictController = new SharedStateController(
      repository,
      LOCATION_ID,
      (value) => {
        const parsed = normalize(value);
        return parsed?.marker ? parsed : null;
      },
      {
        userId: 'user-a',
        pendingStore: new FakePendingStore<TestData>(),
      },
    );

    await strictController.reload();

    expect(strictController.getSnapshot()).toEqual({
      status: 'unavailable',
      phase: 'load',
      message: 'Shared Petalon data is not valid operational application data.',
      retryable: false,
    });
  });

  it('uses the server-returned accepted state as the retained saved snapshot', async () => {
    const { repository, controller } = createController();
    repository.saveHandler = async (_locationId, expectedRevision) => ({
      status: 'accepted',
      value: sharedState({ marker: 'server-normalized', value: 2 }, expectedRevision + 1),
    });
    await controller.reload();

    controller.update({ marker: 'client-request', value: 2 });
    await flushPromises();

    expect(controller.getSnapshot()).toMatchObject({
      status: 'ready',
      data: { marker: 'server-normalized', value: 2 },
      revision: 5,
      syncStatus: 'saved',
    });
  });

  it('automatically reloads a newer remote revision only while the client is clean', async () => {
    const { repository, controller } = createController();
    controller.activate();
    await controller.reload();
    repository.loadHandler = async () => ({
      status: 'found',
      value: sharedState({ marker: 'remote-user', value: 2 }, 5),
    });

    repository.emitRevision(5);
    await flushPromises();

    expect(repository.load).toHaveBeenCalledTimes(2);
    expect(controller.getSnapshot()).toMatchObject({
      status: 'ready',
      data: { marker: 'remote-user', value: 2 },
      revision: 5,
      generation: 1,
      syncStatus: 'saved',
    });

    controller.update({ marker: 'remote-user', value: 2 });
    await flushPromises();
    expect(repository.save).not.toHaveBeenCalled();
  });

  it('reloads authoritatively after a channel subscribe or reconnect may have missed changes', async () => {
    const { repository, controller } = createController();
    controller.activate();
    await controller.reload();
    repository.loadHandler = async () => ({
      status: 'found',
      value: sharedState({ marker: 'missed-while-disconnected', value: 2 }, 5),
    });

    repository.emitSubscribed();
    await flushPromises();

    expect(repository.load).toHaveBeenCalledTimes(2);
    expect(controller.getSnapshot()).toMatchObject({
      status: 'ready',
      data: { marker: 'missed-while-disconnected', value: 2 },
      revision: 5,
    });
    expect(repository.save).not.toHaveBeenCalled();
  });

  it('ignores old and own-save revision notifications', async () => {
    const { repository, controller } = createController();
    controller.activate();
    await controller.reload();

    repository.emitRevision(4);
    controller.update({ marker: 'own-save', value: 2 });
    await flushPromises();
    repository.emitRevision(5);
    await flushPromises();

    expect(repository.load).toHaveBeenCalledTimes(1);
    expect(controller.getSnapshot()).toMatchObject({
      status: 'ready',
      data: { marker: 'own-save', value: 2 },
      revision: 5,
    });
  });

  it('lets an in-flight save decide a remote race and preserves the conflict state', async () => {
    const { repository, controller } = createController();
    const save = deferred<SaveSharedLocationStateResult<TestData>>();
    repository.saveHandler = () => save.promise;
    controller.activate();
    await controller.reload();

    controller.update({ marker: 'local-race', value: 2 });
    repository.emitRevision(5);
    expect(repository.load).toHaveBeenCalledTimes(1);

    save.resolve({
      status: 'conflict',
      current: sharedState({ marker: 'remote-winner', value: 3 }, 5),
    });
    await flushPromises();
    repository.emitRevision(6);
    await flushPromises();

    expect(controller.getSnapshot()).toEqual({
      status: 'conflict',
      local: { marker: 'local-race', value: 2 },
      current: sharedState({ marker: 'remote-winner', value: 3 }, 5),
      pendingPreserved: true,
    });
    expect(repository.load).toHaveBeenCalledTimes(1);
  });

  it('does not discard a coalesced local mutation when an invalidation arrives', async () => {
    const { repository, controller } = createController();
    const firstSave = deferred<SaveSharedLocationStateResult<TestData>>();
    const secondSave = deferred<SaveSharedLocationStateResult<TestData>>();
    repository.saveHandler = vi
      .fn()
      .mockImplementationOnce(() => firstSave.promise)
      .mockImplementationOnce(() => secondSave.promise);
    controller.activate();
    await controller.reload();

    controller.update({ marker: 'first-local', value: 2 });
    await flushPromises();
    controller.update({ marker: 'latest-local', value: 3 });
    repository.emitRevision(5);
    expect(repository.load).toHaveBeenCalledTimes(1);

    firstSave.resolve({
      status: 'accepted',
      value: sharedState({ marker: 'first-local', value: 2 }, 5),
    });
    await flushPromises();
    expect(repository.save).toHaveBeenLastCalledWith(
      LOCATION_ID,
      5,
      { marker: 'latest-local', value: 3 },
    );

    secondSave.resolve({
      status: 'accepted',
      value: sharedState({ marker: 'latest-local', value: 3 }, 6),
    });
    await flushPromises();

    expect(controller.getSnapshot()).toMatchObject({
      status: 'ready',
      data: { marker: 'latest-local', value: 3 },
      revision: 6,
    });
    expect(repository.load).toHaveBeenCalledTimes(1);
  });

  it('does not let realtime clear an unavailable state', async () => {
    const { repository, controller } = createController();
    repository.saveHandler = async () => ({
      status: 'unavailable',
      error: { message: 'Membership inactive.', retryable: false },
    });
    controller.activate();
    await controller.reload();
    controller.update({ marker: 'not-saved', value: 2 });
    await flushPromises();

    repository.emitRevision(99);
    await flushPromises();

    expect(controller.getSnapshot()).toEqual({
      status: 'unavailable',
      phase: 'save',
      message: 'Membership inactive.',
      retryable: false,
      local: { marker: 'not-saved', value: 2 },
      pendingPreserved: true,
    });
    expect(repository.load).toHaveBeenCalledTimes(1);
  });

  it('coalesces rapid invalidations into one reload plus the necessary follow-up', async () => {
    const { repository, controller } = createController();
    const firstReload = deferred<LoadSharedLocationStateResult<TestData>>();
    const followUpReload = deferred<LoadSharedLocationStateResult<TestData>>();
    controller.activate();
    await controller.reload();
    repository.loadHandler = vi
      .fn()
      .mockImplementationOnce(() => firstReload.promise)
      .mockImplementationOnce(() => followUpReload.promise);

    repository.emitRevision(5);
    repository.emitRevision(6);
    repository.emitRevision(7);
    expect(repository.load).toHaveBeenCalledTimes(2);

    firstReload.resolve({
      status: 'found',
      value: sharedState({ marker: 'remote-five', value: 5 }, 5),
    });
    await flushPromises();
    expect(repository.load).toHaveBeenCalledTimes(3);

    followUpReload.resolve({
      status: 'found',
      value: sharedState({ marker: 'remote-seven', value: 7 }, 7),
    });
    await flushPromises();

    expect(repository.load).toHaveBeenCalledTimes(3);
    expect(controller.getSnapshot()).toMatchObject({
      status: 'ready',
      data: { marker: 'remote-seven', value: 7 },
      revision: 7,
    });
  });

  it('owns one subscription per user-scoped controller and ignores stale callbacks', async () => {
    const repository = new FakeRepository();
    const controllerA = new SharedStateController(repository, LOCATION_ID, normalize, {
      userId: 'user-a',
      pendingStore: new FakePendingStore<TestData>(),
    });
    controllerA.activate();
    controllerA.activate();
    await controllerA.reload();

    expect(repository.subscribe).toHaveBeenCalledTimes(1);
    controllerA.deactivate();
    expect(repository.subscriptions[0].unsubscribe).toHaveBeenCalledTimes(1);

    repository.loadHandler = async () => ({
      status: 'found',
      value: sharedState({ marker: 'user-b', value: 2 }, 5),
    });
    const controllerB = new SharedStateController(repository, LOCATION_ID, normalize, {
      userId: 'user-b',
      pendingStore: new FakePendingStore<TestData>(),
    });
    controllerB.activate();
    await controllerB.reload();
    expect(repository.subscribe).toHaveBeenCalledTimes(2);

    repository.emitStaleCallback(99, 0);
    await flushPromises();

    expect(repository.load).toHaveBeenCalledTimes(2);
    expect(controllerB.getSnapshot()).toMatchObject({
      status: 'ready',
      data: { marker: 'user-b', value: 2 },
      revision: 5,
    });
  });

  it('keeps ready UI mounted during realtime and reconnect background refreshes', async () => {
    const { repository, controller } = createController();
    const observed: Array<ReturnType<typeof controller.getSnapshot>> = [];
    controller.activate();
    controller.observe((state) => observed.push(state));
    await controller.reload();
    observed.length = 0;
    repository.loadHandler = async () => ({
      status: 'found',
      value: sharedState({ marker: 'background', value: 2 }, 5),
    });

    repository.emitRevision(5);
    await flushPromises();

    expect(observed.some((state) => state.status === 'loading')).toBe(false);
    expect(observed).toContainEqual(expect.objectContaining({
      status: 'ready',
      refreshStatus: 'refreshing',
    }));
    expect(controller.getSnapshot()).toMatchObject({
      status: 'ready',
      data: { marker: 'background', value: 2 },
      revision: 5,
      generation: 1,
      refreshStatus: 'idle',
    });
    expect(repository.save).not.toHaveBeenCalled();

    repository.loadHandler = async () => ({
      status: 'found',
      value: sharedState({ marker: 'reconnected', value: 3 }, 6),
    });
    observed.length = 0;
    repository.emitSubscribed();
    await flushPromises();

    expect(observed.some((state) => state.status === 'loading')).toBe(false);
    expect(controller.getSnapshot()).toMatchObject({
      status: 'ready',
      data: { marker: 'reconnected', value: 3 },
      revision: 6,
      generation: 1,
    });
    expect(repository.save).not.toHaveBeenCalled();
  });

  it('keeps confirmed data visible when a background load fails transiently', async () => {
    const { repository, controller } = createController();
    controller.activate();
    await controller.reload();
    repository.loadHandler = async () => ({
      status: 'unavailable',
      error: { message: 'Network unavailable.', retryable: true },
    });

    repository.emitRevision(5);
    await flushPromises();

    expect(controller.getSnapshot()).toMatchObject({
      status: 'ready',
      data: { marker: 'server', value: 1 },
      revision: 4,
      syncStatus: 'saved',
      refreshStatus: 'stale',
    });

    repository.loadHandler = async () => ({
      status: 'found',
      value: sharedState({ marker: 'online-again', value: 2 }, 5),
    });
    controller.resume();
    await flushPromises();

    expect(controller.getSnapshot()).toMatchObject({
      status: 'ready',
      data: { marker: 'online-again', value: 2 },
      revision: 5,
      refreshStatus: 'idle',
    });
  });

  it('preserves a retryable failed save durably and accepts it on bounded retry', async () => {
    const scheduled: Array<() => void> = [];
    const repository = new FakeRepository();
    repository.saveHandler = vi
      .fn()
      .mockResolvedValueOnce({
        status: 'unavailable',
        error: { message: 'Network unavailable.', retryable: true },
      })
      .mockImplementationOnce(async (_locationId, expectedRevision, nextState) => ({
        status: 'accepted',
        value: sharedState(nextState, expectedRevision + 1),
      }));
    const pendingStore = new FakePendingStore<TestData>();
    const { controller } = createController(repository, {
      pendingStore,
      scheduleRetry: (callback) => {
        scheduled.push(callback);
        return () => undefined;
      },
      retryDelaysMs: [1],
    });
    await controller.reload();

    controller.update({ marker: 'offline-entry', value: 2 });
    await flushPromises();

    expect(controller.getSnapshot()).toMatchObject({
      status: 'ready',
      data: { marker: 'offline-entry', value: 2 },
      revision: 4,
      syncStatus: 'pending',
    });
    controller.update({ marker: 'offline-latest-entry', value: 3 });
    await flushPromises();
    expect(pendingStore.records.get(`user-a:${LOCATION_ID}`)).toMatchObject({
      userId: 'user-a',
      baseRevision: 4,
      baseState: { marker: 'server', value: 1 },
      desiredState: { marker: 'offline-latest-entry', value: 3 },
    });

    scheduled.shift()?.();
    await flushPromises();

    expect(repository.save).toHaveBeenNthCalledWith(
      2,
      LOCATION_ID,
      4,
      { marker: 'offline-latest-entry', value: 3 },
    );
    expect(controller.getSnapshot()).toMatchObject({
      status: 'ready',
      data: { marker: 'offline-latest-entry', value: 3 },
      revision: 5,
      syncStatus: 'saved',
    });
    expect(pendingStore.records.size).toBe(0);
  });

  it('recovers the same user pending state after controller restart without duplication', async () => {
    const pendingStore = new FakePendingStore<TestData>();
    const firstRepository = new FakeRepository();
    firstRepository.saveHandler = async () => ({
      status: 'unavailable',
      error: { message: 'Network unavailable.', retryable: true },
    });
    const first = createController(firstRepository, {
      pendingStore,
      scheduleRetry: () => () => undefined,
    }).controller;
    await first.reload();
    first.update({ marker: 'survives-reopen', value: 2 });
    await flushPromises();
    first.deactivate();

    const secondRepository = new FakeRepository();
    const second = createController(secondRepository, { pendingStore }).controller;
    await second.reload();
    await flushPromises();

    expect(secondRepository.save).toHaveBeenCalledTimes(1);
    expect(secondRepository.save).toHaveBeenCalledWith(
      LOCATION_ID,
      4,
      { marker: 'survives-reopen', value: 2 },
    );
    expect(second.getSnapshot()).toMatchObject({
      status: 'ready',
      data: { marker: 'survives-reopen', value: 2 },
      revision: 5,
      syncStatus: 'saved',
    });
    expect(pendingStore.records.size).toBe(0);
  });

  it('resumes a newer pending snapshot when the last attempted snapshot reached the server', async () => {
    const pendingStore = new FakePendingStore<TestData>();
    await pendingStore.save({
      userId: 'user-a',
      locationId: LOCATION_ID,
      baseRevision: 4,
      baseState: { marker: 'server', value: 1 },
      desiredState: { marker: 'latest-local', value: 3 },
      attemptedRevision: 4,
      attemptedState: { marker: 'first-local', value: 2 },
      createdAt: '2026-08-26T00:00:00.000Z',
      updatedAt: '2026-08-26T00:00:01.000Z',
    });
    const repository = new FakeRepository();
    repository.loadHandler = async () => ({
      status: 'found',
      value: sharedState({ marker: 'first-local', value: 2 }, 5),
    });
    const { controller } = createController(repository, { pendingStore });

    await controller.reload();
    await flushPromises();

    expect(repository.save).toHaveBeenCalledWith(
      LOCATION_ID,
      5,
      { marker: 'latest-local', value: 3 },
    );
    expect(controller.getSnapshot()).toMatchObject({
      status: 'ready',
      data: { marker: 'latest-local', value: 3 },
      revision: 6,
      syncStatus: 'saved',
    });
    expect(pendingStore.records.size).toBe(0);
  });

  it('treats an ambiguous retry as accepted when the server already has the exact snapshot', async () => {
    const scheduled: Array<() => void> = [];
    const pendingStore = new FakePendingStore<TestData>();
    const repository = new FakeRepository();
    const desired = { marker: 'accepted-before-disconnect', value: 2 };
    repository.saveHandler = vi
      .fn()
      .mockResolvedValueOnce({
        status: 'unavailable',
        error: { message: 'Response was lost.', retryable: true },
      })
      .mockResolvedValueOnce({
        status: 'conflict',
        current: sharedState(desired, 5),
      });
    const { controller } = createController(repository, {
      pendingStore,
      scheduleRetry: (callback) => {
        scheduled.push(callback);
        return () => undefined;
      },
    });
    await controller.reload();
    controller.update(desired);
    await flushPromises();

    scheduled.shift()?.();
    await flushPromises();

    expect(repository.save).toHaveBeenCalledTimes(2);
    expect(controller.getSnapshot()).toMatchObject({
      status: 'ready',
      data: desired,
      revision: 5,
      syncStatus: 'saved',
    });
    expect(pendingStore.records.size).toBe(0);
  });

  it('preserves pending work as a conflict when the server advanced while closed', async () => {
    const pendingStore = new FakePendingStore<TestData>();
    await pendingStore.save({
      userId: 'user-a',
      locationId: LOCATION_ID,
      baseRevision: 4,
      baseState: { marker: 'server', value: 1 },
      desiredState: { marker: 'local-preserved', value: 2 },
      createdAt: '2026-08-26T00:00:00.000Z',
      updatedAt: '2026-08-26T00:00:01.000Z',
    });
    const repository = new FakeRepository();
    repository.loadHandler = async () => ({
      status: 'found',
      value: sharedState({ marker: 'other-user', value: 9 }, 5),
    });
    const { controller } = createController(repository, { pendingStore });

    await controller.reload();

    expect(controller.getSnapshot()).toEqual({
      status: 'conflict',
      local: { marker: 'local-preserved', value: 2 },
      current: sharedState({ marker: 'other-user', value: 9 }, 5),
      pendingPreserved: true,
    });
    expect(repository.save).not.toHaveBeenCalled();
    expect(pendingStore.records.size).toBe(1);
  });

  it('retries a narrowly reconciled pending state against the current server revision', async () => {
    const pendingStore = new FakePendingStore<TestData>();
    await pendingStore.save({
      userId: 'user-a',
      locationId: LOCATION_ID,
      baseRevision: 4,
      baseState: { marker: 'server', value: 1 },
      desiredState: { marker: 'local-preserved', value: 2 },
      createdAt: '2026-08-26T00:00:00.000Z',
      updatedAt: '2026-08-26T00:00:01.000Z',
    });
    const repository = new FakeRepository();
    repository.loadHandler = async () => ({
      status: 'found',
      value: sharedState({ marker: 'compatible-server', value: 3 }, 5),
    });
    const { controller } = createController(repository, {
      pendingStore,
      reconcilePendingState: (_base, desired, server) => ({
        marker: desired.marker,
        value: server.value + desired.value,
      }),
    });

    await controller.reload();
    await flushPromises();

    expect(repository.save).toHaveBeenCalledWith(
      LOCATION_ID,
      5,
      { marker: 'local-preserved', value: 5 },
    );
    expect(controller.getSnapshot()).toMatchObject({
      status: 'ready',
      revision: 6,
      data: { marker: 'local-preserved', value: 5 },
    });
    expect(pendingStore.records.size).toBe(0);
  });

  it('never exposes or retries User A pending state for User B', async () => {
    const pendingStore = new FakePendingStore<TestData>();
    await pendingStore.save({
      userId: 'user-a',
      locationId: LOCATION_ID,
      baseRevision: 4,
      baseState: { marker: 'server', value: 1 },
      desiredState: { marker: 'user-a-private-pending', value: 2 },
      createdAt: '2026-08-26T00:00:00.000Z',
      updatedAt: '2026-08-26T00:00:01.000Z',
    });
    const repository = new FakeRepository();
    const { controller } = createController(repository, {
      userId: 'user-b',
      pendingStore,
    });

    await controller.reload();
    await flushPromises();

    expect(controller.getSnapshot()).toMatchObject({
      status: 'ready',
      data: { marker: 'server', value: 1 },
      syncStatus: 'saved',
    });
    expect(repository.save).not.toHaveBeenCalled();
    expect(pendingStore.records.has(`user-a:${LOCATION_ID}`)).toBe(true);
  });

  it('cancels automatic retries on sign-out/deactivation', async () => {
    const scheduled: Array<() => void> = [];
    const repository = new FakeRepository();
    repository.saveHandler = async () => ({
      status: 'unavailable',
      error: { message: 'Network unavailable.', retryable: true },
    });
    const { controller } = createController(repository, {
      scheduleRetry: (callback) => {
        scheduled.push(callback);
        return () => undefined;
      },
    });
    await controller.reload();
    controller.update({ marker: 'pending-before-signout', value: 2 });
    await flushPromises();
    expect(repository.save).toHaveBeenCalledTimes(1);

    controller.deactivate();
    scheduled.shift()?.();
    await flushPromises();

    expect(repository.save).toHaveBeenCalledTimes(1);
  });

  it('continues to Supabase when localStorage-equivalent fallback succeeds and IndexedDB hangs', async () => {
    const primary: PendingSharedStateStore<TestData> = {
      load: async () => null,
      save: () => new Promise<void>(() => undefined),
      remove: () => new Promise<void>(() => undefined),
    };
    const fallback = createInMemoryPendingSharedStateStore<TestData>();
    const pendingStore = createMirroredPendingSharedStateStore(primary, fallback);
    const { controller, repository } = createController(new FakeRepository(), { pendingStore });

    await controller.reload();
    expect(controller.update({ marker: 'fallback-safe', value: 2 })).toMatchObject({
      status: 'accepted',
    });
    await flushPromises();

    expect(repository.save).toHaveBeenCalledWith(
      LOCATION_ID,
      4,
      { marker: 'fallback-safe', value: 2 },
    );
    expect(controller.getSnapshot()).toMatchObject({
      status: 'ready',
      revision: 5,
      syncStatus: 'saved',
      deviceSafety: 'safe',
    });
  });

  it('times out unsafe durability, blocks operations two through twenty, and keeps mutation one visible', async () => {
    vi.useFakeTimers();
    try {
      const hangingPrimary: PendingSharedStateStore<TestData> = {
        load: async () => null,
        save: () => new Promise<void>(() => undefined),
        remove: async () => undefined,
      };
      const failedFallback: PendingSharedStateStore<TestData> = {
        load: async () => { throw new DOMException('Storage denied.', 'SecurityError'); },
        save: async () => { throw new DOMException('Quota exceeded.', 'QuotaExceededError'); },
        remove: async () => { throw new DOMException('Storage denied.', 'SecurityError'); },
      };
      const pendingStore = createMirroredPendingSharedStateStore(
        hangingPrimary,
        failedFallback,
      );
      const { controller, repository } = createController(new FakeRepository(), { pendingStore });
      await controller.reload();

      expect(controller.update({ marker: 'first-unsecured', value: 2 })).toEqual({
        status: 'accepted',
        kind: 'queued',
      });
      expect(controller.getSnapshot()).toMatchObject({
        status: 'ready',
        deviceSafety: 'securing',
      });

      await vi.advanceTimersByTimeAsync(2_501);
      await flushPromises();

      expect(controller.getSnapshot()).toMatchObject({
        status: 'ready',
        data: { marker: 'first-unsecured', value: 2 },
        syncStatus: 'pending',
        deviceSafety: 'blocked',
      });
      for (let operation = 2; operation <= 20; operation += 1) {
        expect(controller.update({ marker: `rejected-${operation}`, value: operation })).toEqual({
          status: 'rejected',
          reason: 'safety_blocked',
        });
      }
      expect(controller.getSnapshot()).toMatchObject({
        data: { marker: 'first-unsecured', value: 2 },
      });
      expect(repository.save).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not let telemetry failure affect an otherwise healthy save', async () => {
    const { controller, repository } = createController(new FakeRepository(), {
      telemetry: {
        bootSessionId: '00000000-0000-4000-8000-000000000000',
        record: () => { throw new Error('telemetry offline'); },
      },
    });
    await controller.reload();

    expect(controller.update({ marker: 'telemetry-independent', value: 2 }, 1)).toMatchObject({
      status: 'accepted',
    });
    await flushPromises();

    expect(repository.save).toHaveBeenCalledTimes(1);
    expect(controller.getSnapshot()).toMatchObject({
      status: 'ready',
      revision: 5,
      deviceSafety: 'safe',
    });
  });

  it('does not clear a hard stop when a later queued durability write finishes', async () => {
    vi.useFakeTimers();
    try {
      let saveCall = 0;
      const pendingStore: PendingSharedStateStore<TestData> = {
        load: async () => null,
        save: async () => {
          saveCall += 1;
          if (saveCall === 2) {
            await new Promise<void>(() => undefined);
          }
        },
        remove: async () => undefined,
      };
      const { controller, repository } = createController(new FakeRepository(), { pendingStore });
      await controller.reload();

      controller.update({ marker: 'first-durable', value: 2 });
      await flushPromises();
      expect(controller.getSnapshot()).toMatchObject({ deviceSafety: 'durable' });
      expect(repository.save).not.toHaveBeenCalled();

      expect(controller.update({ marker: 'second-visible', value: 3 })).toMatchObject({
        status: 'accepted',
      });
      await vi.advanceTimersByTimeAsync(2_501);
      await flushPromises();

      expect(saveCall).toBeGreaterThanOrEqual(3);
      expect(controller.getSnapshot()).toMatchObject({
        status: 'ready',
        data: { marker: 'second-visible', value: 3 },
        deviceSafety: 'blocked',
      });
      expect(controller.update({ marker: 'must-stay-rejected', value: 4 })).toEqual({
        status: 'rejected',
        reason: 'safety_blocked',
      });
      expect(repository.save).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('remains usable through repeated Home Screen PWA-style resume signals', async () => {
    const { controller, repository } = createController();
    controller.activate();
    await controller.reload();

    for (let cycle = 0; cycle < 10; cycle += 1) {
      controller.resume();
    }
    await flushPromises();

    expect(controller.update({ marker: 'after-resume-cycles', value: 2 })).toMatchObject({
      status: 'accepted',
    });
    await flushPromises();
    expect(repository.save).toHaveBeenCalledWith(
      LOCATION_ID,
      4,
      { marker: 'after-resume-cycles', value: 2 },
    );
    expect(controller.getSnapshot()).toMatchObject({
      status: 'ready',
      revision: 5,
      deviceSafety: 'safe',
    });
  });

  it('does not invoke known-conflict reconciliation without a current server state', async () => {
    const repository = new FakeRepository();
    repository.saveHandler = async () => ({ status: 'conflict', current: null });
    const reconcileKnownRejectedConflict = vi.fn(() => ({
      status: 'rebased' as const,
      state: { marker: 'must-not-run', value: 99 },
    }));
    const { controller } = createController(repository, { reconcileKnownRejectedConflict });
    await controller.reload();

    controller.update({ marker: 'local', value: 2 });
    await flushPromises();

    expect(reconcileKnownRejectedConflict).not.toHaveBeenCalled();
    expect(repository.save).toHaveBeenCalledTimes(1);
    expect(controller.getSnapshot()).toMatchObject({ status: 'conflict', current: null });
  });

  it('does not auto-rebase across more than one accepted remote revision', async () => {
    const repository = new FakeRepository();
    repository.saveHandler = async () => ({
      status: 'conflict',
      current: sharedState({ marker: 'remote', value: 8 }, 6),
    });
    const reconcileKnownRejectedConflict = vi.fn(() => ({
      status: 'rebased' as const,
      state: { marker: 'rebased', value: 10 },
    }));
    const { controller } = createController(repository, { reconcileKnownRejectedConflict });
    await controller.reload();

    controller.update({ marker: 'local', value: 2 });
    await flushPromises();

    expect(reconcileKnownRejectedConflict).not.toHaveBeenCalled();
    expect(repository.save).toHaveBeenCalledTimes(1);
    expect(controller.getSnapshot()).toMatchObject({ status: 'conflict' });
  });

  it('fails closed when raw conflict data does not pass known-conflict validation', async () => {
    const repository = new FakeRepository();
    repository.saveHandler = async () => ({
      status: 'conflict',
      current: sharedState({ marker: 'remote', value: 8 }, 5),
    });
    const reconcileKnownRejectedConflict = vi.fn(() => ({
      status: 'rebased' as const,
      state: { marker: 'must-not-run', value: 99 },
    }));
    const { controller } = createController(repository, {
      reconcileKnownRejectedConflict,
      validateKnownConflictCurrent: () => false,
    });
    await controller.reload();

    controller.update({ marker: 'local', value: 2 });
    await flushPromises();

    expect(reconcileKnownRejectedConflict).not.toHaveBeenCalled();
    expect(repository.save).toHaveBeenCalledTimes(1);
    expect(controller.getSnapshot()).toMatchObject({
      status: 'unavailable', phase: 'save', pendingPreserved: true,
    });
  });

  it('falls back to preserved conflict if the optional reconciler throws', async () => {
    const repository = new FakeRepository();
    repository.saveHandler = async () => ({
      status: 'conflict',
      current: sharedState({ marker: 'remote', value: 8 }, 5),
    });
    const { controller } = createController(repository, {
      reconcileKnownRejectedConflict: () => { throw new Error('classifier failed'); },
    });
    await controller.reload();

    controller.update({ marker: 'local', value: 2 });
    await flushPromises();

    expect(repository.save).toHaveBeenCalledTimes(1);
    expect(controller.getSnapshot()).toMatchObject({
      status: 'conflict', local: { marker: 'local', value: 2 }, pendingPreserved: true,
    });
  });

  it('fails closed when rebased pending durability rejects and sends no retry', async () => {
    let pendingSaveCount = 0;
    const pendingStore: PendingSharedStateStore<TestData> = {
      load: async () => null,
      save: async () => {
        pendingSaveCount += 1;
        if (pendingSaveCount === 3) throw new Error('rebase storage failed');
      },
      remove: async () => undefined,
    };
    const repository = new FakeRepository();
    repository.saveHandler = async () => ({
      status: 'conflict',
      current: sharedState({ marker: 'remote', value: 8 }, 5),
    });
    const { controller } = createController(repository, {
      pendingStore,
      reconcileKnownRejectedConflict: ({ desiredState, currentState }) => ({
        status: 'rebased',
        state: { marker: desiredState.marker, value: desiredState.value + currentState.value },
      }),
    });
    await controller.reload();

    controller.update({ marker: 'local', value: 2 });
    await flushPromises();

    expect(pendingSaveCount).toBe(3);
    expect(repository.save).toHaveBeenCalledTimes(1);
    expect(controller.getSnapshot()).toMatchObject({
      status: 'ready',
      data: { marker: 'local', value: 10 },
      syncStatus: 'pending',
      deviceSafety: 'blocked',
    });
    expect(controller.update({ marker: 'must-not-enter', value: 11 })).toEqual({
      status: 'rejected',
      reason: 'safety_blocked',
    });
  });

  it('times out rebased pending durability and sends no retry', async () => {
    vi.useFakeTimers();
    try {
      let pendingSaveCount = 0;
      const pendingStore: PendingSharedStateStore<TestData> = {
        load: async () => null,
        save: async () => {
          pendingSaveCount += 1;
          if (pendingSaveCount === 3) await new Promise<void>(() => undefined);
        },
        remove: async () => undefined,
      };
      const repository = new FakeRepository();
      repository.saveHandler = async () => ({
        status: 'conflict',
        current: sharedState({ marker: 'remote', value: 8 }, 5),
      });
      const { controller } = createController(repository, {
        pendingStore,
        reconcileKnownRejectedConflict: ({ desiredState, currentState }) => ({
          status: 'rebased',
          state: { marker: desiredState.marker, value: desiredState.value + currentState.value },
        }),
      });
      await controller.reload();

      controller.update({ marker: 'local', value: 2 });
      await flushPromises();
      expect(controller.getSnapshot()).toMatchObject({
        status: 'ready',
        data: { marker: 'local', value: 10 },
        deviceSafety: 'securing',
        syncMessage: 'Newer shared work found — safely combining changes...',
      });
      expect(controller.update({ marker: 'must-wait', value: 11 })).toEqual({
        status: 'rejected',
        reason: 'safety_securing',
      });
      await vi.advanceTimersByTimeAsync(2_501);
      await flushPromises();

      expect(pendingSaveCount).toBe(3);
      expect(repository.save).toHaveBeenCalledTimes(1);
      expect(controller.getSnapshot()).toMatchObject({
        status: 'ready',
        data: { marker: 'local', value: 10 },
        deviceSafety: 'blocked',
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it('resumes a durably rebased pending chain from its new base after restart', async () => {
    const pendingStore = new FakePendingStore<TestData>();
    const remote = { marker: 'remote', value: 8 };
    const rebased = { marker: 'local', value: 10 };
    await pendingStore.save({
      userId: 'user-a',
      locationId: LOCATION_ID,
      baseRevision: 5,
      baseState: remote,
      desiredState: rebased,
      automaticRebaseCount: 1,
      createdAt: '2026-08-28T10:00:00.000Z',
      updatedAt: '2026-08-28T10:00:01.000Z',
    });
    const repository = new FakeRepository();
    repository.loadHandler = async () => ({ status: 'found', value: sharedState(remote, 5) });
    const reconcileKnownRejectedConflict = vi.fn(() => ({
      status: 'rebased' as const,
      state: { marker: 'must-not-rebase-again', value: 99 },
    }));
    const { controller } = createController(repository, {
      pendingStore,
      reconcileKnownRejectedConflict,
    });

    await controller.reload();
    await flushPromises();

    expect(repository.save).toHaveBeenCalledWith(LOCATION_ID, 5, rebased);
    expect(reconcileKnownRejectedConflict).not.toHaveBeenCalled();
    expect(controller.getSnapshot()).toMatchObject({
      status: 'ready', revision: 6, data: rebased, syncStatus: 'saved',
    });
  });

  it('never treats an ambiguous request outcome as a known rejected conflict', async () => {
    const scheduled: Array<() => void> = [];
    const repository = new FakeRepository();
    repository.saveHandler = vi
      .fn()
      .mockRejectedValueOnce(new Error('response lost'))
      .mockResolvedValueOnce({
        status: 'conflict',
        current: sharedState({ marker: 'remote', value: 8 }, 5),
      });
    const reconcileKnownRejectedConflict = vi.fn(() => ({
      status: 'rebased' as const,
      state: { marker: 'unsafe-rebase', value: 99 },
    }));
    const { controller } = createController(repository, {
      reconcileKnownRejectedConflict,
      scheduleRetry: (callback) => {
        scheduled.push(callback);
        return () => undefined;
      },
    });
    await controller.reload();
    controller.update({ marker: 'local', value: 2 });
    await flushPromises();

    scheduled.shift()?.();
    await flushPromises();

    expect(repository.save).toHaveBeenCalledTimes(2);
    expect(reconcileKnownRejectedConflict).not.toHaveBeenCalled();
    expect(controller.getSnapshot()).toMatchObject({ status: 'conflict' });
  });

  it('allows only one automatic rebase in a pending mutation chain', async () => {
    const repository = new FakeRepository();
    repository.saveHandler = vi
      .fn()
      .mockResolvedValueOnce({
        status: 'conflict',
        current: sharedState({ marker: 'remote-one', value: 8 }, 5),
      })
      .mockResolvedValueOnce({
        status: 'conflict',
        current: sharedState({ marker: 'remote-two', value: 9 }, 6),
      });
    const reconcileKnownRejectedConflict = vi.fn(({ desiredState, currentState }) => ({
      status: 'rebased' as const,
      state: { marker: desiredState.marker, value: desiredState.value + currentState.value },
    }));
    const { controller } = createController(repository, { reconcileKnownRejectedConflict });
    await controller.reload();

    controller.update({ marker: 'local', value: 2 });
    await flushPromises();

    expect(repository.save).toHaveBeenCalledTimes(2);
    expect(reconcileKnownRejectedConflict).toHaveBeenCalledTimes(1);
    expect(controller.getSnapshot()).toMatchObject({ status: 'conflict' });
  });

  it('rebases the latest coalesced desired state only after it is durably aligned', async () => {
    const firstResult = deferred<SaveSharedLocationStateResult<TestData>>();
    const repository = new FakeRepository();
    repository.saveHandler = vi
      .fn()
      .mockImplementationOnce(() => firstResult.promise)
      .mockImplementationOnce(async (_locationId, expectedRevision, nextState) => ({
        status: 'accepted' as const,
        value: sharedState(nextState, expectedRevision + 1),
      }));
    const reconcileKnownRejectedConflict = vi.fn(({ desiredState, currentState }) => ({
      status: 'rebased' as const,
      state: { marker: desiredState.marker, value: desiredState.value + currentState.value },
    }));
    const { controller } = createController(repository, { reconcileKnownRejectedConflict });
    await controller.reload();

    controller.update({ marker: 'first-local', value: 2 });
    await flushPromises();
    controller.update({ marker: 'latest-local', value: 3 });
    await flushPromises();
    firstResult.resolve({
      status: 'conflict',
      current: sharedState({ marker: 'remote', value: 8 }, 5),
    });
    await flushPromises();

    expect(reconcileKnownRejectedConflict).toHaveBeenCalledWith(expect.objectContaining({
      desiredState: { marker: 'latest-local', value: 3 },
    }));
    expect(repository.save).toHaveBeenNthCalledWith(
      2,
      LOCATION_ID,
      5,
      { marker: 'latest-local', value: 11 },
    );
    expect(controller.getSnapshot()).toMatchObject({
      status: 'ready', revision: 6, data: { marker: 'latest-local', value: 11 },
    });
  });

  it('preserves conflict when a newer coalesced desired state is not yet durably aligned', async () => {
    const firstResult = deferred<SaveSharedLocationStateResult<TestData>>();
    const latestPersistence = deferred<void>();
    let pendingSaveCount = 0;
    const pendingStore: PendingSharedStateStore<TestData> = {
      load: async () => null,
      save: async () => {
        pendingSaveCount += 1;
        if (pendingSaveCount === 3) await latestPersistence.promise;
      },
      remove: async () => undefined,
    };
    const repository = new FakeRepository();
    repository.saveHandler = () => firstResult.promise;
    const reconcileKnownRejectedConflict = vi.fn(() => ({
      status: 'rebased' as const,
      state: { marker: 'must-not-run', value: 99 },
    }));
    const { controller } = createController(repository, {
      pendingStore,
      reconcileKnownRejectedConflict,
    });
    await controller.reload();

    controller.update({ marker: 'first-local', value: 2 });
    await flushPromises();
    controller.update({ marker: 'latest-local', value: 3 });
    await flushPromises();
    firstResult.resolve({
      status: 'conflict',
      current: sharedState({ marker: 'remote', value: 8 }, 5),
    });
    await flushPromises();

    expect(reconcileKnownRejectedConflict).not.toHaveBeenCalled();
    expect(controller.getSnapshot()).toMatchObject({
      status: 'conflict', local: { marker: 'latest-local', value: 3 },
    });

    latestPersistence.resolve();
    await flushPromises();
    expect(repository.save).toHaveBeenCalledTimes(1);
    expect(controller.getSnapshot()).toMatchObject({
      status: 'conflict', local: { marker: 'latest-local', value: 3 },
    });
  });

  it('rejects invalid automatic rebase counters in recovered pending records', async () => {
    const pendingStore = new FakePendingStore<TestData>();
    await pendingStore.save({
      userId: 'user-a',
      locationId: LOCATION_ID,
      baseRevision: 4,
      baseState: { marker: 'server', value: 1 },
      desiredState: { marker: 'local', value: 2 },
      automaticRebaseCount: 2,
      createdAt: '2026-08-28T10:00:00.000Z',
      updatedAt: '2026-08-28T10:00:01.000Z',
    } as unknown as PendingSharedStateRecord<TestData>);
    const { controller, repository } = createController(new FakeRepository(), { pendingStore });

    await controller.reload();

    expect(repository.save).not.toHaveBeenCalled();
    expect(controller.getSnapshot()).toMatchObject({
      status: 'unavailable', phase: 'load', pendingPreserved: true,
    });
  });
});
