# Production Incidents and Never-Again Rules

Status: `canonical`
Last reviewed: 2026-08-29

This note exists so severe production failures become permanent architecture and release rules rather than one-off bug fixes.

# First Incident — 2026-08-27

## Operational impact

During a real Petalon round, Vuk used the installed iPhone Home Screen PWA to record roughly twenty entries across numbered sets, extra beds and non-numbered sunbeds during approximately 11:40–12:45 Europe/Zagreb time. The UI appeared to accept the work, but Supabase received no Petalon state write from the affected iPhone during that period. The discrepancy was discovered roughly 20–30 minutes after the round when Vito, working concurrently from Android, saw that the shared revenue total was much lower than expected.

This is the **First Incident**. A comparable silent-loss event in a customer deployment would be commercially unacceptable.

## Real round workflow

The product must support this as normal production use:

1. Reach a customer/resource physically.
2. Establish price and take payment on the separate Marketino terminal.
3. Give the Marketino receipt.
4. Step aside, open the iPhone Home Screen PWA and record the set/bed/sunbed entry.
5. Continue walking and remain scrolled near the current physical beach position.
6. Frequently background, close and reopen the PWA during the shift.
7. Work while another authenticated worker is using the same location from another phone.

The worker must not need to inspect a small sync banner or revision after every customer.

## Proven facts

- Vuk successfully wrote through Petalon revision 262 at 11:10:19.
- The iPhone successfully read state afterward; Auth refresh and Realtime connectivity also existed during the missing period.
- Supabase received zero Vuk/iPhone Petalon state PATCHes during approximately 11:40–12:45.
- Vito later wrote revision 263 using expected revision 262, proving there was no hidden accepted Vuk revision in between.
- The missing operations were not accepted and then overwritten by a later server revision.
- Step 10 frontend/schema/location/membership work had not reached production. Only an isolated Koversada Auth user had been created and there was no path from that user creation to Petalon operational state.
- No production deployment occurred between the last working save and the broken round.
- The affected R1 write path required local durable pending persistence before the Supabase write and did not universally time-bound that durability gate.
- Client-stage telemetry did not exist, so the exact failing client stage was not captured.

## What is not proven

Do not describe a specific IndexedDB exception as proven. A closed/hung IndexedDB path is a leading hypothesis, but `InvalidStateError`, an IndexedDB hang, every controller update/retry, and the exact lifecycle trigger were not directly observed.

# Second Incident — 2026-08-28

## Operational impact

The Second Incident occurred during real Petalon Production operation after Production Reliability R2 had been merged and deployed.

Vito was operating the sunbed/set round from an Android phone on 5G while Vuk was simultaneously operating Aquapark from an iPhone on 5G.

Vito attempted to record Set 13 after the customer had paid in real life. Beach Set Manager created and durably preserved the local Set 13 payment, but the server rejected the whole-location state write because Vuk had concurrently completed an unrelated Aquapark update from the same base revision.

Vito's application then entered the full-screen `Newer shared data exists` conflict state. The normal Petalon operational interface was unavailable to him. `Check shared data again` reloaded authoritative state but returned to the same unresolved conflict. The recovery-file action preserved the state but, on the affected Android flow, opened a raw JSON/content viewer rather than giving the worker a practical recovery/resume workflow.

Vuk's iPhone remained operational. This was not a global Petalon outage.

## Normal operating workflow

This concurrency is normal required production behavior.

Approximately:

- 08:00–12:00 — Vito works alone;
- 12:00–16:00 — Vuk and Vito work concurrently;
- 16:00–20:00 — Vuk works alone.

One worker performs the physical sunbed/set round. On the day of the Second Incident, Vito was performing the sunbed/set round.

While that round is happening, the other worker may operate Aquapark. When the sunbed worker is not on a round, both workers may also interact with Aquapark.

Vuk and Vito were not intentionally editing Set 13 or another numbered Set simultaneously.

