# Current Architecture and Repository State

Status: `canonical`
Repository reviewed: 2026-08-29
Production main checkpoint: `21c6e25d5caf83bf46e53aa260aedab2596e0168`
Corrective implementation reviewed: Draft PR #32 code head `87b754802486247662de63a194537abccdd95737`

## Application

Beach Set Manager is a React 18 + Vite + TypeScript PWA deployed through Vercel.

The frontend remains relatively monolithic in `src/App.tsx`, while Supabase/Auth/shared-state/recovery concerns have progressively moved into dedicated services.

## Authoritative backend

Beach Set Manager uses a dedicated Supabase/Postgres project.

Petalon is represented as location:

`00000000-0000-4000-8000-000000000001`

Authoritative operational state currently remains one versioned `public.location_state` JSONB row per location:

- `location_id`;
- `state`;
- `revision`;
- `updated_at`;
- `updated_by`.

Writes use expected-revision compare-and-swap protection.

Supabase is authoritative for server-confirmed state.

Private immutable `location_state_history` records accepted revisions for forensics and now also supports a narrow boolean multi-revision safety proof. The public browser does not receive historical AppData from that proof.

## Authentication and membership

Supabase Auth is active.

Canonical Petalon memberships:

- Vuk — `PLATFORM_OWNER`;
- Mark — `LOCATION_ADMIN`;
- Vito — `WORKER`.

`location_memberships` + RLS are the access/revocation boundary.

Frontend role presentation is not the database security boundary.

## Current reliability architecture in Production main

Production Reliability R1 provides:

- background authoritative convergence;
- UI continuity;
- user/location-scoped pending recovery;
- retry/resume behavior;
- conservative conflict handling.

Production Reliability R2 adds:

- explicit visible-mutation admission;
- bounded device-durability operations;
- localStorage + IndexedDB resilience;
- fail-closed unsafe-write behavior;
- emergency preserved-state export;
- client write-stage telemetry;
- authoritative-Realtime versus local-divergence classification.

R2.1 PR #31 is also merged in Production main. It introduced a strict `reconcileKnownRejectedConflict` path for supported disjoint business bundles after a **direct explicit CAS rejection**, with one durable automatic rebase/retry and no blind JSON merge.

The decisive limitation is that PR #31 only entered this reconciliation when:

`current.revision === expectedRevision + 1`

That exact-one-revision gate was intended to avoid unsafe inference from hidden intermediate snapshots, but the Third Incident proved it too narrow for normal production behavior.

## Third Incident — proven PR #31 limitation

On 2026-08-29 both devices ran the R2.1 Production build.

Vuk's unrelated Aquapark close and Vito's Set 53 workflow were based on revision 521.

Vito generated two accepted revisions before Vuk's request returned:

- 521 → 522: Set 53 stayed `free`; only `updatedAt` appeared;
- 522 → 523: Set 53 changed `free` → `left`.

Vuk's Aquapark close was durably preserved and sent with expected revision 521. The repository returned explicit conflict against revision 523.

Because the revision gap was two, PR #31 never invoked the semantic disjoint-resource reconciler. The full-screen conflict lockout returned.

This means PR #31 was not a successful field correction for the real concurrency problem. It remained useful safety containment and could reconcile narrower exactly-one-revision races, but it was operationally useless for the reproduced Incident 3 path.

The `FREE -> FREE + updatedAt` revision was traced to the application Set status workflow: marking an already-free Set as Free still stamped a new `updatedAt`, creating a semantically meaningless shared revision before the actual `LEFT` transition.

## Draft PR #32 corrective architecture

PR #32 remains unmerged at this documentation checkpoint, but its code/tests have passed independent review.

It adds:

- source-level Set/Bed no-op suppression so same-status non-financial actions do not create `updatedAt`-only shared revisions;
- multi-revision known-CAS eligibility when `current.revision > expectedRevision`, but only for direct explicit conflicts and only when a larger-than-one gap has a server-proven bounded revision chain;
- a maximum proof gap of 10 revisions;
- strict server-side AppData validation and private resource projection;
- proof that every intermediate resource value is either its base value or its final value, rejecting hidden third values, add/remove, reset/restore and transaction disappearance;
- the existing strict final BASE→LOCAL and BASE→CURRENT operation classifier/allowlist;
- one automatic rebase only, with the rebased pending record durably persisted before retry;
- a scoped conflict-discard path that loads/validates current authoritative state first, removes both local durable mirrors only for the exact user+location, then returns the controller to ready/safe without any repository save.

The additive migration `20260829135041_add_safe_revision_chain_verification` has already been applied to Beach Set Manager Production before the frontend merge. It creates the boolean `public.verify_location_state_revision_chain(...)` RPC plus non-public private helpers. Anon cannot execute the public RPC; authenticated users require active membership for a positive proof; private helpers/history remain unavailable to browser roles.

Independent Production verification confirms:

- the migration is recorded exactly once;
- the real Incident 3 revisions 521–523 are contiguous, strict-validation compatible and monotonic under the proof semantics;
- current chains 539→541 and 540→541 return true;
- >10 gaps, wrong-current revision and nonexistent location return false.

## Why PR #32 is only a bounded bridge

PR #32 should theoretically handle the exact Incident 3 class because it removes the redundant source write when possible and, when several legitimate remote revisions still occur, it can prove the intermediate chain before applying the same strict disjoint-operation rebase.

It is not R3 and does not make snapshot merging generally safe.

It still intentionally fails closed when:

- history is missing/non-contiguous;
- the gap exceeds 10;
- an intermediate resource takes a third value or is added/removed/restored;
- final local/remote deltas do not fit the allowlist;
- the same resource is changed incompatibly;
- an earlier request outcome is ambiguous;
- a second conflict occurs after the one automatic rebase.

The frontend is not yet field-validated. Incident 3 remains open until the preserved old iPhone conflict recovers in place after deployment and representative two-device concurrency tests pass.

## Current transaction/report model

`AppData` includes:

- 56 numbered Sets;
- 4 Extra Beds;
- beach reservations;
- saved surnames;
- non-numbered Sunbed sales;
- Aquapark entries;
- current transaction ledger;
- Report Archive;
- automatic reset date.

Transactions support active/deleted state.

Reports derive revenue from transaction data.

## Step 10 / Koversada status

Draft PR #28 implements the multi-location frontend architecture but remains unmerged.

The reviewed additive database foundation has been provisioned remotely.

Koversada exists as:

`00000000-0000-4000-8000-000000000002`

with Aquapark-only profile and separate memberships/state.

Production frontend code remains current main/R2/R2.1, not PR #28.

Do not treat Step 10 frontend behavior as Production until PR #28 or its successor is reviewed, merged and deployed after the reliability gate.

## Architecture direction

The whole-AppData JSONB row remains an MVP bridge.

Reliability R3 should move real business actions toward:

- immutable client operation IDs;
- durable operation outbox;
- authenticated idempotent server commands;
- append-only accepted-operation history;
- immutable/voidable financial ledger;
- narrower entity/resource concurrency boundaries.

KNO remains unrelated and untouched.
