# Offline Sync and Conflict Resolution

Status: `prototype_decision`
Last reviewed: 2026-08-29

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

### R2.1 PR #31 — first bounded reconciliation attempt

PR #31 was merged after the Second Incident to provide a narrow pre-R3 bridge.

It did **not** introduce generic snapshot merge. For a direct explicit CAS conflict it compared:

- confirmed/base AppData;
- latest durably preserved local desired AppData;
- current authoritative AppData.

It classified only an allowlist of supported business bundles such as Set/Bed status/payment, non-numbered Sunbed add, Aquapark add/return/close, rejected same-resource/unsupported overlap, durably rewrote the pending base, and retried at most once.

However, it had one hard eligibility rule:

`current.revision === expectedRevision + 1`

That rule deliberately avoided using only a final BASE→CURRENT snapshot across several accepted revisions because intermediate history could hide unsafe events such as add/remove, reset/restore or a resource taking an intermediate third value.

This was conservative, but the implementation/tests assumed the real conflict would have only one winning remote revision.

### Third Incident — 2026-08-29

The first R2.1 patch failed the first deliberate real two-phone reproduction.

Both devices ran Production build `21c6e25d5caf83bf46e53aa260aedab2596e0168`.

Vuk closed an Aquapark entry while Vito marked Set 53 left/closed.

Both relevant operations were based on revision 521.

Vito's phone generated:

- revision 522: Set 53 remained `free`; only `updatedAt` was added;
- revision 523: Set 53 changed `free` → `left`.

Vuk's Aquapark close was visible, admitted, durably preserved and sent with expected revision 521. The repository returned explicit conflict because current was already revision 523.

PR #31 therefore did not even call the known-conflict reconciler: `523 !== 521 + 1`.

The full-screen `Newer shared data exists` lockout returned and there was still no in-app way to deliberately discard the preserved test operation and resume normal work.

The revision-522 no-op was traced to source UI behavior, not bridge coalescing: calling Set status `free` on an already-free Set stamped a new `updatedAt` and created a real server revision despite no meaningful business change.

**Operational conclusion:** PR #31 was useless for this reproduced real multi-revision race. It was not useless as safety containment and could still handle exactly-one-revision disjoint conflicts, but it did not make the intended normal Petalon concurrent workflow reliable and must not be counted as a successful field fix.

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

R2 containment worked in both the Second and Third Incidents: the losing local operation was preserved, unsafe overwrite was prevented and telemetry/history exposed the exact failure.

R2 does not solve the granularity of whole-location CAS by itself.

## R2.1 corrective bridge — Draft PR #32

PR #32 is the reviewed correction to the failed first R2.1 field assumption.

### 1. Remove meaningless source revisions

Set and Bed same-status non-financial actions are suppressed before React/shared-state mutation when they would only refresh `updatedAt`.

Paid actions are never suppressed because they create a financial bundle.

This directly removes the specific `FREE -> FREE + updatedAt` source behavior that created revision 522 in Incident 3.

### 2. Prove larger revision gaps instead of assuming they are safe

A direct explicit CAS conflict with `current.revision > expectedRevision` may be considered.

- `+1` remains directly eligible under the existing strict rules.
- A larger gap is eligible only when the server returns a positive proof for the complete immutable revision chain.
- The proof is bounded to a maximum gap of 10 revisions.
- History must be contiguous and end at the actual current authoritative revision.
- Every snapshot must satisfy the strict AppData shape/identity contract.
- For every projected resource, every intermediate value must equal either the base value or the final value.

This rejects hidden third values, add/remove, reset/restore and transaction disappearance that a final BASE→CURRENT snapshot alone could hide.

The public RPC returns only a boolean. Private historical AppData and helper functions remain inaccessible to browser roles.

### 3. Reuse the strict semantic business allowlist

A positive history proof does not itself authorize a merge.

The controller still requires:

- direct explicit known CAS rejection;
- no prior ambiguous outcome;
- exact confirmed/pending/attempt metadata alignment;
- durable latest desired state;
- `automaticRebaseCount = 0`;
- full final BASE→LOCAL and BASE→CURRENT classification;
- disjoint/compatible resource footprints;
- strict transaction identity/bundle rules.

The rebase starts from current authoritative server state and applies only the proven local semantic patches. The rewritten pending base/desired state is durably persisted before the network retry. Only one automatic rebase is allowed.

### 4. Add a real conflict exit

The preserved-conflict screen gains an explicit destructive local action:

`Discard local change and use current shared data`

It requires confirmation and states that the server will not be changed.

The controller must:

1. load latest authoritative state;
2. validate it;
3. remove both durable pending mirrors for only the exact user+location;
4. prevent stale queued IndexedDB saves for that same key from resurrecting the record;
5. clear in-memory pending/attempt state;
6. adopt the loaded authoritative state and return to ready/safe.

If authoritative load or local removal fails, the conflict remains preserved. The action performs no repository save.

The implementation explicitly supports an old pending record created by the already-deployed R2.1 build, so a conflicted phone should be able to upgrade in place without clearing all site data or signing out.

### 5. Verification evidence

Before merge, PR #32 has:

- 268/268 application tests passing;
- 64/64 ordered safe two-controller pairings across the eight supported operation families;
- multi-revision Incident 3 regression passing;
- two- and three-remote-revision races passing where proof/allowlist permit;
- negative same-resource, malformed, deletion, reset/import and unsupported cases failing closed;
- restart, ambiguity, durability-before-retry and second-conflict coverage;
- 33/33 real local SQL integration checks;
- Production migration applied/verified before frontend merge.

Independent Production verification of the real immutable Incident 3 history shows revisions 521→522→523 are contiguous, well-formed and monotonic under the new proof semantics.

## Current conflict model

### Genuine same-resource conflict

If two users attempt incompatible changes to the same exclusive resource, preserve both intents/evidence and require explicit deterministic resolution.

### Proven disjoint-resource conflict

A stale whole-location revision is not sufficient evidence that the underlying business actions conflict.

Safe automatic reconciliation/reapply may occur only when both the history proof (where needed) and the strict semantic final-delta classifier prove compatibility.

### Ambiguous operation

Never blindly replay an operation when the server outcome is unknown. Stable operation IDs/idempotent commands are the R3 solution.

### Operational recovery

Preserving work without a path to resolve it is incomplete.

The PR #32 discard action supplies one deliberate exit when the user decides the local preserved operation is no longer wanted. It is not a substitute for operation-level recovery/idempotency.

## Field-validation status

PR #32 is **not yet field-validated** at this documentation checkpoint.

The frontend still needs to be merged/deployed, then the same already-conflicted iPhone must recover in place without clearing site data. Representative real two-phone races must then exercise Sets, Beds, non-numbered Sunbeds and Aquapark.

Until those gates pass, describe PR #32 as the reviewed/theoretically correct bounded correction, not a proven final fix.

## R3 — immediate operation/outbox architecture

The First, Second and Third Incidents and planned multi-worker Koversada operation are evidence that the whole-AppData snapshot buffer should not remain the final commercial write architecture.

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
