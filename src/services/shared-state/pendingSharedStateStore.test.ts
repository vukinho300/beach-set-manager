import { describe, expect, it, vi } from 'vitest';
import {
  createIndexedDbPendingSharedStateStore,
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

describe('IndexedDB pending shared-state storage', () => {
  it('discards a closed iOS database handle and reopens before saving', async () => {
    const put = vi.fn();
    const workingTransaction = {
      db: null as unknown as IDBDatabase,
      objectStore: () => ({ put }),
      oncomplete: null as (() => void) | null,
      onabort: null,
      onerror: null,
      error: null,
    };
    const staleDatabase = {
      transaction: vi.fn(() => { throw new DOMException('The connection is closed.', 'InvalidStateError'); }),
      close: vi.fn(),
      onclose: null,
      onversionchange: null,
    } as unknown as IDBDatabase;
    const workingDatabase = {
      transaction: vi.fn(() => {
        globalThis.setTimeout(() => workingTransaction.oncomplete?.(), 0);
        return workingTransaction;
      }),
      close: vi.fn(),
      onclose: null,
      onversionchange: null,
    } as unknown as IDBDatabase;
    workingTransaction.db = workingDatabase;
    const databases = [staleDatabase, workingDatabase];
    const open = vi.fn(() => {
      const request = {
        result: null as unknown as IDBDatabase,
        error: null,
        onupgradeneeded: null as (() => void) | null,
        onsuccess: null as (() => void) | null,
        onerror: null,
        onblocked: null,
      };
      const database = databases.shift();
      queueMicrotask(() => {
        request.result = database!;
        request.onsuccess?.();
      });
      return request;
    });
    const previousIndexedDb = globalThis.indexedDB;
    Object.defineProperty(globalThis, 'indexedDB', {
      configurable: true,
      value: { open },
    });

    try {
      const store = createIndexedDbPendingSharedStateStore<TestData>();
      await expect(store.save(record)).resolves.toBeUndefined();
      expect(open).toHaveBeenCalledTimes(2);
      expect(staleDatabase.close).toHaveBeenCalledTimes(1);
      expect(put).toHaveBeenCalledTimes(1);
    } finally {
      if (previousIndexedDb) {
        Object.defineProperty(globalThis, 'indexedDB', { configurable: true, value: previousIndexedDb });
      } else {
        Reflect.deleteProperty(globalThis, 'indexedDB');
      }
    }
  });
});
