# Offline Sync and Conflict Resolution

Status: `prototype_decision`
Last reviewed: 2026-08-27

## Goal

Workers must not silently lose a submitted Beach, Bed, Sunbed or Aquapark change during mobile-network loss, PWA suspension/reopen, browser-storage failure or concurrent multi-user operation. Supabase remains authoritative for server-confirmed facts.

## Evidence progression

### Production evidence — 2026-08-26

Real phone use proved the earlier fully-online assumption insufficient:

- normal Realtime refresh could disrupt worker position;
- Vuk and Vito observed entries disappear around connection/unavailable behavior;
- workers may no longer remember wristband/set numbers after physically moving on.

This produced Production Reliability R1.

### First Incident — 2026-08-27

R1 was still insufficient. During a real round on Vuk's installed iPhone Home Screen PWA, roughly twenty visible operations never reached Supabase. Server evidence proves no accepted Vuk revision existed during the missing period. The exact client exception is unproven; the important failure class is a pre-network pipeline/durability failure while the UI remained usable.

This produced the permanent rules in [[18_Production_Incidents_and_Never_Again_Rules]] and the R2/R3 reliability track.

## R1 — merged baseline

R1 provides:

- background authoritative convergence without remount/scroll reset;
- optimistic local state during retryable server/network failure;
- user/location-scoped durable pending snapshot recovery;
- bounded retry/backoff and resume on online/focus/visibility;
- CAS/expected-revision protection;
- conservative conflict behavior;
- attempted-save ambiguity barrier;
- narrow compatible Beach-set recovery only where proven safe;
- account-switch isolation and RLS authority.

R1 does not make a device-only pending mutation server-confirmed.

## R2 — fail-closed containment, PR #25 pending release verification

R2 addresses the First Incident class without yet replacing the whole-AppData model:

- explicit mutation-admission results instead of silent controller returns;
- bounded pending-store/IndexedDB operations;
- separate `safe` / `securing` / `durable` / `blocked` device-safety state;
- localStorage + IndexedDB recovery paths;
- hard STOP if the current visible mutation cannot be durably secured;
- further operational mutations blocked while unsafe;
- emergency recovery export from the visible in-memory AppData;
- privacy-safe client write-stage telemetry;
- normal network failure can continue only when the local mutation is durably preserved;
- incoming authoritative Realtime is explicitly distinguished from genuine local divergence so another worker's save does not create a false STOP.

R2 is not Production-approved until the affected iPhone Home Screen PWA passes realistic lifecycle, concurrent-device, walking-style and controlled-failure Preview tests.

## Current conflict categories

### Safe accepted/ambiguous retry

If the server proves it already contains the exact attempted state, treat it as accepted rather than duplicating it.

### Narrow compatible Beach recovery

Only for an unattempted pending whole-AppData snapshot where the non-set state is unchanged and every locally changed set is either unchanged on the server or already equal to the desired value.

### Business/financial conflict

Do not force overwrite. Preserve pending work and require deliberate recovery. Aquapark, reservations, sales, transactions and other financial/business changes are not broadly auto-rebased.

## R3 — planned operation/outbox architecture

The First Incident plus planned multi-worker Koversada operation are evidence that the whole-AppData snapshot buffer should not remain the final commercial write architecture.

R3 should move business actions toward immutable commands:

- one stable UUID `operation_id` per real action;
- durable client outbox record retained across reopen/retry;
- authenticated server command derives `auth.uid()` and validates active location membership;
- unique server operation ID makes retry idempotent;
- accepted operation stored in append-only audit history;
- financial side effect inserted atomically and corrected through explicit void/reversal semantics;
- per-entity/version concurrency where needed so independent resources do not contend on one whole-location revision.

Examples of future commands include set payment, bed payment, non-numbered sunbed sale, Aquapark entry/return and reservation actions.

## Multi-user concurrency

Concurrent devices are normal operation:

- Petalon: Vuk/Vito/Mark may have the app open simultaneously.
- Koversada: a Worker operates while Vuk/Mark monitor; next season multiple independent Koversada Worker accounts may operate simultaneously.

A remote authoritative update must converge without false safety blocking. A real interleaved local mutation must still enter durability/admission protection and must not be swallowed.

## Background Sync

Browser Background Sync may be an enhancement only. It is not a correctness dependency because support/lifecycle behavior is not universal. Normal app startup/resume must recover durable local operations itself.

## Offline/safety UX

The UI must clearly distinguish:

- server-confirmed saved;
- securing on device;
- durably preserved on device and retrying server;
- connection stale while confirmed state remains visible;
- hard blocked because device durability is unsafe;
- conflict requiring deliberate resolution.

A small banner alone is not a sufficient safety mechanism when continuing work would risk silent loss.