The application must therefore support an Aquapark operation and a different Set operation at the same Petalon location without treating them as a business conflict merely because they started from the same whole-location revision.

## Preserved-device evidence

Vito's recovery export is a `preserved-unsaved-app-data` snapshot for Petalon based on server revision 448.

It proves the application created:

- Set 13 — paid;
- amount — €12;
- price mode — fixed;
- transaction/daily-sale ID — `3e1ea3a5-8c83-46d0-b7ff-acbd49c867f5`;
- local timestamp — `2026-08-28T11:37:10.663Z`.

The same transaction ID exists in the preserved financial transaction data.

Therefore the explanation "perhaps the Set 13 mutation was never created" is contradicted by machine evidence.

The preserved snapshot also contains the earlier Set 18 and Set 16 payments.

## Authoritative server evidence

Immutable `private.location_state_history` proves:

- Set 18 was accepted by Vito at revision 437;
- Set 16 was accepted by Vito at revision 438;
- revisions 440 through 448 were accepted writes by Vuk;
- Set 13 remained free through every accepted revision in that sequence;
- Set 13 transaction ID `3e1ea3a5-8c83-46d0-b7ff-acbd49c867f5` appears in no accepted Petalon history revision.

Set 13 was therefore preserved locally but never accepted into authoritative server state.

## R2 telemetry evidence

R2 client telemetry provides the exact failing save sequence.

Both devices operated from authoritative revision 443.

Vuk:

- local mutation became visible at approximately `11:37:11.737Z`;
- repository save started with expected revision 443 at approximately `11:37:11.764Z`;
- repository save returned `accepted` at approximately `11:37:11.952Z`;
- that write became authoritative revision 444.

Vito:

- Set 13 local mutation became visible at approximately `11:37:11.874Z`;
- controller admitted the mutation;
- local durability was confirmed;
- repository save started with expected revision 443 at approximately `11:37:11.905Z`;
- repository save returned `conflict` at approximately `11:37:12.850Z`.

This rules out an Incident-1-style pre-network silent durability failure for Set 13.

## Exact conflicting authoritative change

The authoritative state diff from revision 443 to revision 444 contains:

- no numbered Set change;
- no Extra Bed change;
- no financial transaction change;
- one Aquapark entry change.

The Aquapark change updated one entry's `returnedWristbands` from `[]` to `[8]`.

Therefore the Second Incident root cause is proven:

**a normal Vuk Aquapark operation and Vito Set 13 payment collided solely because the current architecture serializes unrelated Petalon business actions through one whole-location `location_state.revision` compare-and-swap boundary.**

The operations were not business-conflicting intents. They were unrelated resource changes.

## What R2 protected successfully

R2 materially improved the outcome compared with the First Incident.

It:

1. admitted the Set 13 mutation explicitly;
2. durably preserved it on Vito's device;
3. reached the repository/server save stage;
4. detected the stale expected revision;
5. did not overwrite Vuk's newer authoritative state;
6. retained the Set 13 payment and exact transaction ID for recovery;
7. prevented Vito from continuing to create many additional unsafe application mutations;
8. produced telemetry sufficient to reconstruct the failure accurately.

R2 therefore succeeded as conservative fail-closed containment.

## What R2 failed to provide

R2 did not provide acceptable operational conflict recovery.

One unresolved €12 Set payment replaced the whole Petalon application with a conflict screen.

The current `Check shared data again` action reloads authoritative state. It does not reconcile the preserved local operation. If the preserved local state continues to differ from the server, the user can return to the same conflict screen indefinitely.

The worker therefore had no safe practical route to reconcile, deliberately discard/reapply, or return to unrelated work.

This turned safe conflict detection into an operational availability failure.

## Relationship to the First Incident

The First and Second Incidents are distinct failure mechanisms.

First Incident:

- Vuk / iPhone Home Screen PWA;
- roughly twenty apparently accepted operational changes;
- no corresponding Petalon repository/server writes during the missing interval;
- exact pre-network client failure stage not proven;
- R2 did not yet exist.

