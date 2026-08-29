export type SharedLocationState<T> = {
  locationId: string;
  state: T;
  revision: number;
  updatedAt: string;
  updatedBy?: string;
};

export type SharedStateRepositoryError = {
  message: string;
  retryable: boolean;
};

export type LoadSharedLocationStateResult<T> =
  | { status: 'found'; value: SharedLocationState<T> }
  | { status: 'not-found' }
  | { status: 'unavailable'; error: SharedStateRepositoryError };

export type SaveSharedLocationStateResult<T> =
  | { status: 'accepted'; value: SharedLocationState<T> }
  | {
      status: 'conflict';
      current: SharedLocationState<T> | null;
      /** True only when the server proved every intermediate accepted revision is monotonic. */
      revisionChainVerified?: boolean;
    }
  | { status: 'unavailable'; error: SharedStateRepositoryError };

export type SharedLocationStateInvalidation = {
  locationId: string;
  /** Omitted when a channel subscribe/reconnect means events may have been missed. */
  revision?: number;
};

export type SharedLocationStateListener = (
  invalidation: SharedLocationStateInvalidation,
) => void;
export type Unsubscribe = () => void;

/**
 * Application-facing contract for future versioned shared location state.
 * Implementations deliberately hide transport/provider response objects.
 */
export interface SharedLocationStateRepository<T> {
  load(locationId: string): Promise<LoadSharedLocationStateResult<T>>;
  save(
    locationId: string,
    expectedRevision: number,
    nextState: T,
  ): Promise<SaveSharedLocationStateResult<T>>;
  subscribe(locationId: string, listener: SharedLocationStateListener): Unsubscribe;
}
