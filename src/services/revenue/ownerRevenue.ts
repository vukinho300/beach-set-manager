import type { SupabaseClient } from '@supabase/supabase-js';
import type { AppData } from '../../domain/appData';
import {
  calculateDailyRevenue,
  getZagrebBusinessDate,
  getTransactionsForBusinessDate,
} from '../../domain/revenue';
import type { ActiveLocationMembership } from '../location/locationMemberships';
import type { Database } from '../supabase/database.types';
import { getSupabaseClient } from '../supabase/client';

export type LocationRevenueSummary = {
  membership: ActiveLocationMembership;
  appRevenue: number | null;
  realRevenue: number | null;
};

export type OwnerRevenueSummary = {
  businessDate: string;
  locations: LocationRevenueSummary[];
  combinedAppRevenue: number | null;
  combinedRealRevenue: number | null;
  missingAppRevenueLocations: string[];
  missingRealRevenueLocations: string[];
};

export type OwnerRevenueLoadResult =
  | { status: 'ready'; summary: OwnerRevenueSummary }
  | { status: 'unavailable'; message: string };

export type OwnerRevenueSaveResult =
  | { status: 'saved' }
  | { status: 'unavailable'; message: string };

export interface OwnerRevenueService {
  load(
    memberships: ActiveLocationMembership[],
    businessDate: string,
    normalize: (value: unknown, membership: ActiveLocationMembership) => AppData | null,
  ): Promise<OwnerRevenueLoadResult>;
  save(locationId: string, businessDate: string, realRevenue: number): Promise<OwnerRevenueSaveResult>;
  subscribe(locationIds: string[], listener: () => void): () => void;
}

const LOAD_FAILED_MESSAGE = 'Owner revenue could not be loaded. Please retry.';
const SAVE_FAILED_MESSAGE = 'Real Revenue could not be saved. Please retry.';

export function buildOwnerRevenueSummary(
  memberships: ActiveLocationMembership[],
  businessDate: string,
  statesByLocation: Map<string, AppData>,
  realRevenueByLocation: Map<string, number>,
  today = getZagrebBusinessDate(),
): OwnerRevenueSummary {
  const locations = memberships.map((membership): LocationRevenueSummary => {
    const appData = statesByLocation.get(membership.locationId);
    const transactions = appData
      ? getTransactionsForBusinessDate(appData, businessDate, today)
      : null;
    return {
      membership,
      appRevenue: transactions
        ? calculateDailyRevenue(
            transactions,
            membership.location.interfaceProfile,
          ).total
        : null,
      realRevenue: realRevenueByLocation.get(membership.locationId) ?? null,
    };
  });
  const missingAppRevenueLocations = locations
    .filter((item) => item.appRevenue === null)
    .map((item) => item.membership.location.name);
  const missingRealRevenueLocations = locations
    .filter((item) => item.realRevenue === null)
    .map((item) => item.membership.location.name);

  return {
    businessDate,
    locations,
    combinedAppRevenue: missingAppRevenueLocations.length === 0
      ? locations.reduce((total, item) => total + (item.appRevenue ?? 0), 0)
      : null,
    combinedRealRevenue: missingRealRevenueLocations.length === 0
      ? locations.reduce((total, item) => total + (item.realRevenue ?? 0), 0)
      : null,
    missingAppRevenueLocations,
    missingRealRevenueLocations,
  };
}

class SupabaseOwnerRevenueService implements OwnerRevenueService {
  constructor(private readonly client: SupabaseClient<Database> | null) {}

  async load(
    memberships: ActiveLocationMembership[],
    businessDate: string,
    normalize: (value: unknown, membership: ActiveLocationMembership) => AppData | null,
  ): Promise<OwnerRevenueLoadResult> {
    if (!this.client || memberships.length === 0) {
      return { status: 'unavailable', message: LOAD_FAILED_MESSAGE };
    }
    const locationIds = memberships.map((membership) => membership.locationId);

    try {
      const [statesResult, realRevenueResult] = await Promise.all([
        this.client
          .from('location_state')
          .select('location_id,state')
          .in('location_id', locationIds),
        this.client
          .from('location_daily_real_revenue')
          .select('location_id,real_revenue')
          .eq('business_date', businessDate)
          .in('location_id', locationIds),
      ]);

      if (
        statesResult.error
        || realRevenueResult.error
        || !statesResult.data
        || !realRevenueResult.data
      ) {
        return { status: 'unavailable', message: LOAD_FAILED_MESSAGE };
      }

      const membershipByLocation = new Map(
        memberships.map((membership) => [membership.locationId, membership]),
      );
      const statesByLocation = new Map<string, AppData>();
      for (const row of statesResult.data) {
        const membership = membershipByLocation.get(row.location_id);
        const normalized = membership ? normalize(row.state, membership) : null;
        if (membership && normalized) {
          statesByLocation.set(membership.locationId, normalized);
        }
      }
      const realRevenueByLocation = new Map(
        realRevenueResult.data.map((row) => [
          row.location_id,
          Number(row.real_revenue),
        ]),
      );

      return {
        status: 'ready',
        summary: buildOwnerRevenueSummary(
          memberships,
          businessDate,
          statesByLocation,
          realRevenueByLocation,
        ),
      };
    } catch {
      return { status: 'unavailable', message: LOAD_FAILED_MESSAGE };
    }
  }

  async save(
    locationId: string,
    businessDate: string,
    realRevenue: number,
  ): Promise<OwnerRevenueSaveResult> {
    if (!this.client) {
      return { status: 'unavailable', message: SAVE_FAILED_MESSAGE };
    }
    try {
      const { error } = await this.client.rpc('set_location_daily_real_revenue', {
        p_location_id: locationId,
        p_business_date: businessDate,
        p_real_revenue: realRevenue,
      });
      return error
        ? { status: 'unavailable', message: SAVE_FAILED_MESSAGE }
        : { status: 'saved' };
    } catch {
      return { status: 'unavailable', message: SAVE_FAILED_MESSAGE };
    }
  }

  subscribe(locationIds: string[], listener: () => void): () => void {
    if (!this.client || locationIds.length === 0) {
      return () => undefined;
    }
    const channel = this.client.channel(
      `owner-revenue:${locationIds.slice().sort().join(':')}:${crypto.randomUUID()}`,
    );
    for (const locationId of locationIds) {
      channel.on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'location_state',
          filter: `location_id=eq.${locationId}`,
        },
        listener,
      );
      channel.on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'location_daily_real_revenue',
          filter: `location_id=eq.${locationId}`,
        },
        listener,
      );
    }
    channel.subscribe();
    return () => {
      void this.client?.removeChannel(channel);
    };
  }
}

export function createSupabaseOwnerRevenueService(
  client: SupabaseClient<Database> | null = getSupabaseClient(),
): OwnerRevenueService {
  return new SupabaseOwnerRevenueService(client);
}