Second Incident:

- Vito / Android;
- R2 active;
- one Set 13 mutation explicitly admitted and durably preserved;
- repository save definitely attempted;
- server returned a proven CAS conflict;
- conflict caused by a concurrent unrelated Aquapark write;
- R2 prevented overwrite and further unsafe mutation accumulation;
- worker then became operationally locked out.

Do not describe the incidents as having the same proven root cause.

# R2.1 PR #31 — first corrective attempt after the Second Incident

PR #31 was merged and deployed as a narrow pre-R3 bridge.

Its design was deliberately conservative:

- direct explicit CAS conflicts only;
- exact pending/base/attempt/durable-desired alignment;
- strict allowlist of known AppData business bundles;
- no generic JSON merge;
- rebase from current authoritative server state;
- same-resource/unsupported changes fail closed;
- one automatic rebase only;
- rebased pending data must be durable before retry.

However, it also required:

`current.revision === expectedRevision + 1`

The reason was legitimate: across several accepted revisions, a final BASE→CURRENT diff alone cannot prove that an intermediate operation did not add then remove a transaction, reset then restore state, touch a resource to a third value and later change it again, or otherwise leave no evidence in the final snapshot.

PR #31 therefore avoided unsafe multi-revision inference by refusing every revision gap larger than one.

The mistake was not conservatism itself. The mistake was treating **one winning remote revision** as sufficient coverage of normal production concurrency.

Its deterministic regression reproduced the exact Second Incident `443 -> 444` shape, but it did not test the case where another device advances two or more legitimate revisions before the slower request returns.

# Third Incident — 2026-08-29

## Operational impact

Vuk intentionally attempted to reproduce the Second Incident after PR #31 had been merged/deployed.

Both devices were running Production build:

`21c6e25d5caf83bf46e53aa260aedab2596e0168`

Vuk closed an Aquapark entry while Vito marked a numbered Set left/closed at approximately the same time.

The same full-screen `Newer shared data exists` conflict appeared on Vuk's iPhone. As in the Second Incident, the normal application was unavailable and `Check shared data again` did not provide an exit.

Vuk exported the preserved local recovery file instead of clearing the phone. That already-conflicted device is intentionally being kept for upgrade-in-place verification of the new recovery path.

## Exact preserved local operation

The preserved file was exported at:

`2026-08-29T12:31:01.012Z`

and recorded server revision:

`523`

The local Aquapark operation changed entry:

`52b01ca1-d713-4029-9e9e-0ae0c7cb2829`

wristbands `15, 48`

from active to closed with local `closedAt`:

`2026-08-29T12:30:42.757Z`

That close never appeared in authoritative revisions 521–523.

## Exact remote Set sequence

Immutable Production history proves:

Revision 521 — Set 53:

- status `free`;
- no `updatedAt`.

Revision 522 — Set 53:

- status still `free`;
- `updatedAt = 2026-08-29T12:30:34.605Z`.

Revision 523 — Set 53:

- status `left`;
- `updatedAt = 2026-08-29T12:30:40.404Z`.

Both revisions 522 and 523 were accepted under Vito's account.

Telemetry proves Vuk's later repository save was still based on expected revision 521 and returned explicit conflict after the server had advanced to 523.

## Root cause of the extra revision

Code tracing proved revision 522 was not Realtime, bridge coalescing or a database anomaly.

The Set status source workflow allowed `Mark Free` on a Set that was already free. `updateSetStatus()` still stamped a new `updatedAt`, so a semantically unchanged UI action created a real whole-location shared revision.

Vito then performed the real `FREE -> LEFT` action, creating revision 523.

This means normal human/UI interaction can advance more than one revision while another phone's request is in flight.

## Why PR #31 did not work

Vuk's request had:

- expected revision `521`;
- current authoritative revision `523`.

PR #31's known-conflict path required:

`current.revision === expectedRevision + 1`

