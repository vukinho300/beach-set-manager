import {
  PETALON_LOCATION_ID,
  type LocationMetadata,
} from './location';

export const LEGACY_PETALON_BACKUP_VERSIONS = [
  2,
  3,
  5,
  6,
  10,
  11,
  12,
] as const;

type LocationBackupIdentityV13 = {
  app: 'Beach Set Manager';
  version: 13;
  locationId: string;
  locationSlug: string;
};

type LegacyPetalonBackupIdentity = {
  app: 'Beach Set Manager';
  version: typeof LEGACY_PETALON_BACKUP_VERSIONS[number];
};

export type LocationBackupIdentity =
  | LocationBackupIdentityV13
  | LegacyPetalonBackupIdentity;

export function isBackupForLocation(
  value: unknown,
  location: LocationMetadata,
): value is LocationBackupIdentity {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  if (candidate.app !== 'Beach Set Manager') {
    return false;
  }
  if (candidate.version === 13) {
    return candidate.locationId === location.id
      && candidate.locationSlug === location.slug;
  }

  return typeof candidate.version === 'number'
    && LEGACY_PETALON_BACKUP_VERSIONS.includes(
      candidate.version as typeof LEGACY_PETALON_BACKUP_VERSIONS[number],
    )
    && location.id === PETALON_LOCATION_ID
    && location.slug === 'petalon';
}
