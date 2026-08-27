import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import { createCleanLocationAppData } from '../../domain/location';
import type { ActiveLocationMembership } from '../location/locationMemberships';
import type { Database } from '../supabase/database.types';
import {
  buildOwnerRevenueSummary,
  createSupabaseOwnerRevenueService,
} from './ownerRevenue';

function membership(
  locationId: string,
  name: string,
  profile: 'PETALON_FULL' | 'KOVERSADA_AQUAPARK',
): ActiveLocationMembership {
  return {
    userId: 'owner',
    locationId,
    role: 'LOCATION_ADMIN',
    location: {
      id: locationId,
      name,
      slug: name.toLowerCase(),
      interfaceProfile: profile,
    },
  };
}

function withRevenue(
  profile: 'PETALON_FULL' | 'KOVERSADA_AQUAPARK',
  amount: number,
) {
  return {
    ...createCleanLocationAppData(profile, '2026-08-27'),
    transactions: [{
      id: `sale-${amount}`,
      type: profile === 'PETALON_FULL' ? 'beach_set' as const : 'aquapark' as const,
      amount,
      createdAt: '2026-08-27T10:00:00.000Z',
    }],
  };
}

describe('owner multi-location revenue summary', () => {
  const memberships = [
    membership('petalon', 'Petalon', 'PETALON_FULL'),
    membership('koversada', 'Koversada', 'KOVERSADA_AQUAPARK'),
  ];

  it('combines complete App and Real Revenue across authorized locations', () => {
    const summary = buildOwnerRevenueSummary(
      memberships,
      '2026-08-27',
      new Map([
        ['petalon', withRevenue('PETALON_FULL', 120)],
        ['koversada', withRevenue('KOVERSADA_AQUAPARK', 48)],
      ]),
      new Map([['petalon', 118], ['koversada', 50]]),
      '2026-08-27',
    );

    expect(summary.combinedAppRevenue).toBe(168);
    expect(summary.combinedRealRevenue).toBe(168);
    expect(summary.locations.map((item) => item.appRevenue)).toEqual([120, 48]);
  });

  it('does not invent a complete combined Real Revenue when one location is missing', () => {
    const summary = buildOwnerRevenueSummary(
      memberships,
      '2026-08-27',
      new Map([
        ['petalon', withRevenue('PETALON_FULL', 120)],
        ['koversada', withRevenue('KOVERSADA_AQUAPARK', 48)],
      ]),
      new Map([['petalon', 118]]),
      '2026-08-27',
    );

    expect(summary.combinedRealRevenue).toBeNull();
    expect(summary.missingRealRevenueLocations).toEqual(['Koversada']);
  });

  it('does not interpret a missing historical location report as €0', () => {
    const summary = buildOwnerRevenueSummary(
      memberships,
      '2026-08-26',
      new Map([['petalon', {
        ...createCleanLocationAppData('PETALON_FULL', '2026-08-27'),
        reportArchive: [{
          date: '2026-08-26',
          archivedAt: '2026-08-27T00:00:00.000Z',
          transactions: [{
            id: 'archived',
            type: 'beach_set',
            amount: 120,
            createdAt: '2026-08-26T10:00:00.000Z',
          }],
        }],
      }]]),
      new Map(),
      '2026-08-27',
    );

    expect(summary.combinedAppRevenue).toBeNull();
    expect(summary.missingAppRevenueLocations).toEqual(['Koversada']);
    expect(summary.locations[1].appRevenue).toBeNull();
  });

  it('monitors both authorized locations read-only with independently filtered Realtime', () => {
    const filters: Array<{ event: string; schema: string; table: string; filter: string }> = [];
    const channel = {
      on: vi.fn((_type: string, filter: typeof filters[number]) => {
        filters.push(filter);
        return channel;
      }),
      subscribe: vi.fn(() => channel),
    };
    const removeChannel = vi.fn(async () => 'ok');
    const client = {
      channel: vi.fn(() => channel),
      removeChannel,
    } as unknown as SupabaseClient<Database>;

    const unsubscribe = createSupabaseOwnerRevenueService(client).subscribe(
      ['petalon', 'koversada'],
      vi.fn(),
    );

    expect(filters).toEqual([
      { event: '*', schema: 'public', table: 'location_state', filter: 'location_id=eq.petalon' },
      { event: '*', schema: 'public', table: 'location_daily_real_revenue', filter: 'location_id=eq.petalon' },
      { event: '*', schema: 'public', table: 'location_state', filter: 'location_id=eq.koversada' },
      { event: '*', schema: 'public', table: 'location_daily_real_revenue', filter: 'location_id=eq.koversada' },
    ]);
    expect(channel.subscribe).toHaveBeenCalledOnce();
    unsubscribe();
    expect(removeChannel).toHaveBeenCalledWith(channel);
  });
});