Therefore the controller rejected R2.1 eligibility **before** calling the semantic disjoint-resource reconciler.

The final business changes were still disjoint:

- remote: Set 53 `FREE -> LEFT`;
- local: unrelated Aquapark entry `ACTIVE -> CLOSED`.

But PR #31 had no mechanism to prove whether revisions 522 and 523 contained only safe monotonic progression, so it conservatively exposed the full conflict.

**Field judgment:** the first R2.1 patch was operationally useless for the real Incident 3 path because its core eligibility assumption excluded the actual race produced by the application. It did not fix normal concurrent operation in the way we expected.

This does **not** mean PR #31 had zero value. It still:

- preserved Vuk's operation durably;
- prevented stale overwrite;
- gave exact telemetry;
- correctly handled the narrower class where exactly one supported disjoint remote revision wins;
- established the strict semantic allowlist and durability-before-retry machinery reused by the correction.

The failure was that we treated that narrower class as sufficient evidence for the field problem.

## Why the first R2.1 tests were insufficient

The original deterministic test modeled the Second Incident as one remote winner followed by one loser conflict.

It did not require:

- a two-controller matrix across every supported operation family;
- both winner/loser directions for all operation-family pairings;
- two or three accepted remote revisions before the local request resolves;
- the exact `FREE -> FREE + updatedAt -> LEFT` sequence;
- a worker-usable in-app exit from a preserved old conflict.

The Third Incident therefore found a production-relevant state-space hole that the first test suite never exercised.

# PR #32 — bounded R2.1 corrective design

PR #32 is designed specifically around the proven reasons PR #31 failed.

## Correction 1 — suppress semantically meaningless Set/Bed source writes

Same-status non-financial Set/Bed actions now stop before shared-state mutation when the only effect would be a new `updatedAt`.

Paid actions remain unsuppressed because a payment is a new financial bundle even when the resource was previously paid.

This removes the exact source path that created Incident 3 revision 522.

It reduces unnecessary contention, but it is not sufficient by itself because legitimate remote devices can still perform two or more real operations while another request is in flight.

## Correction 2 — prove multi-revision safety from immutable history

PR #32 does not simply remove the `+1` rule.

For a direct explicit CAS conflict:

- `current.revision > expectedRevision` is required;
- exactly `+1` remains directly eligible under the existing strict checks;
- a larger gap requires a positive server proof;
- the gap is bounded to at most 10 revisions;
- the history must be complete/contiguous and end at the current authoritative revision;
- every snapshot must pass strict AppData validation;
- every projected resource at every intermediate revision must equal either its base value or its final value.

The proof rejects hidden intermediate third values, add/remove, reset/restore and transaction disappearance that final-state comparison alone cannot detect.

Only a boolean crosses the public RPC boundary. Historical AppData remains private.

A positive proof is still not enough to rebase: the existing strict final semantic classifier must also prove the BASE→LOCAL and BASE→CURRENT business bundles are supported and compatible.

## Correction 3 — one durable semantic rebase, not generic merge

When both proof layers pass, the controller:

1. uses the current authoritative state as the merge base;
2. applies only the classified local semantic patches;
3. rewrites the pending record to the new authoritative base;
4. sets `automaticRebaseCount = 1`;
5. clears old attempt metadata;
6. durably persists that rebased pending record;
7. only then retries the repository save against the new revision.

A second conflict does not create an unbounded automatic loop.

Same-resource, unsupported, malformed, ambiguous or unprovable cases remain preserved conflicts.

## Correction 4 — real escape from an old preserved conflict

PR #32 adds:

`Discard local change and use current shared data`

This is intentionally destructive only to the exact device-side pending record for the current user+location.

The user must confirm that the unsent local change will be permanently discarded and that the server will not be changed.

The controller loads and validates latest authoritative state **before** deleting local evidence. It then requires successful deletion from both local durable mirrors, with queued stale IndexedDB writes invalidated only for the same user+location key. Only after successful removal does it clear in-memory pending state and adopt the freshly loaded server state.

