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
const LOCAL_STORAGE_PREFIX = 'beach-set-manager-shared-pending-fallback-v1:';

export const PENDING_LOAD_TIMEOUT_MS = 3_000;
export const PENDING_WRITE_TIMEOUT_MS = 2_500;
export const PENDING_REMOVE_TIMEOUT_MS = 2_500;
export const INDEXED_DB_OPERATION_TIMEOUT_MS = 2_500;

export type PendingStoreOperation = 'load' | 'save' | 'remove' | 'indexeddb';

export class DurabilityTimeoutError extends Error {
  readonly code = 'DURABILITY_TIMEOUT';

  constructor(
    readonly operation: PendingStoreOperation,
    readonly timeoutMs: number,
  ) {
    super(`Device recovery ${operation} exceeded ${timeoutMs}ms.`);
    this.name = 'DurabilityTimeoutError';
  }
}

export function withDurabilityDeadline<T>(
  operation: Promise<T>,
  timeoutMs: number,
  operationName: PendingStoreOperation,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = globalThis.setTimeout(
      () => reject(new DurabilityTimeoutError(operationName, timeoutMs)),
      timeoutMs,
    );
    operation.then(
      (value) => {
        globalThis.clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        globalThis.clearTimeout(timer);
        reject(error);
      },
    );
  });
}

function recordKey(userId: string, locationId: string): string {
  return `${userId}:${locationId}`;
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return withDurabilityDeadline(new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed.'));
  }), INDEXED_DB_OPERATION_TIMEOUT_MS, 'indexeddb');
}

function transactionComplete(transaction: IDBTransaction): Promise<void> {
  return withDurabilityDeadline(new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB transaction aborted.'));
    transaction.onerror = () => reject(transaction.error ?? new Error('IndexedDB transaction failed.'));
  }), INDEXED_DB_OPERATION_TIMEOUT_MS, 'indexeddb');
}

class IndexedDbPendingSharedStateStore<T> implements PendingSharedStateStore<T> {
  private database: IDBDatabase | null = null;
  private databasePromise: Promise<IDBDatabase> | null = null;

  async load(userId: string, locationId: string): Promise<PendingSharedStateRecord<T> | null> {
    const transaction = await this.openTransaction('readonly');
    let stored: StoredPendingSharedStateRecord<T> | undefined;
    try {
      stored = await requestResult(
        transaction.objectStore(STORE_NAME).get(recordKey(userId, locationId)),
      ) as StoredPendingSharedStateRecord<T> | undefined;
    } catch (error) {
      this.invalidateDatabase(transaction.db);
      throw error;
    }

    if (!stored) {
      return null;
    }

    const { key: _key, ...record } = stored;
    return record;
  }

  async save(record: PendingSharedStateRecord<T>): Promise<void> {
    const transaction = await this.openTransaction('readwrite');
    transaction.objectStore(STORE_NAME).put({
      ...record,
      key: recordKey(record.userId, record.locationId),
    } satisfies StoredPendingSharedStateRecord<T>);
    try {
      await transactionComplete(transaction);
    } catch (error) {
      this.invalidateDatabase(transaction.db);
      throw error;
    }
  }

  async remove(userId: string, locationId: string): Promise<void> {
    const transaction = await this.openTransaction('readwrite');
    transaction.objectStore(STORE_NAME).delete(recordKey(userId, locationId));
    try {
      await transactionComplete(transaction);
    } catch (error) {
      this.invalidateDatabase(transaction.db);
      throw error;
    }
  }

  private async openTransaction(mode: IDBTransactionMode): Promise<IDBTransaction> {
    const database = await this.openDatabase();
    try {
      return database.transaction(STORE_NAME, mode);
    } catch {
      this.invalidateDatabase(database);
      const reopened = await this.openDatabase();
      return reopened.transaction(STORE_NAME, mode);
    }
  }

