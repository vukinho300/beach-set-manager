import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import type { Database } from '../supabase/database.types';
import {
  createSupabasePetalonMembershipService,
  parsePetalonRole,
  PETALON_LOCATION_ID,
} from './petalonMembership';
import {
  scopeMembershipToAuthenticatedUser,
  type UserScopedPetalonMembership,
} from './usePetalonMembership';

type MembershipRow = Database['public']['Tables']['location_memberships']['Row'];

class FakeMembershipClient {
  result: { data: MembershipRow | null; error: { message: string } | null } = {
    data: null,
    error: null,
  };
  readonly select = vi.fn(() => this.query);
  readonly eq = vi.fn(() => this.query);
  readonly maybeSingle = vi.fn(async () => this.result);
  readonly query = {
    select: this.select,
    eq: this.eq,
    maybeSingle: this.maybeSingle,
  };
  readonly from = vi.fn((_table: string) => this.query);

  asClient(): SupabaseClient<Database> {
    return { from: this.from } as unknown as SupabaseClient<Database>;
  }
}

function row(role: string, active = true, userId = 'current-user'): MembershipRow {
  return {
    location_id: PETALON_LOCATION_ID,
    user_id: userId,
    role,
    active,
    created_at: '2026-08-26T00:00:00.000Z',
    updated_at: '2026-08-26T00:00:00.000Z',
  };
}

describe('Petalon membership service', () => {
  it.each([
    'PLATFORM_OWNER',
    'LOCATION_ADMIN',
    'WORKER',
  ] as const)('loads %s from the current user location_memberships row', async (role) => {
    const fake = new FakeMembershipClient();
    fake.result = { data: row(role), error: null };

    await expect(
      createSupabasePetalonMembershipService(fake.asClient())
        .load('current-user', PETALON_LOCATION_ID),
    ).resolves.toEqual({
      status: 'active',
      membership: {
        locationId: PETALON_LOCATION_ID,
        userId: 'current-user',
        role,
      },
    });
    expect(fake.from).toHaveBeenCalledWith('location_memberships');
    expect(fake.select).toHaveBeenCalledWith('location_id,user_id,role,active');
    expect(fake.eq).toHaveBeenCalledWith('location_id', PETALON_LOCATION_ID);
    expect(fake.eq).toHaveBeenCalledWith('user_id', 'current-user');
  });

  it('is conservative for inactive, missing, malformed, and failed membership reads', async () => {
    const fake = new FakeMembershipClient();
    const service = createSupabasePetalonMembershipService(fake.asClient());

    fake.result = { data: row('WORKER', false), error: null };
    await expect(service.load('current-user', PETALON_LOCATION_ID)).resolves.toEqual({
      status: 'inactive',
    });

    fake.result = { data: null, error: null };
    await expect(service.load('current-user', PETALON_LOCATION_ID)).resolves.toEqual({
      status: 'inactive',
    });

    fake.result = { data: row('UNKNOWN_ROLE'), error: null };
    await expect(service.load('current-user', PETALON_LOCATION_ID)).resolves.toMatchObject({
      status: 'unavailable',
    });

    fake.result = { data: null, error: { message: 'provider internals' } };
    const failed = await service.load('current-user', PETALON_LOCATION_ID);
    expect(failed).toMatchObject({ status: 'unavailable' });
    expect(JSON.stringify(failed)).not.toContain('provider internals');
  });

  it('does not infer roles from user metadata, email, names, or owner-looking identifiers', async () => {
    expect(parsePetalonRole({ user_metadata: { role: 'PLATFORM_OWNER' } })).toBeNull();
    expect(parsePetalonRole('vuk@example.test')).toBeNull();
    expect(parsePetalonRole('Mark')).toBeNull();

    const fake = new FakeMembershipClient();
    fake.result = {
      data: row('WORKER', true, 'platform-owner-looking-user'),
      error: null,
    };
    await expect(
      createSupabasePetalonMembershipService(fake.asClient())
        .load('platform-owner-looking-user', PETALON_LOCATION_ID),
    ).resolves.toMatchObject({
      status: 'active',
      membership: { role: 'WORKER' },
    });
  });
});

describe('authenticated-user membership scoping', () => {
  function active(userId: string, role: 'PLATFORM_OWNER' | 'LOCATION_ADMIN' | 'WORKER'):
    UserScopedPetalonMembership {
    return {
      userId,
      state: {
        status: 'active',
        membership: { locationId: PETALON_LOCATION_ID, userId, role },
      },
    };
  }

  it('never exposes Vuk Platform Admin state during a switch to Vito', () => {
    expect(scopeMembershipToAuthenticatedUser('vito-id', active(
      'vuk-id',
      'PLATFORM_OWNER',
    ))).toEqual({ status: 'loading' });
  });

  it('never exposes Mark Location Owner state during a switch to Vito', () => {
    expect(scopeMembershipToAuthenticatedUser('vito-id', active(
      'mark-id',
      'LOCATION_ADMIN',
    ))).toEqual({ status: 'loading' });
  });

  it('does not expose the previous role after sign-out', () => {
    expect(scopeMembershipToAuthenticatedUser(null, active(
      'vuk-id',
      'PLATFORM_OWNER',
    ))).toEqual({ status: 'loading' });
  });
});
