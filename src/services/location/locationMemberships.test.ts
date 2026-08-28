import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import {
  KOVERSADA_LOCATION_ID,
  PETALON_LOCATION_ID,
} from '../../domain/location';
import type { Database } from '../supabase/database.types';
import {
  createSupabaseLocationMembershipsService,
  parseActiveLocationMemberships,
  parseLocationRole,
} from './locationMemberships';

function row(
  userId: string,
  locationId: string,
  role: string,
  location: { name: string; slug: string; interface_profile: string },
) {
  return {
    location_id: locationId,
    user_id: userId,
    role,
    active: true,
    locations: { id: locationId, ...location },
  };
}

const petalon = {
  name: 'Petalon',
  slug: 'petalon',
  interface_profile: 'PETALON_FULL',
};
const koversada = {
  name: 'Koversada',
  slug: 'koversada',
  interface_profile: 'KOVERSADA_AQUAPARK',
};

class FakeMembershipsClient {
  result: { data: unknown[] | null; error: unknown } = { data: [], error: null };
  readonly select = vi.fn(() => this.query);
  readonly eq = vi.fn(() => this.query);
  readonly query = {
    select: this.select,
    eq: this.eq,
    then: (resolve: (value: typeof this.result) => void) => Promise.resolve(this.result).then(resolve),
  };
  readonly from = vi.fn(() => this.query);

  asClient(): SupabaseClient<Database> {
    return { from: this.from } as unknown as SupabaseClient<Database>;
  }
}

describe('multi-location membership loading', () => {
  it('loads every active membership for the authenticated user with server metadata', async () => {
    const fake = new FakeMembershipsClient();
    fake.result = {
      data: [
        row('mark', KOVERSADA_LOCATION_ID, 'LOCATION_ADMIN', koversada),
        row('mark', PETALON_LOCATION_ID, 'LOCATION_ADMIN', petalon),
      ],
      error: null,
    };

    const result = await createSupabaseLocationMembershipsService(fake.asClient())
      .load('mark');

    expect(result).toMatchObject({
      status: 'active',
      memberships: [
        { locationId: PETALON_LOCATION_ID, role: 'LOCATION_ADMIN' },
        { locationId: KOVERSADA_LOCATION_ID, role: 'LOCATION_ADMIN' },
      ],
    });
    expect(fake.eq).toHaveBeenCalledWith('user_id', 'mark');
    expect(fake.eq).toHaveBeenCalledWith('active', true);
  });

  it('represents the intended worker isolation matrix without inference', () => {
    const vito = parseActiveLocationMemberships([
      row('vito', PETALON_LOCATION_ID, 'WORKER', petalon),
    ], 'vito');
    const worker = parseActiveLocationMemberships([
      row('koversada-worker', KOVERSADA_LOCATION_ID, 'WORKER', koversada),
    ], 'koversada-worker');

    expect(vito?.map((item) => item.locationId)).toEqual([PETALON_LOCATION_ID]);
    expect(worker?.map((item) => item.locationId)).toEqual([KOVERSADA_LOCATION_ID]);
    expect(vito?.some((item) => item.locationId === KOVERSADA_LOCATION_ID)).toBe(false);
    expect(worker?.some((item) => item.locationId === PETALON_LOCATION_ID)).toBe(false);
    expect(parseLocationRole('koversada-radnik')).toBeNull();
    expect(parseLocationRole('vuk@example.test')).toBeNull();
  });

  it('fails closed for malformed profiles, foreign user rows, and provider errors', async () => {
    expect(parseActiveLocationMemberships([
      row('other-user', PETALON_LOCATION_ID, 'PLATFORM_OWNER', petalon),
    ], 'worker')).toBeNull();
    expect(parseActiveLocationMemberships([
      row('worker', KOVERSADA_LOCATION_ID, 'WORKER', {
        ...koversada,
        interface_profile: 'USERNAME_DERIVED',
      }),
    ], 'worker')).toBeNull();

    const fake = new FakeMembershipsClient();
    fake.result = { data: null, error: { message: 'provider detail' } };
    await expect(createSupabaseLocationMembershipsService(fake.asClient()).load('worker'))
      .resolves.toEqual({
        status: 'unavailable',
        message: 'Location access could not be verified. Please retry.',
      });
  });
});