If load/validation/removal fails, it remains blocked and preserved.

The recovery action performs zero repository save calls.

Tests explicitly create an old R2.1-format pending record and initialize the new controller from it, so the feature is intended to work after an in-place application upgrade without clearing site data, reinstalling or signing out.

## Why PR #32 should fix Incident 3 in theory

For the exact proven Incident 3 history:

- base = revision 521;
- remote intermediate = revision 522 (`FREE -> FREE + updatedAt`);
- remote final = revision 523 (`FREE -> LEFT`);
- local desired = unrelated Aquapark close.

The new source guard should prevent the redundant updatedAt-only revision in future equivalent UI use.

Even if several legitimate remote revisions still occur, the new Production proof can examine the complete immutable chain rather than guessing from the final snapshot.

The real stored 521→522→523 chain has already been independently verified as:

- contiguous;
- strict-AppData well formed;
- monotonic under the new resource projection.

After that proof, the existing final semantic classifier sees the Set 53 change and Aquapark close as disjoint supported resources. The controller can then durably rebase the local Aquapark close onto current authoritative revision 523 and retry once, producing a hypothetical next revision that preserves both intentions.

This is the specific mechanism PR #31 did not have.

## Verification before frontend merge

PR #32 has been reviewed against the actual repository, not only Codex prose.

Evidence includes:

- 268/268 tests passing;
- 64/64 ordered safe two-controller pairings across numbered Set status/payment, Bed status/payment, non-numbered Sunbed add, Aquapark add, return and close;
- multi-revision races with two/three remote revisions;
- exact Incident 3 regression;
- 17 negative incompatible/malformed cases failing closed;
- ambiguity, restart, durability-before-retry and second-conflict tests;
- upgrade-in-place old-pending recovery tests;
- 33/33 real local SQL integration checks;
- TypeScript/SQL semantic parity review that caught and fixed an initially too-permissive SQL validator;
- Production migration applied and independently verified before frontend merge;
- real Production Incident 3 history proving true under the new server proof;
- private history/helpers still inaccessible to browser roles.

## Why this is still theory, not a closed incident

The new frontend has not yet been merged/deployed at this documentation checkpoint.

Vuk's real conflicted iPhone still contains the old Incident 3 pending record and has deliberately not had its site data cleared.

Incident 3 is not resolved until:

1. PR #32 is merged and its exact `main` deployment is live;
2. the same iPhone loads the new frontend without clearing site data;
3. the new recovery action appears on the old conflict screen;
4. Vuk confirms discard;
5. the app loads latest Petalon first, removes only the old local pending record, retains Auth and returns to normal ready/safe operation;
6. controlled real two-phone concurrent operations across representative Set/Bed/Sunbed/Aquapark combinations pass;
7. telemetry and immutable history confirm the expected accepted/rebased outcomes.

Until then, describe PR #32 as **reviewed and theoretically correct for the proven Incident 3 class**, not as guaranteed or field-proven.

## Remaining limits even if PR #32 passes

PR #32 still uses whole-AppData snapshot CAS and is intentionally bounded.

It does not solve:

- gaps greater than 10 revisions;
- missing/non-contiguous history;
- hidden intermediate third-state chains;
- unsupported compound operations;
- every reservation/delete/reset/import interaction;
- ambiguous response idempotency;
- operation-level deduplication;
- general high-concurrency commercial scaling.

Those remain R3 responsibilities.

# Never-Again Rules

