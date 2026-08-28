import { describe, expect, it, vi } from 'vitest';
import {
  KOVERSADA_LOCATION_ID,
  PETALON_LOCATION_ID,
  type LocationMetadata,
} from '../../domain/location';
import type { ActiveLocationMembership } from './locationMemberships';
import {
  chooseSelectedLocation,
  scopeLocationAccessToAuthenticatedUser,
} from './useLocationAccessSession';

function membership(
  userId: string,
  location: LocationMetadata,
): ActiveLocationMembership {
  return {
    userId,
    locationId: location.id,
    role: 'WORKER',
    location,
  };
}

const petalon: LocationMetadata = {
  id: PETALON_LOCATION_ID,
  name: 'Petalon',
  slug: 'petalon',
  interfaceProfile: 'PETALON_FULL',
};
const koversada: LocationMetadata = {
  id: KOVERSADA_LOCATION_ID,
  name: 'Koversada',
  slug: 'koversada',
  interfaceProfile: 'KOVERSADA_AQUAPARK',
};

function storage(saved: string | null) {
  return { getItem: vi.fn(() => saved) };
}

describe('selected operational location', () => {
  it('auto-selects the only active Petalon or Koversada membership', () => {
    expect(chooseSelectedLocation('vito', [membership('vito', petalon)], storage(null)))
      .toMatchObject({ locationId: PETALON_LOCATION_ID });
    expect(chooseSelectedLocation(
      'worker',
      [membership('worker', koversada)],
      storage(null),
    )).toMatchObject({ locationId: KOVERSADA_LOCATION_ID });
  });

  it('restores a valid saved location and defaults multi-location owners to Petalon', () => {
    const memberships = [membership('mark', petalon), membership('mark', koversada)];
    expect(chooseSelectedLocation('mark', memberships, storage(KOVERSADA_LOCATION_ID)))
      .toMatchObject({ locationId: KOVERSADA_LOCATION_ID });
    expect(chooseSelectedLocation('mark', memberships, storage(null)))
      .toMatchObject({ locationId: PETALON_LOCATION_ID });
  });

  it('ignores an inaccessible saved location', () => {
    expect(chooseSelectedLocation(
      'vito',
      [membership('vito', petalon)],
      storage(KOVERSADA_LOCATION_ID),
    )).toMatchObject({ locationId: PETALON_LOCATION_ID });
  });

  it('never exposes the previous account location access during account switch', () => {
    const previous = {
      userId: 'vuk',
      state: {
        status: 'active' as const,
        memberships: [membership('vuk', petalon), membership('vuk', koversada)],
        selected: membership('vuk', koversada),
      },
    };
    expect(scopeLocationAccessToAuthenticatedUser('vito', previous)).toEqual({
      status: 'loading',
    });
  });
});
