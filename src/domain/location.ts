import {
  createDefaultAppData,
  getLocalDateKey,
  type AppData,
  type BeachSetMap,
  type ExtraBedMap,
} from './appData';

export const PETALON_LOCATION_ID = '00000000-0000-4000-8000-000000000001';
export const KOVERSADA_LOCATION_ID = '00000000-0000-4000-8000-000000000002';

export const LOCATION_INTERFACE_PROFILES = [
  'PETALON_FULL',
  'KOVERSADA_AQUAPARK',
] as const;

export type LocationInterfaceProfile = typeof LOCATION_INTERFACE_PROFILES[number];

export type LocationMetadata = {
  id: string;
  name: string;
  slug: string;
  interfaceProfile: LocationInterfaceProfile;
};

export function parseLocationInterfaceProfile(
  value: unknown,
): LocationInterfaceProfile | null {
  return typeof value === 'string'
    && LOCATION_INTERFACE_PROFILES.includes(value as LocationInterfaceProfile)
    ? value as LocationInterfaceProfile
    : null;
}

export function createCleanLocationAppData(
  profile: LocationInterfaceProfile,
  dateKey = getLocalDateKey(),
): AppData {
  const defaults = createDefaultAppData(new Date(`${dateKey}T12:00:00`));
  if (profile === 'PETALON_FULL') {
    return defaults;
  }

  return {
    ...defaults,
    sets: {} as BeachSetMap,
    extraBeds: {} as ExtraBedMap,
    beachReservations: [],
    savedSurnames: [],
    sunbedSales: [],
    transactions: [],
    reportArchive: [],
  };
}

export function locationSupportsBeachOperations(
  profile: LocationInterfaceProfile,
): boolean {
  return profile === 'PETALON_FULL';
}
