export type PendingSharedStateRecord<T> = {
  userId: string;
  locationId: string;
  baseRevision: number;
  baseState: T;
  desiredState: T;
  attemptedRevision?: number;
  attemptedState?: T;
  createdAt: string;
  updatedAt: string;
};

export interface PendingSharedStateStore<T> {
  load(userId: string, locationId: string): Promise<PendingSharedStateRecord<T> | null>;
  save(record: PendingSharedStateRecord<T>): Promise<void>;
  remove(userId: string, locationId: string): Promise<void>;
}

class InMemoryPendingSharedStateStore<T> implements PendingSharedStateStore<T> {
  private readonly records = new Map<string, PendingSharedStateRecord<T>>();

  async load(userId: string, locationId: string): Promise<PendingSharedStateRecord<T> | null> {
    return this.records.get(recordKey(userId, locationId)) ?? null;
  }

  async save(record: PendingSharedStateRecord<T>): Promise<void> {
    this.records.set(recordKey(record.userId, record.locationId), record);
  }

  async remove(userId: string, locationId: string): Promise<void> {
    this.records.delete(recordKey(userId, locationId));
  }
}

type StoredPendingSharedStateRecord<T> = PendingSharedStateRecord<T> & {
  key: string;
};

const DATABASE_NAME = 'beach-set-manager-shared-pending-v1';
const STORE_NAME = 'pendingStates';
const DATABASE_VERSION = 1;

function recordKey(userId: string, locationId: string): string {
  return `${userId}:${locationId}`;
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed.'));
  });
}

function transactionComplete(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB transaction aborted.'));
    transaction.onerror = () => reject(transaction.error ?? new Error('IndexedDB transaction failed.'));
  });
}

class IndexedDbPendingSharedStateStore<T> implements PendingSharedStateStore<T> {
  private databasePromise: Promise<IDBDatabase> | null = null;

  async load(userId: string, locationId: string): Promise<PendingSharedStateRecord<T> | null> {
    const database = await this.openDatabase();
    const transaction = database.transaction(STORE_NAME, 'readonly');
    const stored = await requestResult(
      transaction.objectStore(STORE_NAME).get(recordKey(userId, locationId)),
    ) as StoredPendingSharedStateRecord<T> | undefined;

    if (!stored) {
      return null;
    }

    const { key: _key, ...record } = stored;
    return record;
  }

  async save(record: PendingSharedStateRecord<T>): Promise<void> {
    const database = await this.openDatabase();
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    transaction.objectStore(STORE_NAME).put({
      ...record,
      key: recordKey(record.userId, record.locationId),
    } satisfies StoredPendingSharedStateRecord<T>);
    await transactionComplete(transaction);
  }

  async remove(userId: string, locationId: string): Promise<void> {
    const database = await this.openDatabase();
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    transaction.objectStore(STORE_NAME).delete(recordKey(userId, locationId));
    await transactionComplete(transaction);
  }

  private openDatabase(): Promise<IDBDatabase> {
    if (!this.databasePromise) {
      this.databasePromise = new Promise((resolve, reject) => {
        if (!globalThis.indexedDB) {
          reject(new Error('IndexedDB is unavailable.'));
          return;
        }

        const request = globalThis.indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
        request.onupgradeneeded = () => {
          const database = request.result;
          if (!database.objectStoreNames.contains(STORE_NAME)) {
            database.createObjectStore(STORE_NAME, { keyPath: 'key' });
          }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error ?? new Error('IndexedDB could not be opened.'));
        request.onblocked = () => reject(new Error('IndexedDB upgrade was blocked.'));
      });
    }

    return this.databasePromise;
  }
}

export function createIndexedDbPendingSharedStateStore<T>(): PendingSharedStateStore<T> {
  return new IndexedDbPendingSharedStateStore<T>();
}

export function createInMemoryPendingSharedStateStore<T>(): PendingSharedStateStore<T> {
  return new InMemoryPendingSharedStateStore<T>();
}
