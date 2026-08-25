import type { SupabaseClient } from '@supabase/supabase-js';
import type { Json, Database, Tables } from '../supabase/database.types';
import { getSupabaseClient } from '../supabase/client';
import type {
  LoadSharedLocationStateResult,
  SaveSharedLocationStateResult,
  SharedLocationState,
  SharedLocationStateRepository,
  SharedStateRepositoryError,
  Unsubscribe,
} from './repository';

const LOCATION_STATE_COLUMNS =
  'location_id,state,revision,updated_at,updated_by' as const;

type LocationStateRow = Tables<'location_state'>;
type ProviderError = {
  code?: string;
};

const ACCESS_ERROR_CODES = new Set(['42501', 'PGRST301', 'PGRST302']);

function mapState<T>(row: LocationStateRow): SharedLocationState<T> {
  return {
    locationId: row.location_id,
    // The repository's caller owns T. The generated database contract proves
    // the transport value is JSON; this is the sole JSON -> T boundary.
    state: row.state as T,
    revision: row.revision,
    updatedAt: row.updated_at,
    ...(row.updated_by === null ? {} : { updatedBy: row.updated_by }),
  };
}

function unavailable(
  message: string,
  retryable: boolean,
): { status: 'unavailable'; error: SharedStateRepositoryError } {
  return {
    status: 'unavailable',
    error: { message, retryable },
  };
}

function providerUnavailable(
  operation: 'loaded' | 'saved' | 'checked',
  error: ProviderError,
): { status: 'unavailable'; error: SharedStateRepositoryError } {
  const accessDenied = error.code !== undefined && ACCESS_ERROR_CODES.has(error.code);

  return unavailable(
    accessDenied
      ? 'Shared location state access was denied.'
      : `Shared location state could not be ${operation}.`,
    !accessDenied,
  );
}

class SupabaseSharedLocationStateRepository<T>
  implements SharedLocationStateRepository<T>
{
  constructor(private readonly client: SupabaseClient<Database> | null) {}

  async load(locationId: string): Promise<LoadSharedLocationStateResult<T>> {
    if (!this.client) {
      return unavailable(
        'Shared location state is unavailable because Supabase is not configured.',
        false,
      );
    }

    const stateResult = await this.readState(locationId);

    if (stateResult.status === 'unavailable') {
      return stateResult;
    }

    if (stateResult.row) {
      return { status: 'found', value: mapState<T>(stateResult.row) };
    }

    return this.classifyMissingState(locationId);
  }

  async save(
    locationId: string,
    expectedRevision: number,
    nextState: T,
  ): Promise<SaveSharedLocationStateResult<T>> {
    if (!this.client) {
      return unavailable(
        'Shared location state is unavailable because Supabase is not configured.',
        false,
      );
    }

    // T is application-owned while the generated transport type is Json. The
    // database and PostgREST remain responsible for rejecting non-JSON values.
    const update = { state: nextState as Json };
    const { data, error } = await this.client
      .from('location_state')
      .update(update)
      .eq('location_id', locationId)
      .eq('revision', expectedRevision)
      .select(LOCATION_STATE_COLUMNS);

    if (error) {
      return providerUnavailable('saved', error);
    }

    if (data === null) {
      return unavailable('Shared location state returned no save result.', true);
    }

    if (data.length === 1) {
      return { status: 'accepted', value: mapState<T>(data[0]) };
    }

    if (data.length > 1) {
      return unavailable(
        'Shared location state returned an invalid multi-row save result.',
        false,
      );
    }

    return this.classifyZeroRowSave(locationId, expectedRevision);
  }

  subscribe(
    locationId: string,
    listener: (value: SharedLocationState<T>) => void,
  ): Unsubscribe {
    // Realtime is intentionally deferred. The stable no-op unsubscribe keeps
    // the repository contract safe without opening a Supabase channel.
    void locationId;
    void listener;
    return () => undefined;
  }

  private async readState(
    locationId: string,
  ): Promise<
    | { status: 'ok'; row: LocationStateRow | null }
    | { status: 'unavailable'; error: SharedStateRepositoryError }
  > {
    if (!this.client) {
      return unavailable(
        'Shared location state is unavailable because Supabase is not configured.',
        false,
      );
    }

    const { data, error } = await this.client
      .from('location_state')
      .select(LOCATION_STATE_COLUMNS)
      .eq('location_id', locationId)
      .limit(2);

    if (error) {
      return providerUnavailable('loaded', error);
    }

    if (data === null) {
      return unavailable('Shared location state returned no load result.', true);
    }

    if (data.length > 1) {
      return unavailable(
        'Shared location state returned an invalid multi-row load result.',
        false,
      );
    }

    return { status: 'ok', row: data[0] ?? null };
  }

  private async classifyMissingState(
    locationId: string,
  ): Promise<LoadSharedLocationStateResult<T>> {
    if (!this.client) {
      return unavailable(
        'Shared location state is unavailable because Supabase is not configured.',
        false,
      );
    }

    // Own-membership rows remain RLS-visible even when inactive. This lets the
    // adapter distinguish an active location with no state from revoked or
    // absent access without weakening RLS.
    const { data, error } = await this.client
      .from('location_memberships')
      .select('active')
      .eq('location_id', locationId)
      .limit(2);

    if (error) {
      return providerUnavailable('checked', error);
    }

    if (data === null) {
      return unavailable('Shared location access returned no result.', true);
    }

    if (data.length === 1 && data[0].active) {
      return { status: 'not-found' };
    }

    return unavailable('Shared location state is not accessible for the current user.', false);
  }

  private async classifyZeroRowSave(
    locationId: string,
    expectedRevision: number,
  ): Promise<SaveSharedLocationStateResult<T>> {
    const current = await this.readState(locationId);

    if (current.status === 'unavailable') {
      return current;
    }

    if (current.row) {
      if (current.row.revision !== expectedRevision) {
        return { status: 'conflict', current: mapState<T>(current.row) };
      }

      return unavailable(
        'Conditional shared location state update was not accepted.',
        false,
      );
    }

    const missing = await this.classifyMissingState(locationId);

    if (missing.status === 'not-found') {
      return { status: 'conflict', current: null };
    }

    if (missing.status === 'unavailable') {
      return missing;
    }

    return unavailable('Shared location state could not be checked.', true);
  }
}

/**
 * Creates the Step 4 Supabase-backed repository. Supplying a client is a
 * focused test seam; production callers use the existing lazy browser client.
 */
export function createSupabaseSharedLocationStateRepository<T>(
  client: SupabaseClient<Database> | null = getSupabaseClient(),
): SharedLocationStateRepository<T> {
  return new SupabaseSharedLocationStateRepository<T>(client);
}
