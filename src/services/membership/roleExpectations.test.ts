import { describe, expect, it } from 'vitest';
import roleExpectations from '../../../supabase/verification/role_expectations.json';

describe('credential-local authenticated RLS role expectations', () => {
  it('protects the canonical Vuk, Mark, and Vito provisioning roles from drift', () => {
    expect(roleExpectations).toEqual({
      Vuk: 'PLATFORM_OWNER',
      Mark: 'LOCATION_ADMIN',
      Vito: 'WORKER',
    });
  });
});
