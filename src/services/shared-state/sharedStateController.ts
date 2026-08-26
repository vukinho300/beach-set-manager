import type {
  PendingSharedStateRecord,
  PendingSharedStateStore,
} from './pendingSharedStateStore';
import type {
  LoadSharedLocationStateResult,
  SaveSharedLocationStateResult,
  SharedLocationState,
  SharedLocationStateInvalidation,
  SharedLocationStateRepository,
  Unsubscribe,
} from './repository';

export type SharedSyncStatus = 'saved' | 'saving' | 'pending';
export type SharedRefreshStatus = 'idle' | 'refreshing' | 'stale';

export type SharedStateControllerState<T> =
  | { status: 'loading' }
  | {
      status: 'ready';
      data: T;
      revision: number;
      generation: number;
      syncStatus: SharedSyncStatus;
      refreshStatus: SharedRefreshStatus;
      syncMessage?: string;
      updatedAt: string;
      updatedBy?: string;
    }
  | { status: 'not-found' }
  | {
      status: 'conflict';
      local: T;
      current: SharedLocationState<T> | null;
      pendingPreserved: true;
    }
  | {
      status: 'unavailable';
      phase: 'load' | 'save';
      message: string;
      retryable: boolean;
      local?: T;
      pendingPreserved?: boolean;
    };

export type NormalizeSharedState<T> = (value: unknown) => T | null;
export type ReconcilePendingState<T> = (
  baseState: T,
  desiredState: T,
  serverState: T,
) => T | null;
export type SharedStateControllerListener<T> = (
  state: SharedStateControllerState<T>,
) => void;

type RetryScheduler = (callback: () => void, delayMs: number) => () => void;

export type SharedStateControllerOptions<T> = {
  userId: string;
  pendingStore: PendingSharedStateStore<T>;
  equals?: (first: T, second: T) => boolean;
  now?: () => string;
  retryDelaysMs?: readonly number[];
  scheduleRetry?: RetryScheduler;
  reconcilePendingState?: ReconcilePendingState<T>;
};

const DEFAULT_RETRY_DELAYS_MS = [1_500, 3_000, 6_000, 12_000, 30_000] as const;

export function areSharedStatesEqual<T>(first: T, second: T): boolean {
  if (Object.is(first, second)) {
    return true;
  }

  if (Array.isArray(first) || Array.isArray(second)) {
    return (
      Array.isArray(first) &&
      Array.isArray(second) &&
      first.length === second.length &&
      first.every((value, index) => areSharedStatesEqual(value, second[index]))
    );
  }

  if (!first || !second || typeof first !== 'object' || typeof second !== 'object') {
    return false;
  }

  const firstRecord = first as Record<string, unknown>;
  const secondRecord = second as Record<string, unknown>;
  const firstKeys = Object.keys(firstRecord).filter((key) => firstRecord[key] !== undefined);
  const secondKeys = Object.keys(secondRecord).filter((key) => secondRecord[key] !== undefined);

  return (
    firstKeys.length === secondKeys.length &&
    firstKeys.every(
      (key) =>
        Object.prototype.hasOwnProperty.call(secondRecord, key) &&
        areSharedStatesEqual(firstRecord[key], secondRecord[key]),
    )
  );
}

function defaultRetryScheduler(callback: () => void, delayMs: number): () => void {
  const timer = globalThis.setTimeout(callback, delayMs);
  return () => globalThis.clearTimeout(timer);
}

