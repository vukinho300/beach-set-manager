import { describe, expect, it } from 'vitest';
import { parseCachedLocationStatePayload } from './deviceRecoveryScanner';

const LOCATION_ID = '00000000-0000-4000-8000-000000000001';

describe('device recovery scanner', () => {
  it('extracts only the requested location from a cached PostgREST payload', () => {
    expect(parseCachedLocationStatePayload([
      { location_id: LOCATION_ID, revision: 279, state: { marker: 'recover-me' } },
      { location_id: '00000000-0000-4000-8000-000000000002', revision: 2, state: { marker: 'other' } },
    ], LOCATION_ID)).toEqual([{
      locationId: LOCATION_ID,
      revision: 279,
      state: { marker: 'recover-me' },
    }]);
  });

  it('rejects unrelated and malformed cached responses', () => {
    expect(parseCachedLocationStatePayload({ message: 'not a row' }, LOCATION_ID)).toEqual([]);
    expect(parseCachedLocationStatePayload(null, LOCATION_ID)).toEqual([]);
  });
});
