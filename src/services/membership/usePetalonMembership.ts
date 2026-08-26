import { useCallback, useEffect, useState } from 'react';
import {
  createSupabasePetalonMembershipService,
  PETALON_LOCATION_ID,
  type ActivePetalonMembership,
  type PetalonMembershipService,
} from './petalonMembership';

export type PetalonMembershipSessionState =
  | { status: 'loading' }
  | { status: 'active'; membership: ActivePetalonMembership }
  | { status: 'inactive' }
  | { status: 'unavailable'; message: string };

export type UserScopedPetalonMembership = {
  userId: string | null;
  state: PetalonMembershipSessionState;
};

export type PetalonMembershipSession = {
  state: PetalonMembershipSessionState;
  reload(): void;
};

const LOADING_MEMBERSHIP = { status: 'loading' } as const;

export function scopeMembershipToAuthenticatedUser(
  authenticatedUserId: string | null,
  scopedState: UserScopedPetalonMembership,
): PetalonMembershipSessionState {
  return authenticatedUserId && scopedState.userId === authenticatedUserId
    ? scopedState.state
    : LOADING_MEMBERSHIP;
}

export function usePetalonMembership(
  authenticatedUserId: string | null,
  service?: PetalonMembershipService,
): PetalonMembershipSession {
  const [membershipService] = useState(
    () => service ?? createSupabasePetalonMembershipService(),
  );
  const [reloadVersion, setReloadVersion] = useState(0);
  const [scopedState, setScopedState] = useState<UserScopedPetalonMembership>({
    userId: null,
    state: LOADING_MEMBERSHIP,
  });

  useEffect(() => {
    if (!authenticatedUserId) {
      setScopedState({ userId: null, state: LOADING_MEMBERSHIP });
      return;
    }

    let active = true;
    setScopedState({ userId: authenticatedUserId, state: LOADING_MEMBERSHIP });
    void membershipService
      .load(authenticatedUserId, PETALON_LOCATION_ID)
      .then((state) => {
        if (active) {
          setScopedState({ userId: authenticatedUserId, state });
        }
      })
      .catch(() => {
        if (active) {
          setScopedState({
            userId: authenticatedUserId,
            state: {
              status: 'unavailable',
              message: 'Petalon membership could not be verified. Please retry.',
            },
          });
        }
      });

    return () => {
      active = false;
    };
  }, [authenticatedUserId, membershipService, reloadVersion]);

  const reload = useCallback(() => setReloadVersion((version) => version + 1), []);
  return {
    state: scopeMembershipToAuthenticatedUser(authenticatedUserId, scopedState),
    reload,
  };
}
