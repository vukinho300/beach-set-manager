# Offline Sync and Conflict Resolution

Status: `prototype_decision`
Last reviewed: 2026-08-28

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

### Second Incident — 2026-08-28

R2 field use exposed a different failure class from the First Incident.

Vuk and Vito concurrently performed unrelated operations from Petalon revision 443.

Vuk's Aquapark update was accepted first as revision 444.

Vito's Set 13 €12 operation had already been:

- made visible;
- admitted;
- durably preserved;
- forwarded to the repository;
- sent with expected revision 443.

The repository returned an explicit `conflict`.

The 443 → 444 server-state diff proves the winning Vuk write changed only Aquapark returned-wristband state and did not modify any Set, Bed or financial transaction.

This proves whole-location CAS is too coarse for normal independent-resource concurrency.

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

## R2 — merged Production containment

R2 is deployed and active.

It provides:

- explicit mutation-admission results;
- bounded pending-store/IndexedDB operations;
- separate `safe` / `securing` / `durable` / `blocked` device-safety state;
- localStorage + IndexedDB recovery paths;
- hard STOP when visible work cannot be durably secured;
- prevention of further unsafe mutations;
- emergency preserved-state export;
- privacy-safe client pipeline telemetry;
- conservative expected-revision CAS protection;
- correct distinction between incoming authoritative Realtime and genuine local divergence.

The Second Incident proves that this containment works materially better than the pre-R2 system: Set 13 was admitted, durable, transmitted, conflict-detected and preserved.

R2 does not solve the granularity of whole-location CAS and does not currently provide a practical conflict-reconciliation/resume workflow.

## Current conflict model after the Second Incident

### Genuine same-resource conflict

If two users attempt incompatible changes to the same exclusive resource, preserve both intents/evidence and require explicit deterministic resolution.

### Proven disjoint-resource conflict

A stale whole-location revision is not sufficient evidence that the underlying business actions conflict.

The Second Incident proves that unrelated Aquapark and Set operations can race on the same revision.

Future conflict logic must distinguish a server-revision conflict from an actual business-resource conflict.

Safe automatic reconciliation/reapply may be permitted only when the system can prove the remote and local operations are disjoint and all business invariants remain valid.

### Ambiguous operation

Never blindly replay an operation when the server outcome is unknown. Stable operation IDs/idempotent commands are the R3 solution.

### Operational recovery

Preserving work without a path to resolve it is incomplete.

The worker must be able to understand the affected operation, preserve evidence, resolve/reapply/discard it according to product rules and return to unrelated work without whole-app indefinite lockout.

## R3 — immediate operation/outbox architecture

The First Incident, the Second Incident and planned multi-worker Koversada operation are evidence that the whole-AppData snapshot buffer should not remain the final commercial write architecture.

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
