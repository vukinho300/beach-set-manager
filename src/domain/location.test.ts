import { describe, expect, it } from 'vitest';
import {
  createCleanLocationAppData,
  locationSupportsBeachOperations,
  parseLocationInterfaceProfile,
} from './location';

describe('server-owned location profiles', () => {
  it('keeps the full Petalon operational structure', () => {
    const data = createCleanLocationAppData('PETALON_FULL', '2026-08-27');
    expect(Object.keys(data.sets)).toHaveLength(56);
    expect(Object.keys(data.extraBeds)).toHaveLength(4);
    expect(locationSupportsBeachOperations('PETALON_FULL')).toBe(true);
  });

  it('creates Koversada with no Petalon-domain operational activity', () => {
    const data = createCleanLocationAppData('KOVERSADA_AQUAPARK', '2026-08-27');
    expect(data).toMatchObject({
      sets: {},
      extraBeds: {},
      beachReservations: [],
      savedSurnames: [],
      sunbedSales: [],
      aquaparkEntries: [],
      transactions: [],
      reportArchive: [],
    });
    expect(locationSupportsBeachOperations('KOVERSADA_AQUAPARK')).toBe(false);
  });

  it('does not infer profile from a person or username', () => {
    expect(parseLocationInterfaceProfile('koversada-radnik')).toBeNull();
    expect(parseLocationInterfaceProfile('Vuk')).toBeNull();
  });
});
