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

# Preventative Database Step — Reliability R3

R2 is fail-closed containment for the current architecture. The next major preventative database step should be an **immutable client outbox + idempotent server operation ledger/command boundary**.

Each real business action should receive one stable `operation_id` and be retried with the same ID after reopen/ambiguous responses. The client should durably preserve a small immutable operation record. The server should accept commands through narrow authenticated functions that derive `auth.uid()`, verify active location membership, validate the business action, enforce unique `operation_id`, and return the already-accepted result when the same operation is retried.

Accepted operations should form an append-only audit trail. Revenue-affecting actions should also create immutable/voidable financial ledger records linked to the operation ID. Corrections should use explicit reversal/void semantics rather than silent hard deletion.

The write model should progressively move from one whole-location revision toward per-entity concurrency. Two workers changing different resources should not conflict solely because they started from the same location revision; same-resource conflicting intents must still be detected.

Server-side reconciliation should be possible between accepted operations, financial ledger totals, current entity state and daily reports. Database backup/PITR should be evaluated before commercial rollout for accepted server data, but it cannot recover an operation that never reached durable client/server storage.

# Multi-location concurrency requirement

Koversada must be designed as a shared location, not a one-user app. Initially a Koversada worker operates it while Vuk and Mark may monitor it concurrently. Next season two independent Koversada worker Auth users may operate simultaneously while Vuk and Mark monitor. Do not make one shared worker login the long-term identity model; separate users preserve actor attribution, revocation, pending-state isolation and diagnostics.

# Post-incident release order

1. Finish independent review of R2 / PR #25.
2. Pass affected-iPhone Preview lifecycle, concurrent-device, walking-style and controlled hard-stop/recovery tests.
3. Merge/deploy R2 only after those pass.
4. Observe realistic production use with concurrent Petalon workers.
5. Treat R3 immutable operations/idempotency as the next major database reliability architecture before commercial maturity and before high-concurrency Koversada operation.
6. Resume Step 10 only without weakening any Never-Again Rule.

Future severe incidents should be named `Second Incident`, `Third Incident`, etc. Each record must separate proven facts from hypotheses and update these permanent rules.
