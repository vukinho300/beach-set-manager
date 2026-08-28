# Production Incidents and Never-Again Rules

Status: `canonical`
Last reviewed: 2026-08-28

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

The worker therefore had no safe practical route to:

- reconcile the Set 13 operation;
- discard only that operation deliberately;
- reapply it against the new authoritative state where safe;
- or return to unrelated Petalon work.

This turned safe conflict detection into an operational availability failure.

The recovery JSON also proved technically useful but produced poor worker UX on the affected Android flow because the file opened as raw JSON/content.

## Business impact

Set 13 was a real payment whose application mutation was created and preserved but not accepted by the server.

Set 7 was physically paid before the Set 13 application attempt, but current evidence does not prove that a Set 7 application mutation was attempted.

After Vito was locked out, Set 9 and Set 11 were physically paid but could not be entered into Beach Set Manager because the normal application was unavailable.

Do not describe Sets 7, 9 or 11 as server writes that disappeared.

The final physical timing/status of the initially mentioned Set 10 / three-sunbed item remains unresolved and should not be invented.

## Relationship to the First Incident

The First Incident and Second Incident are distinct failure mechanisms.

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

They do, however, expose different weaknesses of the same whole-location snapshot architecture.

## Step 10 relationship

The Step 10 / Koversada frontend in Draft PR #28 was not deployed to Production during the Second Incident.

The Production client telemetry identifies the running application build as main commit `8f7f332e51e402dbdcba4bc63d029f5ff6c4c042`.

The additive Step 10 database foundation had already been provisioned remotely, but Petalon remained on the existing R2 `location_state` CAS write architecture. The Second Incident's exact conflict is independently explained by two normal R2 Petalon writes racing on revision 443.

Do not attribute the Second Incident to the Draft PR #28 frontend.

## Architecture consequence

The Second Incident satisfies the existing roadmap trigger for promoting Reliability R3 from planned hardening to immediate reliability work.

The current whole-location CAS boundary is no longer merely a theoretical concurrency limitation. Production evidence proves that unrelated normal business actions can conflict solely because they share one location revision.

The next reliability architecture must prevent independent-resource operations from manufacturing whole-location business conflicts while retaining conservative protection for genuinely conflicting same-resource intents.

A narrow pre-R3 conflict-recovery patch may be considered if needed for operational continuity, but it must not normalize unsafe blind whole-state rebasing or overwrite newer authoritative work.

Step 10 frontend rollout should remain paused until the Second Incident corrective write/conflict strategy is reviewed and accepted.

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
15. **The whole-AppData JSONB model is not the final commercial write model.** Real multi-user concurrency and the First Incident are evidence to move toward immutable business operations.
16. **Owner revenue comparison is a detection layer.** Real revenue is a boss-entered external reference. Workers must not be burdened with reconciliation workflow, and the comparison must not be mistaken for write durability or recovery.
17. **Disjoint resource actions must not become false business conflicts.** A Set payment and an unrelated Aquapark action must not conflict solely because they share one whole-location revision.
18. **Conflict detection is not conflict resolution.** Preserving a mutation and showing a conflict is necessary but insufficient; the system needs a safe reconciliation or deliberate-resolution path.
19. **One preserved conflict must not indefinitely remove unrelated operational capability.** Fail closed against unsafe writes, but design recovery so the worker can safely resolve the affected operation and return to work.
20. **Concurrency tests must use different domains, not only the same resource.** Release tests must include simultaneous Set/Bed/Sunbed and Aquapark operations from separate devices.
21. **Recovery UX must be worker-usable.** Machine-readable evidence files are valuable, but a normal worker must not be expected to understand raw JSON in order to recover from an operational incident.

# Immediate Preventative Database Step — Reliability R3

R2 remains the fail-closed containment layer for the current architecture. After the Second Incident's forensic diagnosis, R3 is promoted from future commercial hardening to the immediate reliability track.

Production evidence now proves that one whole-location CAS revision creates false contention between unrelated business resources during the normal two-worker Petalon workflow.

R3 should therefore move operational writes toward an immutable client outbox, idempotent server operation/command boundary and progressively narrower concurrency scopes.

Each real business action should receive one stable `operation_id` and be retried with the same ID after reopen/ambiguous responses. The client should durably preserve a small immutable operation record. The server should accept commands through narrow authenticated functions that derive `auth.uid()`, verify active location membership, validate the business action, enforce unique `operation_id`, and return the already-accepted result when the same operation is retried.

Accepted operations should form an append-only audit trail. Revenue-affecting actions should also create immutable/voidable financial ledger records linked to the operation ID. Corrections should use explicit reversal/void semantics rather than silent hard deletion.

The write model should progressively move from one whole-location revision toward per-entity concurrency. Two workers changing different resources should not conflict solely because they started from the same location revision; same-resource conflicting intents must still be detected.

Server-side reconciliation should be possible between accepted operations, financial ledger totals, current entity state and daily reports. Database backup/PITR should be evaluated before commercial rollout for accepted server data, but it cannot recover an operation that never reached durable client/server storage.

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

Layer 5 detects business-level divergence. It does **not** recover a client operation that was never durably recorded. Recovery remains the responsibility of R2/R3 plus server history/backups.

# Multi-location concurrency requirement

Koversada must be designed as a shared location, not a one-user app. Initially a Koversada worker operates it while Vuk and Mark may monitor it concurrently. Next season two independent Koversada worker Auth users may operate simultaneously while Vuk and Mark monitor. Do not make one shared worker login the long-term identity model; separate users preserve actor attribution, revocation, pending-state isolation and diagnostics.

# Post-incident release order

1. Keep R2 as the Production containment layer while the Second Incident correction is developed.
2. Record and preserve the Second Incident forensic evidence and Never-Again Rules.
3. Promote R3 / disjoint-resource conflict correctness to immediate reliability work.
4. Add a practical safe conflict-resolution/resume path without blind whole-state overwrite.
5. Verify real concurrent Petalon use with different domains from separate devices.
6. Re-review and resume Step 10 frontend rollout only after the Second Incident reliability gate passes.
7. Keep Layer 5 owner revenue comparison as a detection/audit control, not a durability or recovery mechanism.
8. Treat R3 immutable operations/idempotency as required before commercial maturity and high-concurrency next-season use.

Future severe incidents should be named `Third Incident`, `Fourth Incident`, etc. Each record must separate proven facts from hypotheses and update these permanent rules.
