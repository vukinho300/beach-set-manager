import { describe, expect, it } from 'vitest';
import {
  KOVERSADA_LOCATION_ID,
  PETALON_LOCATION_ID,
  type LocationMetadata,
} from './location';
import { isBackupForLocation } from './locationBackup';

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

function version13Backup(location: LocationMetadata) {
  return {
    app: 'Beach Set Manager',
    version: 13,
    locationId: location.id,
    locationSlug: location.slug,
  };
}

describe('location-labelled backups', () => {
  it('accepts a v13 Petalon backup only for Petalon', () => {
    expect(isBackupForLocation(version13Backup(petalon), petalon)).toBe(true);
    expect(isBackupForLocation(version13Backup(petalon), koversada)).toBe(false);
  });

  it('accepts a v13 Koversada backup only for Koversada', () => {
    expect(isBackupForLocation(version13Backup(koversada), koversada)).toBe(true);
    expect(isBackupForLocation(version13Backup(koversada), petalon)).toBe(false);
  });

  it('classifies legacy v12 backups as Petalon-only', () => {
    const legacy = { app: 'Beach Set Manager', version: 12 };
    expect(isBackupForLocation(legacy, petalon)).toBe(true);
    expect(isBackupForLocation(legacy, koversada)).toBe(false);
  });

  it('preserves older explicitly exported formats for Petalon only', () => {
    expect(isBackupForLocation({ app: 'Beach Set Manager', version: 11 }, petalon))
      .toBe(true);
    expect(isBackupForLocation({ app: 'Beach Set Manager', version: 11 }, koversada))
      .toBe(false);
  });

  it('rejects malformed and unknown backup identities', () => {
    expect(isBackupForLocation(null, petalon)).toBe(false);
    expect(isBackupForLocation({}, petalon)).toBe(false);
    expect(isBackupForLocation({ app: 'Another App', version: 12 }, petalon))
      .toBe(false);
    expect(isBackupForLocation({ app: 'Beach Set Manager', version: 99 }, petalon))
      .toBe(false);
    expect(isBackupForLocation({
      app: 'Beach Set Manager',
      version: 13,
      locationId: petalon.id,
      locationSlug: 'wrong-location',
    }, petalon)).toBe(false);
  });
});
