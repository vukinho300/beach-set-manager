import type {
  LoadSharedLocationStateResult,
  SaveSharedLocationStateResult,
  SharedLocationState,
  SharedLocationStateRepository,
} from './repository';

export type SharedStateControllerState<T> =
  | { status: 'loading' }
  | {
      status: 'ready';
      data: T;
      revision: number;
      generation: number;
      syncStatus: 'saved' | 'saving';
      updatedAt: string;
      updatedBy?: string;
    }
  | { status: 'not-found' }
  | {
      status: 'conflict';
      local: T;
      current: SharedLocationState<T> | null;
    }
  | {
      status: 'unavailable';
      phase: 'load' | 'save';
      message: string;
      retryable: boolean;
      local?: T;
    };

export type NormalizeSharedState<T> = (value: unknown) => T | null;
export type SharedStateControllerListener<T> = (
  state: SharedStateControllerState<T>,
) => void;

function areJsonStatesEqual<T>(first: T, second: T): boolean {
  if (Object.is(first, second)) {
    return true;
  }

  if (Array.isArray(first) || Array.isArray(second)) {
    return (
      Array.isArray(first) &&
      Array.isArray(second) &&
      first.length === second.length &&
      first.every((value, index) => areJsonStatesEqual(value, second[index]))
    );
  }

  if (
    !first ||
    !second ||
    typeof first !== 'object' ||
    typeof second !== 'object'
  ) {
    return false;
  }

  const firstRecord = first as Record<string, unknown>;
  const secondRecord = second as Record<string, unknown>;
  const firstKeys = Object.keys(firstRecord).filter(
    (key) => firstRecord[key] !== undefined,
  );
  const secondKeys = Object.keys(secondRecord).filter(
    (key) => secondRecord[key] !== undefined,
  );

  return (
    firstKeys.length === secondKeys.length &&
    firstKeys.every(
      (key) =>
        Object.prototype.hasOwnProperty.call(secondRecord, key) &&
        areJsonStatesEqual(firstRecord[key], secondRecord[key]),
    )
  );
}

export class SharedStateController<T> {
  private state: SharedStateControllerState<T> = { status: 'loading' };
  private readonly listeners = new Set<SharedStateControllerListener<T>>();
  private revision: number | null = null;
  private generation = 0;
  private loadEpoch = 0;
  private saveInFlight = false;
  private pendingState: T | null = null;
  private paused = true;

  constructor(
    private readonly repository: SharedLocationStateRepository<T>,
    private readonly locationId: string,
    private readonly normalize: NormalizeSharedState<T>,
    private readonly equals: (first: T, second: T) => boolean = areJsonStatesEqual,
  ) {}

  getSnapshot(): SharedStateControllerState<T> {
    return this.state;
  }

  observe(listener: SharedStateControllerListener<T>): () => void {
    this.listeners.add(listener);
    listener(this.state);

    return () => {
      this.listeners.delete(listener);
    };
  }

  async reload(): Promise<void> {
    const epoch = ++this.loadEpoch;
    this.paused = true;
    this.pendingState = null;
    this.revision = null;
    this.publish({ status: 'loading' });

    let result: LoadSharedLocationStateResult<T>;

    try {
      result = await this.repository.load(this.locationId);
    } catch {
      if (epoch === this.loadEpoch) {
        this.publish({
          status: 'unavailable',
          phase: 'load',
          message: 'Shared Petalon data could not be loaded.',
          retryable: true,
        });
      }
      return;
    }

    if (epoch !== this.loadEpoch) {
      return;
    }

    if (result.status === 'not-found') {
      this.publish({ status: 'not-found' });
      return;
    }

    if (result.status === 'unavailable') {
      this.publish({
        status: 'unavailable',
        phase: 'load',
        message: result.error.message,
        retryable: result.error.retryable,
      });
      return;
    }

    const normalized = this.normalizeSharedValue(result.value);

    if (!normalized) {
      this.publish({
        status: 'unavailable',
        phase: 'load',
        message: 'Shared Petalon data is not valid operational application data.',
        retryable: false,
      });
      return;
    }

    this.revision = normalized.revision;
    this.generation += 1;
    this.paused = false;
    this.publishReady(normalized, 'saved');
  }

