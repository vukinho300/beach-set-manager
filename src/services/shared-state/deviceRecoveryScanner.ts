import {
  createIndexedDbPendingSharedStateStore,
  type PendingSharedStateStore,
} from './pendingSharedStateStore';

const LEGACY_CACHE_NAME = 'beach-set-manager-v1';

export type DeviceRecoverySnapshot<T> = {
  source: 'pending-state' | 'legacy-api-cache';
  serverRevision: number | null;
  data: T;
};

type LocationStateCandidate = {
  locationId: string;
  revision: number | null;
  state: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function parseCachedLocationStatePayload(
  payload: unknown,
  locationId: string,
): LocationStateCandidate[] {
  const rows = Array.isArray(payload) ? payload : [payload];

  return rows.reduce<LocationStateCandidate[]>((candidates, row) => {
    if (!isRecord(row) || row.location_id !== locationId || !('state' in row)) {
      return candidates;
    }

    const revision = typeof row.revision === 'number' && Number.isSafeInteger(row.revision)
      ? row.revision
      : null;
    return [...candidates, { locationId, revision, state: row.state }];
  }, []);
}

export async function scanDeviceRecoverySnapshots<T>(
  userId: string,
  locationId: string,
  normalize: (value: unknown) => T | null,
  pendingStore: PendingSharedStateStore<T> = createIndexedDbPendingSharedStateStore<T>(),
): Promise<DeviceRecoverySnapshot<T>[]> {
  const snapshots: DeviceRecoverySnapshot<T>[] = [];

  try {
    const pending = await pendingStore.load(userId, locationId);
    const normalized = pending ? normalize(pending.desiredState) : null;
    if (pending && normalized) {
      snapshots.push({
        source: 'pending-state',
        serverRevision: pending.baseRevision,
        data: normalized,
      });
    }
  } catch {
    // Continue to the legacy cache. Safari can make either store unavailable.
  }

  if (!globalThis.caches) {
    return snapshots;
  }

  try {
    const cacheNames = await globalThis.caches.keys();
    if (!cacheNames.includes(LEGACY_CACHE_NAME)) {
      return snapshots;
    }

    const cache = await globalThis.caches.open(LEGACY_CACHE_NAME);
    const requests = await cache.keys();
    for (const request of requests) {
      const url = new URL(request.url);
      if (!url.pathname.includes('/rest/v1/location_state')) {
        continue;
      }

      const response = await cache.match(request);
      if (!response) {
        continue;
      }

      try {
        const payload: unknown = await response.clone().json();
        for (const candidate of parseCachedLocationStatePayload(payload, locationId)) {
          const normalized = normalize(candidate.state);
          if (normalized) {
            snapshots.push({
              source: 'legacy-api-cache',
              serverRevision: candidate.revision,
              data: normalized,
            });
          }
        }
      } catch {
        // A non-JSON or unreadable cached response is not a recovery candidate.
      }
    }
  } catch {
    // Recovery is best-effort and must never interrupt the operational app.
  }

  return snapshots;
}
