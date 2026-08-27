import { describe, expect, it } from 'vitest';
import {
  createInMemoryPendingSharedStateStore,
  createMirroredPendingSharedStateStore,
  type PendingSharedStateRecord,
  type PendingSharedStateStore,
} from './pendingSharedStateStore';

type TestData = { value: number };

const record: PendingSharedStateRecord<TestData> = {
  userId: 'user-a',
  locationId: 'location-a',
  baseRevision: 4,
  baseState: { value: 1 },
  desiredState: { value: 2 },
  createdAt: '2026-08-27T09:30:00.000Z',
  updatedAt: '2026-08-27T09:31:00.000Z',
};

function unavailableStore(): PendingSharedStateStore<TestData> {
  return {
    load: async () => { throw new Error('unavailable'); },
    save: async () => { throw new Error('unavailable'); },
    remove: async () => { throw new Error('unavailable'); },
  };
}

describe('mirrored pending shared-state storage', () => {
  it('preserves and loads pending work through the fallback when IndexedDB fails', async () => {
    const fallback = createInMemoryPendingSharedStateStore<TestData>();
    const store = createMirroredPendingSharedStateStore(unavailableStore(), fallback);

    await expect(store.save(record)).resolves.toBeUndefined();
    await expect(store.load('user-a', 'location-a')).resolves.toEqual(record);
  });

  it('does not block an online save when IndexedDB hangs after the fallback succeeds', async () => {
    const primary: PendingSharedStateStore<TestData> = {
      load: async () => null,
      save: () => new Promise<void>(() => undefined),
      remove: async () => undefined,
    };
    const fallback = createInMemoryPendingSharedStateStore<TestData>();
    const store = createMirroredPendingSharedStateStore(primary, fallback);

    await expect(store.save(record)).resolves.toBeUndefined();
    await expect(fallback.load('user-a', 'location-a')).resolves.toEqual(record);
  });

  it('continues through the primary when the fallback fails', async () => {
    const primary = createInMemoryPendingSharedStateStore<TestData>();
    const store = createMirroredPendingSharedStateStore(primary, unavailableStore());

    await expect(store.save(record)).resolves.toBeUndefined();
    await expect(store.load('user-a', 'location-a')).resolves.toEqual(record);
  });

  it('removes the fallback immediately and queues primary cleanup after its save', async () => {
    const primary = createInMemoryPendingSharedStateStore<TestData>();
    const fallback = createInMemoryPendingSharedStateStore<TestData>();
    const store = createMirroredPendingSharedStateStore(primary, fallback);

    await store.save(record);
    await store.remove('user-a', 'location-a');

    await expect(store.load('user-a', 'location-a')).resolves.toBeNull();
  });
});
