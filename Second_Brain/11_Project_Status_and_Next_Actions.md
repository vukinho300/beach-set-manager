# Project Status and Next Actions

Status: `canonical`
Last reviewed: 2026-08-29

## Current state

Shared Petalon v1, Production Reliability R1, Step 9, Production Reliability R2, R2.1 PR #31 and the Layer 5 owner-revenue architecture decision are merged.

Current Production main checkpoint:

`21c6e25d5caf83bf46e53aa260aedab2596e0168`

Draft corrective PR #32 implementation reviewed through:

`87b754802486247662de63a194537abccdd95737`

Canonical Petalon roles:

- Vuk — `PLATFORM_OWNER` — Platform Admin;
- Mark — `LOCATION_ADMIN` — Location Owner;
- Vito — `WORKER` — Worker.

The additive PR #32 Production migration `20260829135041_add_safe_revision_chain_verification` has already been applied and independently verified. The PR #32 frontend is not yet merged/deployed at this documentation checkpoint.

## Second Incident — root concurrency defect

On 2026-08-28 Vito attempted Set 13 while Vuk performed unrelated Aquapark work from the same Petalon revision 443.

Vuk's Aquapark operation became revision 444. Vito's durably preserved Set 13 payment then received explicit whole-location CAS conflict despite the 443→444 diff containing no Set/Bed/financial change.

This proved the whole-location concurrency boundary is too coarse.

## First R2.1 patch — merged but field-invalidated

PR #31 attempted a narrow safe response to the Second Incident.

It could automatically rebase a supported disjoint local operation only after a direct explicit CAS conflict where the authoritative server had advanced by exactly one revision.

That was intentionally conservative, but it was not enough for the real workflow.

The Third Incident on 2026-08-29 reproduced the same operational lockout while both phones ran PR #31:

- base/expected revision 521;
- Vito revision 522: Set 53 `free` → `free` with only `updatedAt`;
- Vito revision 523: Set 53 `free` → `left`;
- Vuk's unrelated Aquapark close sent against 521 and received explicit conflict against 523;
- PR #31 rejected reconciliation before semantic classification because the gap was two rather than one.

The `FREE -> FREE + updatedAt` revision came from a source Set status no-op, not from server corruption or bridge coalescing.

**Status judgment:** PR #31 should not be credited as the fix for normal concurrent Petalon operation. It was operationally useless for the reproduced Incident 3 multi-revision path, although it still supplied valuable safety containment and a correct narrower exactly-one-revision reconciliation mechanism.

## PR #32 — reviewed bounded correction

PR #32 addresses both reasons Incident 3 remained operationally broken.

It:

- prevents semantically unchanged Set/Bed non-financial status actions from creating updatedAt-only revisions;
- permits larger direct known-CAS gaps only with a bounded server proof over private immutable history;
- requires a contiguous chain, actual-current endpoint, strict AppData validation and no intermediate resource value other than base/final;
- retains the strict final business-operation allowlist and same-resource conflict rejection;
- performs only one automatic rebase and persists the rebased pending record before retry;
- adds an explicit upgrade-compatible `Discard local change and use current shared data` action that loads/validates authoritative state before scoped local deletion and never calls repository save.

Verification before merge:

- 268/268 tests pass;
- 64/64 ordered safe two-controller operation-family races pass;
- focused reliability suite 183/183 passes;
- 33/33 real local SQL integration checks pass;
- the real Production Incident 3 immutable chain 521→522→523 proves true under the new semantics;
- current Production chains 539→541 and 540→541 prove true;
- negative proof probes fail closed;
- Production permissions keep private history/helpers sealed.

## Why PR #32 is still theoretical until field validation

The code, tests and Production proof function are reviewed, but the new frontend is not yet running on the real conflicted phone.

Incident 3 remains open until:

1. PR #32 is merged/deployed;
2. the same already-conflicted iPhone opens the new build without clearing site data;
3. the new discard action loads current Petalon, removes only that old local pending record and returns the app to ready/safe while keeping Auth intact;
4. representative controlled two-phone races across Sets/Beds/Sunbeds/Aquapark pass;
5. telemetry and immutable history show both independent intentions survived where expected.

Do not call PR #32 field-validated before those steps.

## Reliability R3 — next architecture priority after the bridge gate

PR #32 remains a bridge over whole-AppData CAS.

R3 remains the next reliability architecture:

- stable immutable `operation_id` per business action;
- durable client outbox across reopen/retry;
- authenticated idempotent server commands;
- append-only accepted-operation history;
- immutable/voidable financial ledger;
- progressively per-resource/per-entity concurrency boundaries;
- safe treatment of ambiguous retries without duplicate financial effects.

## Step 10 / Koversada

Draft PR #28 remains open and unmerged.

The reviewed additive Step 10 database foundation has been provisioned remotely, including the Koversada location/memberships and owner Real Revenue boundary, but Production frontend behavior remains the main Petalon application.

Do not merge/deploy the Step 10 frontend until the current reliability corrective path is field-validated and R3 sequencing is re-confirmed.

KNO remains separate and untouched.

## Immediate order

1. Include this Second Brain reconciliation in PR #32 before merge.
2. Merge PR #32 only after the final branch/deployment checks remain green.
3. Verify the exact merged `main` Vercel Production deployment.
4. Recover Vuk's already-conflicted iPhone in place using the new scoped discard/use-current action; do not clear site data first.
5. Run controlled representative two-device concurrency tests across all operational domains, guided by the 64-case deterministic matrix rather than manually repeating every permutation.
6. Inspect telemetry and immutable history.
7. If the field gate passes, record Incident 3 as resolved by the bounded R2.1 correction and begin R3A design immediately.
8. Re-review/rebase PR #28 only after the reliability gate.
9. Keep Layer 5 Real Revenue vs App Revenue as a detection/audit layer, not a replacement for write correctness.
