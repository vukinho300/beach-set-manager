import { parsePetalonRole, type PetalonRole } from './petalonMembership';

export type PetalonCapabilities = {
  canUseNormalOperations: boolean;
  canRunDailyReset: boolean;
  canExportBackup: boolean;
  canManageLocation: boolean;
  canUseDestructiveSharedTools: boolean;
  isPlatformAdmin: boolean;
  isLocationOwner: boolean;
};

// These capabilities control the current product experience only. They are not
// an action-level database authorization boundary: every active member still
// needs broad access to update the shared location_state JSONB for normal work.

const NO_CAPABILITIES: PetalonCapabilities = {
  canUseNormalOperations: false,
  canRunDailyReset: false,
  canExportBackup: false,
  canManageLocation: false,
  canUseDestructiveSharedTools: false,
  isPlatformAdmin: false,
  isLocationOwner: false,
};

export function getPetalonCapabilities(
  value: unknown,
  active = true,
): PetalonCapabilities {
  const role = parsePetalonRole(value);
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
    isPlatformAdmin: role === 'PLATFORM_OWNER',
    isLocationOwner: role === 'LOCATION_ADMIN',
  };
}

export function getPetalonRoleDisplayLabel(role: PetalonRole): string {
  switch (role) {
    case 'PLATFORM_OWNER':
      return 'Platform Admin';
    case 'LOCATION_ADMIN':
      return 'Location Owner';
    case 'WORKER':
      return 'Worker';
  }
}
