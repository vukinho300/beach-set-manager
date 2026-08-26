import { describe, expect, it } from 'vitest';
import {
  getPetalonCapabilities,
  getPetalonRoleDisplayLabel,
} from './petalonCapabilities';

describe('Petalon role capabilities', () => {
  it('gives Platform Admin normal operations and location-management tools', () => {
    expect(getPetalonRoleDisplayLabel('PLATFORM_OWNER')).toBe('Platform Admin');
    expect(getPetalonCapabilities('PLATFORM_OWNER')).toMatchObject({
      canUseNormalOperations: true,
      canRunDailyReset: true,
      canExportBackup: true,
      canManageLocation: true,
      canUseDestructiveSharedTools: true,
      isPlatformAdmin: true,
      isLocationOwner: false,
    });
  });

  it('gives Location Owner normal operations and location-management tools without platform status', () => {
    expect(getPetalonRoleDisplayLabel('LOCATION_ADMIN')).toBe('Location Owner');
    expect(getPetalonCapabilities('LOCATION_ADMIN')).toMatchObject({
      canUseNormalOperations: true,
      canRunDailyReset: true,
      canExportBackup: true,
      canManageLocation: true,
      canUseDestructiveSharedTools: true,
      isPlatformAdmin: false,
      isLocationOwner: true,
    });
  });

  it('keeps Worker operational while withholding destructive location-management UI', () => {
    expect(getPetalonRoleDisplayLabel('WORKER')).toBe('Worker');
    expect(getPetalonCapabilities('WORKER')).toMatchObject({
      canUseNormalOperations: true,
      canRunDailyReset: true,
      canExportBackup: true,
      canManageLocation: false,
      canUseDestructiveSharedTools: false,
      isPlatformAdmin: false,
      isLocationOwner: false,
    });
  });

  it('grants no capabilities for inactive or malformed membership input', () => {
    expect(getPetalonCapabilities('PLATFORM_OWNER', false)).toEqual({
      canUseNormalOperations: false,
      canRunDailyReset: false,
      canExportBackup: false,
      canManageLocation: false,
      canUseDestructiveSharedTools: false,
      isPlatformAdmin: false,
      isLocationOwner: false,
    });
    expect(getPetalonCapabilities('OWNER')).toEqual(
      getPetalonCapabilities(null),
    );
  });
});
