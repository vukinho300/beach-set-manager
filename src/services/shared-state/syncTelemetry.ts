import { getSupabaseClient } from '../supabase/client';

export const CLIENT_SYNC_EVENT_CODES = [
  'MUTATION_VISIBLE',
  'BRIDGE_FORWARDED',
  'CONTROLLER_ACCEPTED',
  'CONTROLLER_REJECTED',
  'DURABILITY_START',
  'DURABILITY_CONFIRMED',
  'DURABILITY_FAILED',
  'DURABILITY_TIMEOUT',
  'REPOSITORY_SAVE_START',
  'REPOSITORY_SAVE_RESULT',
  'RETRY_SCHEDULED',
  'CONTROLLER_BLOCKED',
  'APP_BOOT',
  'VISIBILITY_RESUME',
] as const;

export type ClientSyncEventCode = typeof CLIENT_SYNC_EVENT_CODES[number];

export type ClientSyncEvent = {
  eventCode: ClientSyncEventCode;
  mutationSequence?: number;
  expectedRevision?: number;
  durationMs?: number;
  errorCategory?: string;
};

export type ClientSyncTelemetry = {
  readonly bootSessionId: string;
  record(event: ClientSyncEvent): void;
};

function createBootSessionId(): string {
  try {
    return globalThis.crypto.randomUUID();
  } catch {
    return '00000000-0000-4000-8000-000000000000';
  }
}

function getBuildIdentifier(): string {
  const build = import.meta.env.VITE_VERCEL_GIT_COMMIT_SHA
    ?? import.meta.env.VITE_APP_BUILD_ID
    ?? 'development';
  return build.slice(0, 100);
}

export function createClientSyncTelemetry(locationId: string): ClientSyncTelemetry {
  const bootSessionId = createBootSessionId();
  const appBuild = getBuildIdentifier();

  return {
    bootSessionId,
    record(event) {
      try {
        const client = getSupabaseClient();
        if (!client) {
          return;
        }

        // Diagnostics are deliberately fire-and-forget. Observability must never
        // become a dependency of the operational save path.
        void Promise.resolve(client.rpc('record_client_sync_event', {
          p_location_id: locationId,
          p_boot_session_id: bootSessionId,
          p_app_build: appBuild,
          p_event_code: event.eventCode,
          p_mutation_sequence: event.mutationSequence,
          p_expected_revision: event.expectedRevision,
          p_duration_ms: event.durationMs,
          p_error_category: event.errorCategory,
        })).catch(() => undefined);
      } catch {
        // Synchronous client/configuration failures are also diagnostics-only.
      }
    },
  };
}

export function createNoopClientSyncTelemetry(): ClientSyncTelemetry {
  return {
    bootSessionId: '00000000-0000-4000-8000-000000000000',
    record: () => undefined,
  };
}
