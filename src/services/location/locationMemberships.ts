import type { SupabaseClient } from '@supabase/supabase-js';
import {
  parseLocationInterfaceProfile,
  type LocationMetadata,
} from '../../domain/location';
import type { Database } from '../supabase/database.types';
import { getSupabaseClient } from '../supabase/client';

export const LOCATION_ROLES = [
  'PLATFORM_OWNER',
  'LOCATION_ADMIN',
  'WORKER',
] as const;

export type LocationRole = typeof LOCATION_ROLES[number];

export type ActiveLocationMembership = {
  locationId: string;
  userId: string;
  role: LocationRole;
  location: LocationMetadata;
};

export type LocationMembershipsLoadResult =
  | { status: 'active'; memberships: ActiveLocationMembership[] }
  | { status: 'inactive' }
  | { status: 'unavailable'; message: string };

export interface LocationMembershipsService {
  load(userId: string): Promise<LocationMembershipsLoadResult>;
}

type MembershipQueryRow = {
  location_id: string;
  user_id: string;
  role: unknown;
  active: boolean;
  locations: unknown;
};

const MEMBERSHIP_UNAVAILABLE_MESSAGE =
  'Location access could not be verified. Please retry.';

export function parseLocationRole(value: unknown): LocationRole | null {
  return typeof value === 'string' && LOCATION_ROLES.includes(value as LocationRole)
    ? value as LocationRole
    : null;
}

function parseLocation(value: unknown): LocationMetadata | null {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (!candidate || typeof candidate !== 'object') {
    return null;
  }

  const row = candidate as Record<string, unknown>;
  const interfaceProfile = parseLocationInterfaceProfile(row.interface_profile);
  if (
    typeof row.id !== 'string'
    || typeof row.name !== 'string'
    || typeof row.slug !== 'string'
    || !interfaceProfile
  ) {
    return null;
  }

  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    interfaceProfile,
  };
}

export function parseActiveLocationMemberships(
  rows: MembershipQueryRow[],
  userId: string,
): ActiveLocationMembership[] | null {
  const memberships: ActiveLocationMembership[] = [];

  for (const row of rows) {
    const role = parseLocationRole(row.role);
    const location = parseLocation(row.locations);
    if (
      row.user_id !== userId
      || row.location_id !== location?.id
      || !row.active
      || !role
      || !location
    ) {
      return null;
    }

    memberships.push({
      locationId: row.location_id,
      userId,
      role,
      location,
    });
  }

  return memberships.sort((first, second) => (
    first.location.slug === 'petalon' ? -1
      : second.location.slug === 'petalon' ? 1
        : first.location.name.localeCompare(second.location.name)
  ));
}

class SupabaseLocationMembershipsService implements LocationMembershipsService {
  constructor(private readonly client: SupabaseClient<Database> | null) {}

  async load(userId: string): Promise<LocationMembershipsLoadResult> {
    if (!this.client) {
      return { status: 'unavailable', message: MEMBERSHIP_UNAVAILABLE_MESSAGE };
    }

    try {
      const { data, error } = await this.client
        .from('location_memberships')
        .select('location_id,user_id,role,active,locations(id,name,slug,interface_profile)')
        .eq('user_id', userId)
        .eq('active', true);

      if (error || !data) {
        return { status: 'unavailable', message: MEMBERSHIP_UNAVAILABLE_MESSAGE };
      }

      const memberships = parseActiveLocationMemberships(
        data as unknown as MembershipQueryRow[],
        userId,
      );
      if (!memberships) {
        return { status: 'unavailable', message: MEMBERSHIP_UNAVAILABLE_MESSAGE };
      }

      return memberships.length > 0
        ? { status: 'active', memberships }
        : { status: 'inactive' };
    } catch {
      return { status: 'unavailable', message: MEMBERSHIP_UNAVAILABLE_MESSAGE };
    }
  }
}

export function createSupabaseLocationMembershipsService(
  client: SupabaseClient<Database> | null = getSupabaseClient(),
): LocationMembershipsService {
  return new SupabaseLocationMembershipsService(client);
}
