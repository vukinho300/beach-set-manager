import type { SupabaseClient } from '@supabase/supabase-js';
import { PETALON_LOCATION_ID } from '../../domain/petalon';
import type { Database } from '../supabase/database.types';
import { getSupabaseClient } from '../supabase/client';

export { PETALON_LOCATION_ID };

export const PETALON_ROLES = [
  'PLATFORM_OWNER',
  'LOCATION_ADMIN',
  'WORKER',
] as const;

export type PetalonRole = (typeof PETALON_ROLES)[number];

export type ActivePetalonMembership = {
  locationId: string;
  userId: string;
  role: PetalonRole;
};

export type PetalonMembershipLoadResult =
  | { status: 'active'; membership: ActivePetalonMembership }
  | { status: 'inactive' }
  | { status: 'unavailable'; message: string };

export interface PetalonMembershipService {
  load(userId: string, locationId: string): Promise<PetalonMembershipLoadResult>;
}

const MEMBERSHIP_UNAVAILABLE_MESSAGE =
  'Petalon membership could not be verified. Please retry.';

export function parsePetalonRole(value: unknown): PetalonRole | null {
  return typeof value === 'string' && PETALON_ROLES.includes(value as PetalonRole)
    ? value as PetalonRole
    : null;
}

class SupabasePetalonMembershipService implements PetalonMembershipService {
  constructor(private readonly client: SupabaseClient<Database> | null) {}

  async load(userId: string, locationId: string): Promise<PetalonMembershipLoadResult> {
    if (!this.client) {
      return { status: 'unavailable', message: MEMBERSHIP_UNAVAILABLE_MESSAGE };
    }

    try {
      const { data, error } = await this.client
        .from('location_memberships')
        .select('location_id,user_id,role,active')
        .eq('location_id', locationId)
        .eq('user_id', userId)
        .maybeSingle();

      if (error) {
        return { status: 'unavailable', message: MEMBERSHIP_UNAVAILABLE_MESSAGE };
      }

      if (!data) {
        return { status: 'inactive' };
      }

      const role = parsePetalonRole(data.role);
      if (data.location_id !== locationId || data.user_id !== userId || !role) {
        return { status: 'unavailable', message: MEMBERSHIP_UNAVAILABLE_MESSAGE };
      }

      return data.active
        ? {
            status: 'active',
            membership: { locationId, userId, role },
          }
        : { status: 'inactive' };
    } catch {
      return { status: 'unavailable', message: MEMBERSHIP_UNAVAILABLE_MESSAGE };
    }
  }
}

export function createSupabasePetalonMembershipService(
  client: SupabaseClient<Database> | null = getSupabaseClient(),
): PetalonMembershipService {
  return new SupabasePetalonMembershipService(client);
}