  private openDatabase(): Promise<IDBDatabase> {
    if (!this.databasePromise) {
      const opening = new Promise<IDBDatabase>((resolve, reject) => {
        if (!globalThis.indexedDB) {
          reject(new Error('IndexedDB is unavailable.'));
          return;
        }

        const request = globalThis.indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
        let settled = false;
        const timer = globalThis.setTimeout(() => {
          if (settled) {
            return;
          }
          settled = true;
          this.databasePromise = null;
          reject(new DurabilityTimeoutError('indexeddb', INDEXED_DB_OPERATION_TIMEOUT_MS));
        }, INDEXED_DB_OPERATION_TIMEOUT_MS);
        request.onupgradeneeded = () => {
          const database = request.result;
          if (!database.objectStoreNames.contains(STORE_NAME)) {
            database.createObjectStore(STORE_NAME, { keyPath: 'key' });
          }
        };
        request.onsuccess = () => {
          const database = request.result;
          if (settled) {
            database.close();
            return;
          }
          settled = true;
          globalThis.clearTimeout(timer);
          this.database = database;
          database.onclose = () => this.releaseDatabase(database);
          database.onversionchange = () => {
            database.close();
            this.releaseDatabase(database);
          };
          resolve(database);
        };
        request.onerror = () => {
          if (settled) {
            return;
          }
          settled = true;
          globalThis.clearTimeout(timer);
          this.databasePromise = null;
          reject(request.error ?? new Error('IndexedDB could not be opened.'));
        };
        request.onblocked = () => {
          if (settled) {
            return;
          }
          settled = true;
          globalThis.clearTimeout(timer);
          this.databasePromise = null;
          reject(new Error('IndexedDB upgrade was blocked.'));
        };
      });
      this.databasePromise = opening;
    }

    return this.databasePromise;
  }

  private invalidateDatabase(database: IDBDatabase): void {
    if (this.database !== database) {
      return;
    }
    database.onclose = null;
    database.onversionchange = null;
    database.close();
    this.releaseDatabase(database);
  }

  private releaseDatabase(database: IDBDatabase): void {
    if (this.database === database) {
      this.database = null;
      this.databasePromise = null;
    }
  }
}

class LocalStoragePendingSharedStateStore<T> implements PendingSharedStateStore<T> {
  constructor(private readonly storage: Storage) {}

  async load(userId: string, locationId: string): Promise<PendingSharedStateRecord<T> | null> {
    const raw = this.storage.getItem(`${LOCAL_STORAGE_PREFIX}${recordKey(userId, locationId)}`);
    if (!raw) {
      return null;
    }

    const candidate = JSON.parse(raw) as Partial<PendingSharedStateRecord<T>>;
    if (
      candidate.userId !== userId ||
      candidate.locationId !== locationId ||
      !Number.isSafeInteger(candidate.baseRevision) ||
      typeof candidate.createdAt !== 'string' ||
      typeof candidate.updatedAt !== 'string' ||
      candidate.baseState === undefined ||
      candidate.desiredState === undefined
    ) {
      return null;
    }

    return candidate as PendingSharedStateRecord<T>;
  }

  async save(record: PendingSharedStateRecord<T>): Promise<void> {
    this.storage.setItem(
      `${LOCAL_STORAGE_PREFIX}${recordKey(record.userId, record.locationId)}`,
      JSON.stringify(record),
    );
  }

  async remove(userId: string, locationId: string): Promise<void> {
    this.storage.removeItem(`${LOCAL_STORAGE_PREFIX}${recordKey(userId, locationId)}`);
  }
}

class HangingSaveTestPendingSharedStateStore<T> implements PendingSharedStateStore<T> {
  constructor(private readonly delegate: PendingSharedStateStore<T>) {}

  load(userId: string, locationId: string): Promise<PendingSharedStateRecord<T> | null> {
    return this.delegate.load(userId, locationId);
  }

  save(_record: PendingSharedStateRecord<T>): Promise<void> {
    return new Promise<void>(() => undefined);
  }

  remove(userId: string, locationId: string): Promise<void> {
    return this.delegate.remove(userId, locationId);
  }
}

class MirroredPendingSharedStateStore<T> implements PendingSharedStateStore<T> {
  private primaryQueue: Promise<void> = Promise.resolve();

  constructor(
    private readonly primary: PendingSharedStateStore<T>,
    private readonly fallback: PendingSharedStateStore<T>,
  ) {}

