import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import type { Database, Tables } from '../supabase/database.types';
import { createSupabaseSharedLocationStateRepository } from './supabaseRepository';

type LocationStateRow = Tables<'location_state'>;
type QueryResponse = {
  data: unknown[] | null;
  error: { code?: string } | null;
};
type QueryCall = {
  table: string;
  operation: 'select' | 'update';
  columns: string;
  filters: Array<[string, unknown]>;
  limit?: number;
  payload?: unknown;
};

const LOCATION_ID = '00000000-0000-4000-8000-000000000001';

function stateRow(
  revision: number,
  state: LocationStateRow['state'] = { reservations: [] },
  updatedBy: string | null = 'b5771919-8ee9-49d5-b7f5-8e634ee1dcbf',
): LocationStateRow {
  return {
    location_id: LOCATION_ID,
    state,
    revision,
    updated_at: '2026-08-25T12:34:56.000Z',
    updated_by: updatedBy,
  };
}

class FakeSupabaseClient {
  readonly calls: QueryCall[] = [];
  readonly channel = vi.fn();
  private readonly selectResponses = new Map<string, QueryResponse[]>();
  private readonly updateResponses = new Map<string, QueryResponse[]>();

  queueSelect(table: string, response: QueryResponse) {
    this.queue(this.selectResponses, table, response);
  }

  queueUpdate(table: string, response: QueryResponse) {
    this.queue(this.updateResponses, table, response);
  }

  from(table: string) {
    return {
      select: (columns: string) => {
        const filters: Array<[string, unknown]> = [];

        return {
          eq: (column: string, value: unknown) => {
            filters.push([column, value]);

            return {
              limit: (limit: number) => {
                this.calls.push({ table, operation: 'select', columns, filters, limit });
                return Promise.resolve(this.take(this.selectResponses, table));
              },
            };
          },
        };
      },
      update: (payload: unknown) => {
        const filters: Array<[string, unknown]> = [];
        const chain = {
          eq: (column: string, value: unknown) => {
            filters.push([column, value]);
            return chain;
          },
          select: (columns: string) => {
            this.calls.push({
              table,
              operation: 'update',
              columns,
              filters,
              payload,
            });
            return Promise.resolve(this.take(this.updateResponses, table));
          },
        };

        return chain;
      },
    };
  }

  asClient(): SupabaseClient<Database> {
    return this as unknown as SupabaseClient<Database>;
  }

  private queue(
    target: Map<string, QueryResponse[]>,
    table: string,
    response: QueryResponse,
  ) {
    target.set(table, [...(target.get(table) ?? []), response]);
  }

  private take(target: Map<string, QueryResponse[]>, table: string): QueryResponse {
    const responses = target.get(table) ?? [];
    const response = responses.shift();

    if (!response) {
      throw new Error(`No fake response queued for ${table}.`);
    }

    target.set(table, responses);
    return response;
  }
}