1. **No silent visible mutation.** A visible operational change must receive explicit admission into the shared write pipeline. Missing/mismatched/paused controller states must not silently return.
2. **No unbounded local durability gate.** Pending-store and browser-storage operations must resolve success/failure within a bounded time.
3. **Unsafe durability fails closed.** Keep the first visible unsafe change available for recovery, but block further operational mutations. One failure must not become twenty volatile entries.
4. **Network failure is different from device-safety failure.** If local durability is confirmed, reviewed retry/offline behavior may continue. If local durability is unsafe, stop normal work.
5. **`Saved` means server-confirmed.** Device-only pending state must never be labelled as server-confirmed.
6. **Incoming Realtime is normal multi-user operation.** An authoritative update from another worker must not cause a false STOP or false admission watchdog and must not swallow an interleaved real local mutation.
7. **Concurrent users are the baseline.** Reliability testing must include multiple authenticated phones using the same location simultaneously.
8. **Installed-PWA lifecycle is the baseline.** Repeated close/reopen, background/foreground, lock/unlock and app switching must be tested on the affected iPhone class of device.
9. **Do not rely on worker attention to diagnostics.** If continuing is unsafe, the operational controls themselves must become unmistakably unavailable.
10. **Accepted server facts need immutable history.** Later changes must not make an accepted write impossible to reconstruct.
11. **Pipeline observability is required.** Privacy-safe telemetry should identify visible mutation, bridge forwarding, controller admission, durability, repository save start/result and blocking/retry stages without customer/payment payloads. Telemetry failure must never block saving.
12. **No single browser subsystem is trusted as infallible.** Recovery should use independent paths where practical.
13. **Ambiguity preserves evidence.** Never force an old snapshot over newer server state merely to make a conflict disappear.
14. **Release testing must reproduce the real round.** Unit tests alone are insufficient for reliability changes.
15. **The whole-AppData JSONB model is not the final commercial write model.** Real multi-user concurrency and the First/Second/Third Incidents are evidence to move toward immutable business operations.
16. **Owner revenue comparison is a detection layer.** Real revenue is a boss-entered external reference. Workers must not be burdened with reconciliation workflow, and the comparison must not be mistaken for write durability or recovery.
17. **Disjoint resource actions must not become false business conflicts.** A Set payment/status and an unrelated Aquapark/Bed/Sunbed action must not conflict solely because they share one whole-location revision.
18. **Conflict detection is not conflict resolution.** Preserving a mutation and showing a conflict is necessary but insufficient; the system needs a safe reconciliation or deliberate-resolution path.
19. **One preserved conflict must not indefinitely remove unrelated operational capability.** Fail closed against unsafe writes, but design recovery so the worker can safely resolve or deliberately retire the affected operation and return to work.
20. **Concurrency tests must use different domains, not only the same resource.** Release tests must include simultaneous Set/Bed/Sunbed/Aquapark operations from separate devices and both winner/loser directions.
21. **Recovery UX must be worker-usable.** Machine-readable evidence files are valuable, but a normal worker must not be expected to understand raw JSON in order to recover from an operational incident.
22. **One remote revision is not a sufficient concurrency model.** Test the loser while another device advances two or more accepted revisions before the conflict returns.
23. **Final-state disjointness is not enough across multiple revisions.** A safe multi-revision snapshot bridge must rule out hidden intermediate third states, add/remove, reset/restore and disappearing financial effects, or fail closed.
24. **Eliminate semantic no-op writes at the source.** A status action that changes only `updatedAt` must not consume a shared revision unless that timestamp change is itself a required business fact.
25. **Recovery changes must upgrade old conflicts in place.** Do not require clearing all browser/site data, reinstalling or signing out merely to escape a preserved pending record after a fixed version deploys.
26. **Scoped recovery must remain scoped.** Discard/removal/invalidation for one user+location must never cancel or resurrect pending work for another user or location.
27. **Do not call a reliability patch field-validated from tests alone.** The affected real device class and representative concurrent workflow must pass after deployment, with telemetry/history inspected.

# Immediate Reliability Direction — bounded bridge then R3

R2 remains the fail-closed containment layer.

PR #31 demonstrated that strict semantic rebase is possible but also demonstrated why a narrow +1 assumption cannot be treated as a complete concurrency solution.

PR #32 is the accepted bounded bridge design: source no-op suppression, private immutable-history proof for short multi-revision chains, strict operation allowlist, one durable rebase, and explicit scoped conflict discard.

