import { describe, expect, it } from 'vitest';
import type { LocationMetadata } from './location';
import { isBackupForLocation } from './locationBackup';

const petalon: LocationMetadata = {
  id: 'petalon-id',
  name: 'Petalon',
  slug: 'petalon',
  interfaceProfile: 'PETALON_FULL',
};
const koversada: LocationMetadata = {
  id: 'koversada-id',
  name: 'Koversada',
  slug: 'koversada',
  interfaceProfile: 'KOVERSADA_AQUAPARK',
};

function backup(location: LocationMetadata) {
  return {
    app: 'Beach Set Manager',
    version: 13,
    locationId: location.id,
    locationSlug: location.slug,
  };
}

describe('location-labelled backups', () => {
  it('accepts only a backup matching the selected location identity', () => {
    expect(isBackupForLocation(backup(petalon), petalon)).toBe(true);
    expect(isBackupForLocation(backup(koversada), koversada)).toBe(true);
  });

  it('rejects Petalon to Koversada and Koversada to Petalon restores', () => {
    expect(isBackupForLocation(backup(petalon), koversada)).toBe(false);
    expect(isBackupForLocation(backup(koversada), petalon)).toBe(false);
  });
});
