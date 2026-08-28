import { describe, expect, it } from 'vitest';
import {
  getLocationCapabilities,
  getLocationRoleDisplayLabel,
} from './locationCapabilities';

describe('location capabilities', () => {
  it('gives Platform Owner and Location Owner boss-only revenue access', () => {
    for (const role of ['PLATFORM_OWNER', 'LOCATION_ADMIN'] as const) {
      expect(getLocationCapabilities(role, 'PETALON_FULL')).toMatchObject({
        canUseNormalOperations: true,
        canManageLocation: true,
        canManageRealRevenue: true,
      });
    }
    expect(getLocationRoleDisplayLabel('PLATFORM_OWNER')).toBe('Platform Admin');
    expect(getLocationRoleDisplayLabel('LOCATION_ADMIN')).toBe('Location Owner');
  });

  it('keeps workers operational but denies boss-only controls at both profiles', () => {
    expect(getLocationCapabilities('WORKER', 'PETALON_FULL')).toMatchObject({
      canUseNormalOperations: true,
      canManageLocation: false,
      canManageRealRevenue: false,
      canUseDestructiveSharedTools: false,
    });
    expect(getLocationCapabilities('WORKER', 'KOVERSADA_AQUAPARK')).toMatchObject({
      canUseNormalOperations: true,
      canManageRealRevenue: false,
    });
    expect(getLocationRoleDisplayLabel('WORKER')).toBe('Worker');
  });

  it('fails closed for unknown or inactive roles', () => {
    expect(getLocationCapabilities('OWNER', 'PETALON_FULL'))
      .toEqual(getLocationCapabilities(null, 'PETALON_FULL'));
    expect(getLocationCapabilities('PLATFORM_OWNER', 'PETALON_FULL', false))
      .toMatchObject({ canUseNormalOperations: false, canManageRealRevenue: false });
  });
});
