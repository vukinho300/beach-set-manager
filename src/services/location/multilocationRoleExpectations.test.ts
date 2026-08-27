import { describe, expect, it } from 'vitest';
import expectations from '../../../supabase/verification/multilocation_role_expectations.json';

describe('Step 10 multi-location role expectations', () => {
  it('keeps Petalon and Koversada memberships intentionally isolated', () => {
    expect(expectations.Petalon.memberships).toEqual({
      Vuk: 'PLATFORM_OWNER',
      Mark: 'LOCATION_ADMIN',
      Vito: 'WORKER',
    });
    expect(expectations.Koversada.memberships).toEqual({
      Vuk: 'PLATFORM_OWNER',
      Mark: 'LOCATION_ADMIN',
      'koversada-radnik': 'WORKER',
    });
    expect('Vito' in expectations.Koversada.memberships).toBe(false);
    expect('koversada-radnik' in expectations.Petalon.memberships).toBe(false);
  });
});
