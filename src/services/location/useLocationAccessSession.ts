import { useCallback, useEffect, useState } from 'react';
import { PETALON_LOCATION_ID } from '../../domain/location';
import {
  createSupabaseLocationMembershipsService,
  type ActiveLocationMembership,
  type LocationMembershipsService,
} from './locationMemberships';

const SELECTED_LOCATION_STORAGE_PREFIX =
  'beach-set-manager:selected-location:v1:';

export type LocationAccessState =
  | { status: 'loading' }
  | {
      status: 'active';
      memberships: ActiveLocationMembership[];
      selected: ActiveLocationMembership;
    }
  | { status: 'inactive' }
  | { status: 'unavailable'; message: string };

export type UserScopedLocationAccess = {
  userId: string | null;
  state: LocationAccessState;
};

export type LocationAccessSession = {
  state: LocationAccessState;
  selectLocation(locationId: string): void;
  reload(): void;
};

const LOADING_ACCESS = { status: 'loading' } as const;

function selectionStorageKey(userId: string): string {
  return `${SELECTED_LOCATION_STORAGE_PREFIX}${userId}`;
}

export function chooseSelectedLocation(
  userId: string,
  memberships: ActiveLocationMembership[],
  storage: Pick<Storage, 'getItem'>,
): ActiveLocationMembership {
  let savedLocationId: string | null = null;
  try {
    savedLocationId = storage.getItem(selectionStorageKey(userId));
  } catch {
    // Selection is a non-operational UI preference.
  }

  return memberships.find((membership) => membership.locationId === savedLocationId)
    ?? memberships.find((membership) => membership.locationId === PETALON_LOCATION_ID)
    ?? memberships[0];
}

export function scopeLocationAccessToAuthenticatedUser(
  authenticatedUserId: string | null,
  scoped: UserScopedLocationAccess,
): LocationAccessState {
  return authenticatedUserId && scoped.userId === authenticatedUserId
    ? scoped.state
    : LOADING_ACCESS;
}

export function useLocationAccessSession(
  authenticatedUserId: string | null,
  service?: LocationMembershipsService,
): LocationAccessSession {
  const [membershipService] = useState(
    () => service ?? createSupabaseLocationMembershipsService(),
  );
  const [reloadVersion, setReloadVersion] = useState(0);
  const [scoped, setScoped] = useState<UserScopedLocationAccess>({
    userId: null,
    state: LOADING_ACCESS,
  });

  useEffect(() => {
    if (!authenticatedUserId) {
      setScoped({ userId: null, state: LOADING_ACCESS });
      return;
    }

    let active = true;
    setScoped({ userId: authenticatedUserId, state: LOADING_ACCESS });
    void membershipService.load(authenticatedUserId).then((result) => {
      if (!active) {
        return;
      }
      if (result.status !== 'active') {
        setScoped({ userId: authenticatedUserId, state: result });
        return;
      }

      setScoped({
        userId: authenticatedUserId,
        state: {
          status: 'active',
          memberships: result.memberships,
          selected: chooseSelectedLocation(
            authenticatedUserId,
            result.memberships,
            window.localStorage,
          ),
        },
      });
    }).catch(() => {
      if (active) {
        setScoped({
          userId: authenticatedUserId,
          state: {
            status: 'unavailable',
            message: 'Location access could not be verified. Please retry.',
          },
        });
      }
    });

    return () => {
      active = false;
    };
  }, [authenticatedUserId, membershipService, reloadVersion]);

  const selectLocation = useCallback((locationId: string): void => {
    setScoped((current) => {
      if (
        !current.userId
        || current.userId !== authenticatedUserId
        || current.state.status !== 'active'
      ) {
        return current;
      }
      const membership = current.state.memberships.find(
        (candidate) => candidate.locationId === locationId,
      );
      if (!membership) {
        return current;
      }

      try {
        window.localStorage.setItem(
          selectionStorageKey(current.userId),
          membership.locationId,
        );
      } catch {
        // Selection persistence is best-effort and carries no operational data.
      }
      return {
        userId: current.userId,
        state: {
          ...current.state,
          selected: membership,
        },
      };
    });
  }, [authenticatedUserId]);

  return {
    state: scopeLocationAccessToAuthenticatedUser(authenticatedUserId, scoped),
    selectLocation,
    reload: useCallback(() => setReloadVersion((version) => version + 1), []),
  };
}
