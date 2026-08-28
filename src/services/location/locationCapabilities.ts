import type { LocationInterfaceProfile } from '../../domain/location';
import { parseLocationRole, type LocationRole } from './locationMemberships';

export type LocationCapabilities = {
  canUseNormalOperations: boolean;
  canRunDailyReset: boolean;
  canExportBackup: boolean;
  canManageLocation: boolean;
  canUseDestructiveSharedTools: boolean;
  canManageRealRevenue: boolean;
  isPlatformAdmin: boolean;
  isLocationOwner: boolean;
};

const NO_CAPABILITIES: LocationCapabilities = {
  canUseNormalOperations: false,
  canRunDailyReset: false,
  canExportBackup: false,
  canManageLocation: false,
  canUseDestructiveSharedTools: false,
  canManageRealRevenue: false,
  isPlatformAdmin: false,
  isLocationOwner: false,
};

export function getLocationCapabilities(
  value: unknown,
  _profile: LocationInterfaceProfile,
  active = true,
): LocationCapabilities {
  const role = parseLocationRole(value);
  if (!active || !role) {
    return NO_CAPABILITIES;
  }

  const canManageLocation = role === 'PLATFORM_OWNER' || role === 'LOCATION_ADMIN';
  return {
    canUseNormalOperations: true,
    canRunDailyReset: true,
    canExportBackup: true,
    canManageLocation,
    canUseDestructiveSharedTools: canManageLocation,
    canManageRealRevenue: canManageLocation,
    isPlatformAdmin: role === 'PLATFORM_OWNER',
    isLocationOwner: role === 'LOCATION_ADMIN',
  };
}

export function getLocationRoleDisplayLabel(role: LocationRole): string {
  switch (role) {
    case 'PLATFORM_OWNER':
      return 'Platform Admin';
    case 'LOCATION_ADMIN':
      return 'Location Owner';
    case 'WORKER':
      return 'Worker';
  }
}