export class SharedStateController<T> {
  private state: SharedStateControllerState<T> = { status: 'loading' };
  private readonly listeners = new Set<SharedStateControllerListener<T>>();
  private readonly userId: string;
  private readonly pendingStore: PendingSharedStateStore<T>;
  private readonly equals: (first: T, second: T) => boolean;
  private readonly now: () => string;
  private readonly retryDelaysMs: readonly number[];
  private readonly scheduleRetryCallback: RetryScheduler;
  private readonly reconcilePendingState: ReconcilePendingState<T> | null;
  private confirmed: SharedLocationState<T> | null = null;
  private revision: number | null = null;
  private generation = 0;
  private loadEpoch = 0;
  private saveInFlight = false;
  private desiredState: T | null = null;
  private pendingRecord: PendingSharedStateRecord<T> | null = null;
  private pendingWriteVersion = 0;
  private persistedWriteVersion = 0;
  private persistenceQueue: Promise<void> = Promise.resolve();
  private paused = true;
  private deactivated = false;
  private active = false;
  private unsubscribe: Unsubscribe | null = null;
  private invalidatedRevision: number | null = null;
  private unversionedInvalidationPending = false;
  private automaticReloadInFlight = false;
  private lastAutomaticReloadTarget: number | null = null;
  private retryAttempt = 0;
  private retryWaiting = false;
  private cancelScheduledRetry: (() => void) | null = null;

  constructor(
    private readonly repository: SharedLocationStateRepository<T>,
    private readonly locationId: string,
    private readonly normalize: NormalizeSharedState<T>,
    options: SharedStateControllerOptions<T>,
  ) {
    this.userId = options.userId;
    this.pendingStore = options.pendingStore;
    this.equals = options.equals ?? areSharedStatesEqual;
    this.now = options.now ?? (() => new Date().toISOString());
    this.retryDelaysMs = options.retryDelaysMs?.length
      ? options.retryDelaysMs
      : DEFAULT_RETRY_DELAYS_MS;
    this.scheduleRetryCallback = options.scheduleRetry ?? defaultRetryScheduler;
    this.reconcilePendingState = options.reconcilePendingState ?? null;
  }

  getSnapshot(): SharedStateControllerState<T> {
    return this.state;
  }

