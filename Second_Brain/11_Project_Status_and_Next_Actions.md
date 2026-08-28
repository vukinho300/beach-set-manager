# Project Status and Next Actions

Status: `canonical`
Last reviewed: 2026-08-28

## Current state

Shared Petalon v1, Production Reliability R1, Step 9, Production Reliability R2 and the Layer 5 owner-revenue architecture decision are merged.

Current main checkpoint:

`8f7f332e51e402dbdcba4bc63d029f5ff6c4c042`

Canonical Petalon roles:

- Vuk — `PLATFORM_OWNER` — Platform Admin;
- Mark — `LOCATION_ADMIN` — Location Owner;
- Vito — `WORKER` — Worker.

R2 is running in Production.

## Second Incident — current highest-priority reliability evidence

On 2026-08-28, during normal concurrent Petalon operation, Vito attempted to record Set 13 while Vuk performed unrelated Aquapark work.

R2 successfully admitted and durably preserved Vito's €12 Set 13 mutation and sent the repository request.

Both Vuk and Vito attempted writes based on revision 443.

Vuk's unrelated Aquapark wristband-return change was accepted first and became revision 444.

Vito's Set 13 whole-location save then returned an explicit CAS conflict because it still expected revision 443.

Immutable server-state comparison proves revision 443 → 444 changed no Set, Bed or financial transaction; it changed only one Aquapark entry's returned-wristband state.

Therefore whole-location CAS contention between unrelated resources is now a proven Production defect under the intended Vuk/Vito workflow.

Canonical record:

[[18_Production_Incidents_and_Never_Again_Rules]]

## R2 status after field evidence

R2 remains valuable Production containment.

It:

- explicitly admitted Set 13;
- durably preserved the mutation;
- reached repository save;
- detected the stale revision;
- prevented unsafe overwrite;
- preserved forensic evidence;
- blocked further unsafe mutations.

However, current R2 conflict handling is operationally incomplete.

The conflict state replaces the whole operational application and `Check shared data again` only reloads authoritative state. It does not reconcile the preserved operation.

One unrelated-resource CAS collision therefore locked Vito out of normal Petalon work.

## Reliability R3 — immediate priority

Incident 2 satisfies the existing roadmap trigger for promoting R3 after forensic diagnosis.

R3 is now the next reliability architecture priority:

- stable immutable `operation_id` per business action;
- durable client outbox across reopen/retry;
- authenticated idempotent server commands;
- append-only accepted-operation history;
- immutable/voidable financial ledger;
- progressively per-resource/per-entity concurrency boundaries;
- safe treatment of disjoint concurrent operations.

A narrower conflict-recovery patch may be considered before full R3 if needed, but must not use blind whole-state overwrite/rebase.

## Step 10 / Koversada

Draft PR #28 remains open and unmerged.

Its frontend was not in Production during Incident 2.

The reviewed additive Step 10 database foundation has been provisioned remotely, including the Koversada location/memberships and owner Real Revenue boundary, but Production frontend behavior remains the main/R2 Petalon application.

Do not merge/deploy the Step 10 frontend until the Second Incident corrective write/conflict strategy is accepted and verified.

KNO remains separate and untouched.

## Immediate order

1. Record the Second Incident and forensic diagnosis in the Second Brain.
2. Decide the corrective architecture: immediate R3 foundation and whether a narrow pre-R3 conflict-resolution patch is also required.
3. Implement and independently review the selected reliability correction.
4. Test real concurrent disjoint-resource operation: Vuk Aquapark + Vito Sets/Beds/Sunbeds.
5. Verify recovery/resume behavior after deliberately induced conflicts.
6. Only after that reliability gate, re-review/rebase PR #28 as necessary and resume Step 10 frontend rollout.
7. Keep the boss-only Real Revenue vs App Revenue feature as a detection/audit layer, not a replacement for write correctness.
