import { useCallback, useEffect, useMemo, useState } from 'react';
import type { AppData } from '../../domain/appData';
import type { ActiveLocationMembership } from '../location/locationMemberships';
import {
  createSupabaseOwnerRevenueService,
  type OwnerRevenueService,
  type OwnerRevenueSummary,
} from './ownerRevenue';

export type OwnerRevenueState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; summary: OwnerRevenueSummary; saveMessage?: string }
  | { status: 'unavailable'; message: string };

export function useOwnerRevenue(
  authenticatedUserId: string,
  memberships: ActiveLocationMembership[],
  businessDate: string,
  enabled: boolean,
  normalize: (value: unknown, membership: ActiveLocationMembership) => AppData | null,
  suppliedService?: OwnerRevenueService,
) {
  const [service] = useState(
    () => suppliedService ?? createSupabaseOwnerRevenueService(),
  );
  const [reloadVersion, setReloadVersion] = useState(0);
  const [scoped, setScoped] = useState<{
    userId: string | null;
    state: OwnerRevenueState;
  }>({ userId: null, state: { status: 'idle' } });
  const managerMemberships = useMemo(
    () => memberships.filter((membership) => (
      membership.role === 'PLATFORM_OWNER'
      || membership.role === 'LOCATION_ADMIN'
    )),
    [memberships],
  );
  const locationIdentity = managerMemberships
    .map((membership) => membership.locationId)
    .sort()
    .join(':');

  useEffect(() => {
    if (!enabled || managerMemberships.length === 0) {
      setScoped({ userId: authenticatedUserId, state: { status: 'idle' } });
      return;
    }
    let active = true;
    setScoped({ userId: authenticatedUserId, state: { status: 'loading' } });
    void service.load(managerMemberships, businessDate, normalize).then((result) => {
      if (!active) {
        return;
      }
      setScoped({
        userId: authenticatedUserId,
        state: result.status === 'ready'
          ? { status: 'ready', summary: result.summary }
          : result,
      });
    });
    const unsubscribe = service.subscribe(
      managerMemberships.map((membership) => membership.locationId),
      () => setReloadVersion((version) => version + 1),
    );
    return () => {
      active = false;
      unsubscribe();
    };
  }, [
    authenticatedUserId,
    businessDate,
    enabled,
    locationIdentity,
    managerMemberships,
    normalize,
    reloadVersion,
    service,
  ]);

  const save = useCallback(async (
    locationId: string,
    realRevenue: number,
  ) => {
    if (!managerMemberships.some((membership) => membership.locationId === locationId)) {
      setScoped({
        userId: authenticatedUserId,
        state: { status: 'unavailable', message: 'Location manager access is required.' },
      });
      return false;
    }
    const result = await service.save(locationId, businessDate, realRevenue);
    if (result.status === 'unavailable') {
      setScoped({ userId: authenticatedUserId, state: result });
      return false;
    }
    setReloadVersion((version) => version + 1);
    return true;
  }, [authenticatedUserId, businessDate, managerMemberships, service]);

  return {
    state: scoped.userId === authenticatedUserId ? scoped.state : { status: 'loading' } as const,
    save,
    reload: useCallback(() => setReloadVersion((version) => version + 1), []),
  };
}
