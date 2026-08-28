# Experiments and Evidence

Status: `experiment`
Last reviewed: 2026-08-28

Production evidence outranks synthetic assumptions. Each material field event must update the architecture when it disproves an earlier assumption.

## E-001 — Shared Petalon production verification

Result: PASS.

Real Vuk/Vito/Mark authenticated use proved:

- Supabase shared Petalon state works across devices;
- active membership/RLS provides access control;
- Realtime propagates accepted state;
- revision-safe writes prevent silent stale overwrite.

This established Shared Petalon v1.

## E-002 — Production Reliability R1 field evidence

Result: PARTIAL.

Real phone use proved background convergence and UI continuity were necessary.

R1 improved:

- in-place authoritative refresh;
- tab/scroll continuity;
- user/location-scoped durable pending state;
- retry/resume behavior.

The First Incident later proved R1 was insufficient.

## E-003 — First Incident, 2026-08-27

Result: FAIL.

Approximately twenty visible iPhone Home Screen PWA operational changes did not reach Supabase.

Server revision evidence showed no accepted hidden Vuk revisions during the missing interval.

The exact client exception was not captured.

Architecture impact:

- explicit admission required;
- durability gates must be bounded;
- unsafe durability must fail closed;
- pipeline telemetry required;
- immutable server history required.

This produced R2.

## E-004 — Production Reliability R2

Result before Second Incident: containment implemented.

R2 introduced:

- explicit mutation admission;
- bounded durability;
- fail-closed unsafe writes;
- preserved-state recovery;
- pipeline telemetry;
- correct distinction between incoming Realtime and local mutation.

## E-005 — Second Incident, 2026-08-28

Result: FAIL for normal disjoint-resource concurrency; PASS for R2 containment.

Setup:

- Petalon Production;
- Vuk on iPhone/5G operating Aquapark;
- Vito on Android/5G operating the sunbed/set round;
- both using normal intended workflow.

Evidence:

- both devices began relevant writes from revision 443;
- Vuk repository save started first and was accepted;
- Vito's Set 13 mutation was visible, admitted and durably secured;
- Vito repository save started with expected revision 443;
- Vuk's accepted write became revision 444;
- Vito repository result was `conflict`;
- revision 443 → 444 changed only one Aquapark entry's returned-wristband state;
- there was no Set, Bed or transaction change in the winning revision;
- Set 13 remained preserved locally and never appeared in accepted server history.

Conclusion:

The current whole-location CAS boundary creates false contention between unrelated business actions.

R2 correctly preserved evidence and prevented overwrite, but current conflict UX created an unacceptable whole-app worker lockout.

Architecture impact:

- R3 promoted to immediate reliability priority;
- disjoint-resource concurrency must receive direct release coverage;
- conflict detection must gain safe reconciliation/resume behavior.

## Required next evidence

### E-006 — Disjoint-resource concurrency after correction

Run separate real devices simultaneously:

- Vuk Aquapark changes;
- Vito Set/Bed/Sunbed changes.

Expected:

- unrelated operations both succeed safely;
- no false whole-location conflict;
- no lost financial transaction;
- Realtime converges;
- worker position/continuity remains usable.

### E-007 — Genuine same-resource conflict

Two devices intentionally attempt incompatible actions against the same resource.

Expected:

- no silent overwrite;
- deterministic conflict;
- both intents/evidence preserved as required;
- worker receives practical resolution path.

### E-008 — Operation-id idempotency

After R3 foundation:

- send one operation;
- simulate ambiguous response/retry;
- retry identical `operation_id`.

Expected:

- one accepted operation;
- one financial effect;
- duplicate retry returns prior accepted result.

### E-009 — PWA lifecycle with durable operation outbox

After R3:

- create operation;
- background/lock/close/reopen;
- change connection state;
- resume.

Expected:

- operation survives;
- retry is safe;
- no duplicate;
- worker does not need to monitor revision numbers.

### E-010 — Backup/PITR restore drill

Before commercial rollout, prove accepted server data can be restored into a clean recovery environment.
