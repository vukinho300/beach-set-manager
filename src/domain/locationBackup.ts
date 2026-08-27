import type { LocationMetadata } from './location';

export type LocationBackupIdentity = {
  app: 'Beach Set Manager';
  version: 13;
  locationId: string;
  locationSlug: string;
};

export function isBackupForLocation(
  value: unknown,
  location: LocationMetadata,
): value is LocationBackupIdentity {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const candidate = value as Partial<LocationBackupIdentity>;
  return candidate.app === 'Beach Set Manager'
    && candidate.version === 13
    && candidate.locationId === location.id
    && candidate.locationSlug === location.slug;
}