Do not expand this bridge into a generic JSON merge system. If a case cannot be proven within its closed model, fail closed and move the business action into R3.

R3 should move operational writes toward an immutable client outbox, idempotent server operation/command boundary and progressively narrower concurrency scopes.

Each real business action should receive one stable `operation_id` and be retried with the same ID after reopen/ambiguous responses. Accepted operations should form an append-only audit trail. Revenue-affecting actions should create immutable/voidable financial ledger records linked to the operation ID. Corrections should use explicit reversal/void semantics rather than silent hard deletion.

Database backup/PITR should be evaluated before commercial rollout for accepted server data, but it cannot recover an operation that never reached durable client/server storage.

# Layer 5 — Owner Real Revenue vs App Revenue

Layer 5 is a **boss-only** audit/reporting function. It is not a Worker task and it is not tied to a Marketino or fiscal integration.

For a location/date, Mark (`LOCATION_ADMIN`) or Vuk (`PLATFORM_OWNER`) may manually enter the location's **Real Revenue** value. **App Revenue** is calculated automatically from authoritative application data and is read-only. Workers do not enter, edit, or need to see this comparison.

The owner view should show, for each authorized location:

- App Revenue;
- Real Revenue if entered;
- absolute EUR difference;
- percentage difference.

For non-zero Real Revenue, percentage difference is `abs(App Revenue - Real Revenue) / Real Revenue * 100`. A percentage greater than **10%** is visually red. Exactly 10% is not red. If both values are zero, the difference is 0%. If Real Revenue is zero while App Revenue is non-zero, show a clear red mismatch state instead of inventing a misleading finite percentage.

No explanation/reason field is required. The boss can follow up with workers outside the app if a discrepancy looks suspicious.

The owner dashboard should show Petalon and Koversada separately, with App Revenue above Real Revenue and the percentage difference immediately visible. It may also show combined Petalon + Koversada App Revenue and combined Real Revenue. If a location has no Real Revenue entry, display **Not entered** rather than zero; combined Real Revenue must not pretend to be complete when one location is missing a value.

Revenue-comparison records should live in a separate RLS-protected server table, not inside `location_state`. Only active authorized owner/admin roles for that location may read/write them. Preserve audit metadata/history for edits so a later correction does not erase who entered an earlier value.

Layer 5 detects business-level divergence. It does **not** recover a client operation that was never durably recorded. Recovery remains the responsibility of R2/R2.1/R3 plus server history/backups.

# Multi-location concurrency requirement

Koversada must be designed as a shared location, not a one-user app. Initially a Koversada worker operates it while Vuk and Mark may monitor it concurrently. Next season two independent Koversada worker Auth users may operate simultaneously while Vuk and Mark monitor. Do not make one shared worker login the long-term identity model; separate users preserve actor attribution, revocation, pending-state isolation and diagnostics.

# Post-incident release order

1. Preserve all First/Second/Third Incident evidence and keep proven facts separate from hypotheses.
2. Keep R2 as fail-closed containment while the bounded PR #32 correction is deployed/field-tested.
3. Merge/deploy PR #32 only after code, SQL, security and Second Brain review are complete.
4. Recover the same already-conflicted iPhone in place using the new scoped discard/use-current path; do not clear site data before the test.
5. Verify representative real concurrent Petalon use across different domains from separate devices and inspect telemetry/history.
6. If that passes, mark Incident 3 resolved by the bounded bridge and begin R3A immediately.
7. Re-review/resume Step 10 frontend rollout only after the reliability gate passes.
8. Keep Layer 5 owner revenue comparison as a detection/audit control, not a durability or recovery mechanism.
9. Treat R3 immutable operations/idempotency as required before commercial maturity and high-concurrency next-season use.

Future severe incidents should be named `Fourth Incident`, `Fifth Incident`, etc. Each record must separate proven facts from hypotheses and update these permanent rules.