  update(nextState: T): void {
    if (this.paused || this.state.status !== 'ready') {
      return;
    }

    if (this.equals(nextState, this.state.data)) {
      return;
    }

    this.pendingState = nextState;
    this.publish({
      ...this.state,
      data: nextState,
      syncStatus: 'saving',
    });
    void this.drainSaves();
  }

  private async drainSaves(): Promise<void> {
    if (
      this.saveInFlight ||
      this.paused ||
      this.pendingState === null ||
      this.revision === null
    ) {
      return;
    }

    const epoch = this.loadEpoch;
    const stateToSave = this.pendingState;
    const expectedRevision = this.revision;
    this.pendingState = null;
    this.saveInFlight = true;

    let result: SaveSharedLocationStateResult<T>;

    try {
      result = await this.repository.save(
        this.locationId,
        expectedRevision,
        stateToSave,
      );
    } catch {
      this.saveInFlight = false;
      if (epoch === this.loadEpoch) {
        this.paused = true;
        this.pendingState = null;
        this.publish({
          status: 'unavailable',
          phase: 'save',
          message: 'Shared Petalon data could not be saved.',
          retryable: true,
          local: this.latestLocalState(stateToSave),
        });
      }
      return;
    }
    this.saveInFlight = false;

    if (epoch !== this.loadEpoch) {
      void this.drainSaves();
      return;
    }

    if (result.status === 'conflict') {
      const current = result.current
        ? this.normalizeSharedValue(result.current)
        : null;

      if (result.current && !current) {
        this.paused = true;
        this.pendingState = null;
        this.publish({
          status: 'unavailable',
          phase: 'save',
          message: 'The newer shared Petalon data is not valid operational application data.',
          retryable: false,
          local: this.latestLocalState(stateToSave),
        });
        return;
      }

      this.paused = true;
      this.pendingState = null;
      this.publish({
        status: 'conflict',
        local: this.latestLocalState(stateToSave),
        current,
      });
      return;
    }

    if (result.status === 'unavailable') {
      this.paused = true;
      this.pendingState = null;
      this.publish({
        status: 'unavailable',
        phase: 'save',
        message: result.error.message,
        retryable: result.error.retryable,
        local: this.latestLocalState(stateToSave),
      });
      return;
    }

    const accepted = this.normalizeSharedValue(result.value);

    if (!accepted || accepted.revision !== expectedRevision + 1) {
      this.paused = true;
      this.pendingState = null;
      this.publish({
        status: 'unavailable',
        phase: 'save',
        message: 'Shared Petalon returned an invalid accepted save result.',
        retryable: false,
        local: this.latestLocalState(stateToSave),
      });
      return;
    }

    this.revision = accepted.revision;

    if (this.pendingState === null || this.equals(this.pendingState, accepted.state)) {
      this.pendingState = null;
      this.publishReady(accepted, 'saved');
      return;
    }

    this.publish({
      status: 'ready',
      data: this.pendingState,
      revision: accepted.revision,
      generation: this.generation,
      syncStatus: 'saving',
      updatedAt: accepted.updatedAt,
      ...(accepted.updatedBy ? { updatedBy: accepted.updatedBy } : {}),
    });
    void this.drainSaves();
  }

  private normalizeSharedValue(
    value: SharedLocationState<T>,
  ): SharedLocationState<T> | null {
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

  private latestLocalState(fallback: T): T {
    return this.state.status === 'ready' ? this.state.data : fallback;
  }

  private publishReady(
    value: SharedLocationState<T>,
    syncStatus: 'saved' | 'saving',
  ): void {
    this.publish({
      status: 'ready',
      data: value.state,
      revision: value.revision,
      generation: this.generation,
      syncStatus,
      updatedAt: value.updatedAt,
      ...(value.updatedBy ? { updatedBy: value.updatedBy } : {}),
    });
  }

  private publish(state: SharedStateControllerState<T>): void {
    this.state = state;
    this.listeners.forEach((listener) => listener(state));
  }
}