  observe(listener: SharedStateControllerListener<T>): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => this.listeners.delete(listener);
  }

  activate(): void {
    if (this.active) {
      return;
    }

    this.active = true;
    this.deactivated = false;
    this.unsubscribe = this.repository.subscribe(
      this.locationId,
      (invalidation) => this.handleRemoteInvalidation(invalidation),
    );
  }

  deactivate(): void {
    this.active = false;
    this.deactivated = true;
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.cancelRetry();
    this.loadEpoch += 1;
    this.paused = true;
    this.desiredState = null;
    this.pendingRecord = null;
    this.confirmed = null;
    this.revision = null;
    this.invalidatedRevision = null;
    this.unversionedInvalidationPending = false;
    this.automaticReloadInFlight = false;
    this.lastAutomaticReloadTarget = null;
  }

  async reload(): Promise<void> {
    this.invalidatedRevision = null;
    this.unversionedInvalidationPending = false;
    this.lastAutomaticReloadTarget = null;
    await this.loadAuthoritativeState('initial');
    void this.drainRemoteInvalidations();
  }

  resume(): void {
    if (this.deactivated) {
      return;
    }

    if (this.state.status === 'ready' && this.desiredState !== null) {
      this.retryPendingSave();
      return;
    }

    if (this.state.status === 'ready') {
      this.unversionedInvalidationPending = true;
      void this.drainRemoteInvalidations();
      return;
    }

    if (this.state.status === 'unavailable' && this.state.retryable) {
      void this.reload();
    }
  }

  update(nextState: T): void {
    if (this.deactivated || this.paused || this.state.status !== 'ready') {
      return;
    }

    if (this.equals(nextState, this.state.data)) {
      return;
    }

    this.desiredState = nextState;
    this.publishLocalReady(
      this.retryWaiting ? 'pending' : 'saving',
      this.state.refreshStatus,
      this.retryWaiting ? 'Not saved yet — retrying.' : undefined,
    );
    void this.persistLatestDesiredState();
  }

  private async loadAuthoritativeState(mode: 'initial' | 'background'): Promise<number | null> {
    const epoch = ++this.loadEpoch;
    const previousReady = this.state.status === 'ready' ? this.state : null;

    if (mode === 'initial') {
      this.paused = true;
      this.cancelRetry();
      this.publish({ status: 'loading' });
    } else if (previousReady) {
      this.publish({ ...previousReady, refreshStatus: 'refreshing', syncMessage: undefined });
    }

    let result: LoadSharedLocationStateResult<T>;
    try {
      result = await this.repository.load(this.locationId);
    } catch {
      return this.handleLoadFailure(
        mode,
        epoch,
        'Shared Petalon data could not be loaded.',
        true,
      );
    }

    if (epoch !== this.loadEpoch || this.deactivated) {
      return null;
    }

    if (result.status === 'not-found') {
      if (mode === 'background') {
        this.paused = true;
        this.publish({
          status: 'unavailable',
          phase: 'load',
          message: 'Shared Petalon operational data is no longer available.',
          retryable: false,
          ...(this.pendingRecord ? { pendingPreserved: true as const } : {}),
        });
      } else {
        this.publish({ status: 'not-found' });
      }
      return null;
    }

    if (result.status === 'unavailable') {
      return this.handleLoadFailure(
        mode,
        epoch,
        result.error.message,
        result.error.retryable,
      );
    }

    const normalized = this.normalizeSharedValue(result.value);
    if (!normalized) {
      return this.handleLoadFailure(
        mode,
        epoch,
        'Shared Petalon data is not valid operational application data.',
        false,
      );
    }

    if (mode === 'background') {
      if (this.desiredState !== null || this.saveInFlight) {
        this.invalidatedRevision = Math.max(
          this.invalidatedRevision ?? normalized.revision,
          normalized.revision,
        );
        if (this.state.status === 'ready') {
          this.publish({ ...this.state, refreshStatus: 'idle', syncMessage: undefined });
        }
        return normalized.revision;
      }

      this.confirmed = normalized;
      this.revision = normalized.revision;
      this.paused = false;
      this.publishReady(normalized, 'saved', 'idle');
      return normalized.revision;
    }

    return this.restorePendingState(normalized, epoch);
  }

  private handleLoadFailure(
    mode: 'initial' | 'background',
    epoch: number,
    message: string,
    retryable: boolean,
  ): null {
    if (epoch !== this.loadEpoch || this.deactivated) {
      return null;
    }

    if (mode === 'background' && retryable && this.state.status === 'ready') {
      this.publish({
        ...this.state,
        refreshStatus: 'stale',
        syncMessage: 'Connection interrupted — showing the last confirmed shared data.',
      });
      return null;
    }

    this.paused = true;
    this.publish({
      status: 'unavailable',
      phase: 'load',
      message,
      retryable,
      ...(this.pendingRecord ? { pendingPreserved: true as const } : {}),
    });
    return null;
  }

  private async restorePendingState(
    server: SharedLocationState<T>,
    epoch: number,
  ): Promise<number | null> {
    let pending: PendingSharedStateRecord<T> | null;
    try {
      pending = await this.pendingStore.load(this.userId, this.locationId);
    } catch {
      if (epoch === this.loadEpoch && !this.deactivated) {
        this.publish({
          status: 'unavailable',
          phase: 'load',
          message: 'Unsaved-change recovery storage is unavailable on this device.',
          retryable: true,
        });
      }
      return null;
    }

    if (epoch !== this.loadEpoch || this.deactivated) {
      return null;
    }

    this.confirmed = server;
    this.revision = server.revision;
    this.generation += 1;

    if (!pending) {
      this.resetPendingMemory();
      this.paused = false;
      this.publishReady(server, 'saved', 'idle');
      return server.revision;
    }

    const normalizedPending = this.normalizePendingRecord(pending);
    if (!normalizedPending) {
      this.paused = true;
      this.publish({
        status: 'unavailable',
        phase: 'load',
        message: 'Preserved unsaved Petalon data is invalid and was not submitted.',
        retryable: false,
        pendingPreserved: true,
      });
      return null;
    }

    this.pendingRecord = normalizedPending;
    this.pendingWriteVersion = 1;
    this.persistedWriteVersion = 1;
    this.desiredState = normalizedPending.desiredState;

    if (
      server.revision === normalizedPending.baseRevision &&
      this.equals(server.state, normalizedPending.baseState)
    ) {
      this.paused = false;
      this.publishLocalReady('pending', 'idle', 'Unsaved changes recovered — retrying.');
      void this.drainSaves();
      return server.revision;
    }

    if (
      server.revision > normalizedPending.baseRevision &&
      this.equals(server.state, normalizedPending.desiredState)
    ) {
      await this.removePendingRecord();
      if (epoch !== this.loadEpoch || this.deactivated) {
        return null;
      }
      this.resetPendingMemory();
      this.paused = false;
      this.publishReady(server, 'saved', 'idle');
      return server.revision;
    }

    if (
      normalizedPending.attemptedState !== undefined &&
      normalizedPending.attemptedRevision !== undefined &&
      server.revision === normalizedPending.attemptedRevision + 1 &&
      this.equals(server.state, normalizedPending.attemptedState)
    ) {
      await this.resumePendingAgainstServer(
        server,
        normalizedPending.desiredState,
        epoch,
        'The previous save reached Petalon. Remaining changes recovered — retrying.',
      );
      return server.revision;
    }

    const reconciled = this.reconcilePendingState?.(
      normalizedPending.baseState,
      normalizedPending.desiredState,
      server.state,
    );
    if (reconciled) {
      if (this.equals(reconciled, server.state)) {
        await this.removePendingRecord();
        if (epoch !== this.loadEpoch || this.deactivated) {
          return null;
        }
        this.resetPendingMemory();
        this.paused = false;
        this.publishReady(server, 'saved', 'idle');
        return server.revision;
      }

      await this.resumePendingAgainstServer(
        server,
        reconciled,
        epoch,
        'Compatible preserved changes recovered — retrying.',
      );
      return server.revision;
    }

    this.paused = true;
    this.publish({
      status: 'conflict',
      local: normalizedPending.desiredState,
      current: server,
      pendingPreserved: true,
    });
    return server.revision;
  }

  private async resumePendingAgainstServer(
    server: SharedLocationState<T>,
    desiredState: T,
    epoch: number,
    message: string,
  ): Promise<void> {
    this.confirmed = server;
    this.revision = server.revision;
    this.desiredState = desiredState;
    this.pendingRecord = this.pendingRecord
      ? {
          ...this.pendingRecord,
          baseRevision: server.revision,
          baseState: server.state,
          desiredState,
          attemptedRevision: undefined,
          attemptedState: undefined,
        }
      : null;
    this.paused = false;
    this.publishLocalReady('pending', 'idle', message);
    await this.persistLatestDesiredState();
    if (epoch !== this.loadEpoch || this.deactivated) {
      return;
    }
  }

  private normalizePendingRecord(
    record: PendingSharedStateRecord<T>,
  ): PendingSharedStateRecord<T> | null {
    if (
      record.userId !== this.userId ||
      record.locationId !== this.locationId ||
      !Number.isSafeInteger(record.baseRevision) ||
      record.baseRevision < 0
    ) {
      return null;
    }

    const baseState = this.normalize(record.baseState);
    const desiredState = this.normalize(record.desiredState);
    if (!baseState || !desiredState) {
      return null;
    }

    const hasAttemptMetadata =
      record.attemptedRevision !== undefined || record.attemptedState !== undefined;
    const attemptedState =
      record.attemptedState === undefined ? null : this.normalize(record.attemptedState);
    const hasValidAttemptMetadata =
      hasAttemptMetadata &&
      Number.isSafeInteger(record.attemptedRevision) &&
      (record.attemptedRevision ?? -1) >= 0 &&
      attemptedState !== null;

    return {
      ...record,
      baseState,
      desiredState,
      ...(hasValidAttemptMetadata
        ? {
            attemptedRevision: record.attemptedRevision,
            attemptedState,
          }
        : {
            attemptedRevision: undefined,
            attemptedState: undefined,
          }),
    };
  }

  private async persistLatestDesiredState(): Promise<void> {
    if (!this.confirmed || !this.desiredState || this.deactivated) {
      return;
    }

    const timestamp = this.now();
    const record: PendingSharedStateRecord<T> = {
      userId: this.userId,
      locationId: this.locationId,
      baseRevision: this.confirmed.revision,
      baseState: this.confirmed.state,
      desiredState: this.desiredState,
      ...(this.pendingRecord?.attemptedRevision !== undefined &&
      this.pendingRecord.attemptedState !== undefined
        ? {
            attemptedRevision: this.pendingRecord.attemptedRevision,
            attemptedState: this.pendingRecord.attemptedState,
          }
        : {}),
      createdAt: this.pendingRecord?.createdAt ?? timestamp,
      updatedAt: timestamp,
    };
    this.pendingRecord = record;
    const version = ++this.pendingWriteVersion;
    const epoch = this.loadEpoch;
    const saveRecord = async () => this.pendingStore.save(record);
    const operation = this.persistenceQueue.then(saveRecord, saveRecord);
    this.persistenceQueue = operation.catch(() => undefined);

    try {
      await operation;
    } catch {
      if (epoch === this.loadEpoch && !this.deactivated && version === this.pendingWriteVersion) {
        this.retryWaiting = true;
        this.publishLocalReady(
          'pending',
          'stale',
          'Not saved yet — device recovery storage is retrying.',
        );
        this.scheduleSaveRetry();
      }
      return;
    }

    if (epoch !== this.loadEpoch || this.deactivated || version !== this.pendingWriteVersion) {
      return;
    }

    this.persistedWriteVersion = version;
    void this.drainSaves();
  }

  private async drainSaves(): Promise<void> {
    if (
      this.deactivated ||
      this.saveInFlight ||
      this.paused ||
      this.retryWaiting ||
      this.desiredState === null ||
      this.revision === null ||
      this.persistedWriteVersion !== this.pendingWriteVersion
    ) {
      return;
    }

    const epoch = this.loadEpoch;
    const stateToSave = this.desiredState;
    const expectedRevision = this.revision;
    this.saveInFlight = true;
    this.publishLocalReady('saving', this.currentRefreshStatus());

    if (!(await this.persistSaveAttempt(expectedRevision, stateToSave, epoch))) {
      this.saveInFlight = false;
      if (epoch === this.loadEpoch && !this.deactivated) {
        this.handleRetryableSaveFailure(
          'The save attempt could not be secured in device recovery storage.',
        );
      }
      return;
    }

    let result: SaveSharedLocationStateResult<T>;
    try {
      result = await this.repository.save(this.locationId, expectedRevision, stateToSave);
    } catch {
      this.saveInFlight = false;
      if (epoch === this.loadEpoch && !this.deactivated) {
        this.handleRetryableSaveFailure('Shared Petalon data could not be saved.');
      }
      return;
    }
    this.saveInFlight = false;

    if (epoch !== this.loadEpoch || this.deactivated) {
      return;
    }

    if (result.status === 'conflict') {
      const current = result.current ? this.normalizeSharedValue(result.current) : null;
      if (result.current && !current) {
        this.paused = true;
        this.publish({
          status: 'unavailable',
          phase: 'save',
          message: 'The newer shared Petalon data is not valid operational application data.',
          retryable: false,
          local: this.desiredState ?? stateToSave,
          pendingPreserved: true,
        });
        return;
      }

      if (current && this.equals(current.state, stateToSave)) {
        await this.acceptSavedState(current, stateToSave, epoch);
        return;
      }

      this.paused = true;
      this.publish({
        status: 'conflict',
        local: this.desiredState ?? stateToSave,
        current,
        pendingPreserved: true,
      });
      return;
    }

    if (result.status === 'unavailable') {
      if (result.error.retryable) {
        this.handleRetryableSaveFailure(result.error.message);
      } else {
        this.paused = true;
        this.publish({
          status: 'unavailable',
          phase: 'save',
          message: result.error.message,
          retryable: false,
          local: this.desiredState ?? stateToSave,
          pendingPreserved: true,
        });
      }
      return;
    }

    const accepted = this.normalizeSharedValue(result.value);
    if (!accepted || accepted.revision !== expectedRevision + 1) {
      this.paused = true;
      this.publish({
        status: 'unavailable',
        phase: 'save',
        message: 'Shared Petalon returned an invalid accepted save result.',
        retryable: false,
        local: this.desiredState ?? stateToSave,
        pendingPreserved: true,
      });
      return;
    }

    await this.acceptSavedState(accepted, stateToSave, epoch);
  }

  private async persistSaveAttempt(
    expectedRevision: number,
    stateToSave: T,
    epoch: number,
  ): Promise<boolean> {
    if (!this.pendingRecord) {
      return false;
    }

    const attemptedRecord: PendingSharedStateRecord<T> = {
      ...this.pendingRecord,
      attemptedRevision: expectedRevision,
      attemptedState: stateToSave,
      updatedAt: this.now(),
    };
    this.pendingRecord = attemptedRecord;
    const saveAttempt = async () => this.pendingStore.save(attemptedRecord);
    const operation = this.persistenceQueue.then(saveAttempt, saveAttempt);
    this.persistenceQueue = operation.catch(() => undefined);

    try {
      await operation;
      await this.persistenceQueue;
    } catch {
      return false;
    }

    return epoch === this.loadEpoch && !this.deactivated;
  }

  private async acceptSavedState(
    accepted: SharedLocationState<T>,
    stateToSave: T,
    epoch: number,
  ): Promise<void> {
    this.confirmed = accepted;
    this.revision = accepted.revision;
    this.retryAttempt = 0;
    this.retryWaiting = false;
    this.cancelRetry();
    const acceptedWriteVersion = this.pendingWriteVersion;
    if (this.pendingRecord) {
      this.pendingRecord = {
        ...this.pendingRecord,
        attemptedRevision: undefined,
        attemptedState: undefined,
      };
    }

    const newerDesired =
      this.desiredState !== null && !this.equals(this.desiredState, stateToSave);
    if (newerDesired) {
      this.publishLocalReady('saving', 'idle');
      await this.persistLatestDesiredState();
      return;
    }

    await this.removePendingRecord();
    if (epoch !== this.loadEpoch || this.deactivated) {
      return;
    }

    if (
      this.pendingWriteVersion !== acceptedWriteVersion ||
      (this.desiredState !== null && !this.equals(this.desiredState, stateToSave))
    ) {
      this.publishLocalReady('saving', 'idle');
      void this.persistLatestDesiredState();
      return;
    }

    this.resetPendingMemory();
    this.paused = false;
    this.publishReady(accepted, 'saved', 'idle');
    void this.drainRemoteInvalidations();
  }

  private handleRetryableSaveFailure(message: string): void {
    this.retryWaiting = true;
    this.publishLocalReady(
      'pending',
      'stale',
      `${message} Changes are preserved on this device and will retry.`,
    );
    this.scheduleSaveRetry();
  }

  private scheduleSaveRetry(): void {
    if (this.cancelScheduledRetry || this.deactivated) {
      return;
    }

    const index = Math.min(this.retryAttempt, this.retryDelaysMs.length - 1);
    const delay = this.retryDelaysMs[index];
    this.retryAttempt += 1;
    this.cancelScheduledRetry = this.scheduleRetryCallback(() => {
      this.cancelScheduledRetry = null;
      this.retryPendingSave();
    }, delay);
  }

  private retryPendingSave(): void {
    if (this.deactivated || this.desiredState === null || this.paused) {
      return;
    }

    this.cancelRetry();
    this.retryWaiting = false;
    if (this.persistedWriteVersion !== this.pendingWriteVersion) {
      void this.persistLatestDesiredState();
      return;
    }
    void this.drainSaves();
  }

  private cancelRetry(): void {
    this.cancelScheduledRetry?.();
    this.cancelScheduledRetry = null;
  }

  private async removePendingRecord(): Promise<void> {
    try {
      await this.pendingStore.remove(this.userId, this.locationId);
    } catch {
      // The accepted server row remains authoritative. If this stale recovery
      // record survives, the next startup recognizes that its desired state is
      // already on the server and removes it without duplicating the mutation.
    }
  }

  private resetPendingMemory(): void {
    this.desiredState = null;
    this.pendingRecord = null;
    this.pendingWriteVersion = 0;
    this.persistedWriteVersion = 0;
    this.retryWaiting = false;
    this.retryAttempt = 0;
  }

  private handleRemoteInvalidation(invalidation: SharedLocationStateInvalidation): void {
    if (
      !this.active ||
      invalidation.locationId !== this.locationId ||
      (invalidation.revision !== undefined &&
        (!Number.isSafeInteger(invalidation.revision) || invalidation.revision < 0)) ||
      this.state.status === 'conflict' ||
      this.state.status === 'unavailable' ||
      this.state.status === 'not-found'
    ) {
      return;
    }

    if (
      invalidation.revision !== undefined &&
      this.revision !== null &&
      invalidation.revision <= this.revision
    ) {
      return;
    }

    if (invalidation.revision === undefined) {
      this.unversionedInvalidationPending = true;
    } else {
      this.invalidatedRevision = Math.max(
        this.invalidatedRevision ?? invalidation.revision,
        invalidation.revision,
      );
    }
    void this.drainRemoteInvalidations();
  }

  private async drainRemoteInvalidations(): Promise<void> {
    if (
      !this.active ||
      this.automaticReloadInFlight ||
      this.saveInFlight ||
      this.desiredState !== null ||
      this.paused ||
      this.revision === null ||
      this.state.status !== 'ready' ||
      this.state.syncStatus !== 'saved' ||
      (!this.unversionedInvalidationPending && this.invalidatedRevision === null)
    ) {
      return;
    }

    if (this.invalidatedRevision !== null && this.invalidatedRevision <= this.revision) {
      this.invalidatedRevision = null;
      if (!this.unversionedInvalidationPending) {
        this.lastAutomaticReloadTarget = null;
        return;
      }
    }

    if (
      !this.unversionedInvalidationPending &&
      this.lastAutomaticReloadTarget !== null &&
      this.invalidatedRevision !== null &&
      this.invalidatedRevision <= this.lastAutomaticReloadTarget
    ) {
      return;
    }

    const targetRevision = this.invalidatedRevision;
    this.invalidatedRevision = null;
    this.unversionedInvalidationPending = false;
    this.lastAutomaticReloadTarget = targetRevision;
    this.automaticReloadInFlight = true;
    const loadedRevision = await this.loadAuthoritativeState('background');
    this.automaticReloadInFlight = false;

    if (!this.active) {
      return;
    }

    if (loadedRevision !== null && targetRevision !== null && loadedRevision < targetRevision) {
      this.invalidatedRevision = Math.max(
        this.invalidatedRevision ?? targetRevision,
        targetRevision,
      );
    }

    void this.drainRemoteInvalidations();
  }

  private normalizeSharedValue(value: SharedLocationState<T>): SharedLocationState<T> | null {
    if (
      value.locationId !== this.locationId ||
      !Number.isSafeInteger(value.revision) ||
      value.revision < 0
    ) {
      return null;
    }

    const state = this.normalize(value.state);
    return state ? { ...value, state } : null;
  }

  private currentRefreshStatus(): SharedRefreshStatus {
    return this.state.status === 'ready' ? this.state.refreshStatus : 'idle';
  }

  private publishLocalReady(
    syncStatus: SharedSyncStatus,
    refreshStatus: SharedRefreshStatus,
    syncMessage?: string,
  ): void {
    if (!this.confirmed || !this.desiredState) {
      return;
    }

    this.publish({
      status: 'ready',
      data: this.desiredState,
      revision: this.confirmed.revision,
      generation: this.generation,
      syncStatus,
      refreshStatus,
      ...(syncMessage ? { syncMessage } : {}),
      updatedAt: this.confirmed.updatedAt,
      ...(this.confirmed.updatedBy ? { updatedBy: this.confirmed.updatedBy } : {}),
    });
  }

  private publishReady(
    value: SharedLocationState<T>,
    syncStatus: SharedSyncStatus,
    refreshStatus: SharedRefreshStatus,
  ): void {
    this.publish({
      status: 'ready',
      data: value.state,
      revision: value.revision,
      generation: this.generation,
      syncStatus,
      refreshStatus,
      updatedAt: value.updatedAt,
      ...(value.updatedBy ? { updatedBy: value.updatedBy } : {}),
    });
  }

  private publish(state: SharedStateControllerState<T>): void {
    this.state = state;
    this.listeners.forEach((listener) => listener(state));
  }
}