describe('Supabase shared location state repository', () => {
  it('maps a visible state row and omits nullable updated_by', async () => {
    const fake = new FakeSupabaseClient();
    fake.queueSelect('location_state', { data: [stateRow(4, { sales: 3 }, null)], error: null });
    const repository = createSupabaseSharedLocationStateRepository<{ sales: number }>(
      fake.asClient(),
    );

    const result = await repository.load(LOCATION_ID);

    expect(result).toEqual({
      status: 'found',
      value: {
        locationId: LOCATION_ID,
        state: { sales: 3 },
        revision: 4,
        updatedAt: '2026-08-25T12:34:56.000Z',
      },
    });
  });

  it('returns not-found only when the caller has a visible active membership', async () => {
    const fake = new FakeSupabaseClient();
    fake.queueSelect('location_state', { data: [], error: null });
    fake.queueSelect('location_memberships', { data: [{ active: true }], error: null });
    const repository = createSupabaseSharedLocationStateRepository(fake.asClient());

    await expect(repository.load(LOCATION_ID)).resolves.toEqual({ status: 'not-found' });
  });

  it('does not disguise an RLS-hidden state as not-found', async () => {
    const fake = new FakeSupabaseClient();
    fake.queueSelect('location_state', { data: [], error: null });
    fake.queueSelect('location_memberships', { data: [{ active: false }], error: null });
    const repository = createSupabaseSharedLocationStateRepository(fake.asClient());

    const result = await repository.load(LOCATION_ID);

    expect(result.status).toBe('unavailable');
    if (result.status === 'unavailable') {
      expect(result.error.retryable).toBe(false);
    }
  });

  it('maps provider errors and missing configuration to unavailable', async () => {
    const fake = new FakeSupabaseClient();
    fake.queueSelect('location_state', {
      data: null,
      error: { code: 'PGRST301' },
    });
    const configuredRepository = createSupabaseSharedLocationStateRepository(fake.asClient());
    const unconfiguredRepository = createSupabaseSharedLocationStateRepository(null);

    const denied = await configuredRepository.load(LOCATION_ID);
    const unconfigured = await unconfiguredRepository.load(LOCATION_ID);

    expect(denied).toEqual({
      status: 'unavailable',
      error: { message: 'Shared location state access was denied.', retryable: false },
    });
    expect(unconfigured).toEqual({
      status: 'unavailable',
      error: {
        message: 'Shared location state is unavailable because Supabase is not configured.',
        retryable: false,
      },
    });
  });

  it('saves only state with both location and expected revision filters', async () => {
    const fake = new FakeSupabaseClient();
    fake.queueUpdate('location_state', {
      data: [stateRow(8, { transactions: ['accepted'] })],
      error: null,
    });
    const repository = createSupabaseSharedLocationStateRepository<{
      transactions: string[];
    }>(fake.asClient());

    const result = await repository.save(LOCATION_ID, 7, {
      transactions: ['accepted'],
    });

    expect(fake.calls).toEqual([
      {
        table: 'location_state',
        operation: 'update',
        columns: 'location_id,state,revision,updated_at,updated_by',
        filters: [
          ['location_id', LOCATION_ID],
          ['revision', 7],
        ],
        payload: { state: { transactions: ['accepted'] } },
      },
    ]);
    expect(result).toMatchObject({
      status: 'accepted',
      value: { revision: 8, state: { transactions: ['accepted'] } },
    });
  });

  it('classifies a zero-row stale write as a conflict with current server state', async () => {
    const fake = new FakeSupabaseClient();
    fake.queueUpdate('location_state', { data: [], error: null });
    fake.queueSelect('location_state', {
      data: [stateRow(10, { source: 'server' })],
      error: null,
    });
    const repository = createSupabaseSharedLocationStateRepository<{ source: string }>(
      fake.asClient(),
    );

    const result = await repository.save(LOCATION_ID, 9, { source: 'client' });

    expect(result).toMatchObject({
      status: 'conflict',
      current: { revision: 10, state: { source: 'server' } },
    });
  });

  it('classifies a disappeared row as a conflict with no current value', async () => {
    const fake = new FakeSupabaseClient();
    fake.queueUpdate('location_state', { data: [], error: null });
    fake.queueSelect('location_state', { data: [], error: null });
    fake.queueSelect('location_memberships', { data: [{ active: true }], error: null });
    const repository = createSupabaseSharedLocationStateRepository(fake.asClient());

    await expect(repository.save(LOCATION_ID, 2, {})).resolves.toEqual({
      status: 'conflict',
      current: null,
    });
  });

  it('does not classify revoked access after a zero-row write as a conflict', async () => {
    const fake = new FakeSupabaseClient();
    fake.queueUpdate('location_state', { data: [], error: null });
    fake.queueSelect('location_state', { data: [], error: null });
    fake.queueSelect('location_memberships', { data: [{ active: false }], error: null });
    const repository = createSupabaseSharedLocationStateRepository(fake.asClient());

    const result = await repository.save(LOCATION_ID, 2, {});

    expect(result.status).toBe('unavailable');
  });

  it('does not classify a failed follow-up read as a conflict', async () => {
    const fake = new FakeSupabaseClient();
    fake.queueUpdate('location_state', { data: [], error: null });
    fake.queueSelect('location_state', {
      data: null,
      error: { code: '503' },
    });
    const repository = createSupabaseSharedLocationStateRepository(fake.asClient());

    const result = await repository.save(LOCATION_ID, 2, {});

    expect(result).toEqual({
      status: 'unavailable',
      error: {
        message: 'Shared location state could not be loaded.',
        retryable: true,
      },
    });
  });

  it('keeps provider failures and unexplained same-revision zero-row writes unavailable', async () => {
    const failedWrite = new FakeSupabaseClient();
    failedWrite.queueUpdate('location_state', {
      data: null,
      error: { code: '503' },
    });
    const sameRevision = new FakeSupabaseClient();
    sameRevision.queueUpdate('location_state', { data: [], error: null });
    sameRevision.queueSelect('location_state', { data: [stateRow(3)], error: null });

    const providerResult = await createSupabaseSharedLocationStateRepository(
      failedWrite.asClient(),
    ).save(LOCATION_ID, 3, {});
    const unexplainedResult = await createSupabaseSharedLocationStateRepository(
      sameRevision.asClient(),
    ).save(LOCATION_ID, 3, {});

    expect(providerResult.status).toBe('unavailable');
    expect(unexplainedResult.status).toBe('unavailable');
  });

  it('returns a stable no-op unsubscribe without creating a realtime channel', () => {
    const fake = new FakeSupabaseClient();
    const repository = createSupabaseSharedLocationStateRepository(fake.asClient());
    const listener = vi.fn();

    const unsubscribe = repository.subscribe(LOCATION_ID, listener);
    unsubscribe();
    unsubscribe();

    expect(fake.channel).not.toHaveBeenCalled();
    expect(listener).not.toHaveBeenCalled();
  });
});