  async load(userId: string, locationId: string): Promise<PendingSharedStateRecord<T> | null> {
    const fallbackRecord = await withDurabilityDeadline(
      this.fallback.load(userId, locationId),
      PENDING_LOAD_TIMEOUT_MS,
      'load',
    ).catch(() => null);
    const primaryLoad = this.primaryQueue
      .then(() => withDurabilityDeadline(
        this.primary.load(userId, locationId),
        PENDING_LOAD_TIMEOUT_MS,
        'load',
      ))
      .catch(() => null);
    const primaryRecord = await Promise.race([
      primaryLoad,
      new Promise<null>((resolve) => globalThis.setTimeout(() => resolve(null), 1_500)),
    ]);

    if (!fallbackRecord) {
      return primaryRecord;
    }
    if (!primaryRecord) {
      return fallbackRecord;
    }
    return primaryRecord.updatedAt > fallbackRecord.updatedAt
      ? primaryRecord
      : fallbackRecord;
  }

  async save(record: PendingSharedStateRecord<T>): Promise<void> {
    let fallbackSaved = false;
    try {
      await withDurabilityDeadline(
        this.fallback.save(record),
        PENDING_WRITE_TIMEOUT_MS,
        'save',
      );
      fallbackSaved = true;
    } catch {
      // IndexedDB remains an independent durable path below.
    }

    const primarySave = this.enqueuePrimary(() => withDurabilityDeadline(
      this.primary.save(record),
      PENDING_WRITE_TIMEOUT_MS,
      'save',
    ));
    if (fallbackSaved) {
      return;
    }
    await primarySave;
  }

  async remove(userId: string, locationId: string): Promise<void> {
    let fallbackRemoved = false;
    try {
      await withDurabilityDeadline(
        this.fallback.remove(userId, locationId),
        PENDING_REMOVE_TIMEOUT_MS,
        'remove',
      );
      fallbackRemoved = true;
    } catch {
      // IndexedDB cleanup remains an independent path below.
    }

    const primaryRemove = this.enqueuePrimary(() => withDurabilityDeadline(
      this.primary.remove(userId, locationId),
      PENDING_REMOVE_TIMEOUT_MS,
      'remove',
    ));
    if (fallbackRemoved) {
      return;
    }
    await primaryRemove;
  }

  private enqueuePrimary(operation: () => Promise<void>): Promise<void> {
    const queued = this.primaryQueue.then(operation, operation);
    this.primaryQueue = queued.catch(() => undefined);
    return queued;
  }
}

function getBrowserLocalStorage(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

export function createIndexedDbPendingSharedStateStore<T>(): PendingSharedStateStore<T> {
  return new IndexedDbPendingSharedStateStore<T>();
}

export function createMirroredPendingSharedStateStore<T>(
  primary: PendingSharedStateStore<T>,
  fallback: PendingSharedStateStore<T>,
): PendingSharedStateStore<T> {
  return new MirroredPendingSharedStateStore(primary, fallback);
}

export function createBrowserPendingSharedStateStore<T>(): PendingSharedStateStore<T> {
  const indexedDb = createIndexedDbPendingSharedStateStore<T>();
  const localStorage = getBrowserLocalStorage();
  const store = localStorage
    ? createMirroredPendingSharedStateStore(
        indexedDb,
        new LocalStoragePendingSharedStateStore<T>(localStorage),
      )
    : indexedDb;

  // Preview-only manual fault injection. The flag must be present at build time,
  // so this path is unavailable in the normal Production build and has no UI.
  const testSeamEnabled = import.meta.env.VITE_ENABLE_DURABILITY_TEST_SEAM === 'true';
  const requestedFailure = testSeamEnabled
    ? new URLSearchParams(globalThis.location?.search ?? '').get('r2DurabilityFailure')
    : null;
  return requestedFailure === 'hang'
    ? new HangingSaveTestPendingSharedStateStore(store)
    : store;
}

export function createInMemoryPendingSharedStateStore<T>(): PendingSharedStateStore<T> {
  return new InMemoryPendingSharedStateStore<T>();
}
