import { describe, expect, it, vi } from 'vitest';
import type {
  LoadSharedLocationStateResult,
  SaveSharedLocationStateResult,
  SharedLocationState,
  SharedLocationStateRepository,
} from './repository';
import { SharedStateController } from './sharedStateController';

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

  subscribe() {
    return () => undefined;
  }
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

function createController(repository = new FakeRepository()) {
  return {
    repository,
    controller: new SharedStateController(repository, LOCATION_ID, normalize),
  };
}

async function flushPromises() {
  await Promise.resolve();
  await Promise.resolve();
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
    controller.update({ marker: 'superseded', value: 3 });
    controller.update({ marker: 'latest', value: 4 });

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
    });

    controller.update({ marker: 'must-not-save', value: 9 });
    await flushPromises();
    expect(repository.save).toHaveBeenCalledTimes(1);
  });

  it('reloads authoritative data only after a deliberate conflict reload', async () => {
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

    expect(controller.getSnapshot()).toMatchObject({
      status: 'ready',
      data: { marker: 'latest-server', value: 10 },
      revision: 6,
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
});
