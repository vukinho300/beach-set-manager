# Production Incidents and Never-Again Rules

Status: `canonical`
Last reviewed: 2026-08-27

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

# Preventative Database Step — Reliability R3

R2 is fail-closed containment for the current architecture. The next major preventative database step should be an **immutable client outbox + idempotent server operation ledger/command boundary**.

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

1. Keep R2 as the production containment layer and validate it under real concurrent Petalon use.
2. Step 10 may proceed only without weakening any Never-Again Rule or replacing the R2 write path.
3. Add the boss-only Real Revenue vs App Revenue comparison on a separate trusted server boundary.
4. R3 design/development may begin before field validation, but do not replace Production operational writes with R3 until R2 has been observed under realistic concurrent use and the R3 migration has its own staged verification.
5. Treat R3 immutable operations/idempotency as required before commercial maturity and before high-concurrency next-season use, even if it is deferred during the current internal pilot.

Future severe incidents should be named `Second Incident`, `Third Incident`, etc. Each record must separate proven facts from hypotheses and update these permanent rules.
