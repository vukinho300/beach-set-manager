# Beach Management Platform — Second Brain

Status: `canonical`
Last reviewed: 2026-08-26
Repository implementation checkpoint reviewed: `70fc0657a68a63b5a2aa46f79ffa370d52327893` (Production Reliability R1 / PR #17 head; independently reviewed, pending merge)

This vault is the human-readable control center for `beach-set-manager` as it evolves from a local-only Petalon PWA into a secure shared operational application.

## Project rule

> ==The repository, running code, tests, migrations and database are the technical source of truth. The Second Brain is the architecture memory, decision log and operating manual.==

## Current phase

**Shared Petalon v1 is VERIFIED. Production Reliability R1 is independently reviewed and pending merge in PR #17.**

Steps 1–8 established Auth/RLS, authoritative shared Supabase AppData, revision-safe saves, realtime invalidation and real three-account verification. Real phone use then exposed two production workflow failures: disruptive background reloads that reset the worker's position, and retryable connection failures that could discard newly entered Beach/Aquapark work before Supabase accepted it.

R1 addresses those production findings without replacing Supabase as authority:

- background realtime/reconnect refresh stays inside the mounted operational UI instead of showing the blocking shared-data loader;
- authoritative snapshots apply in place without echo saves;
- active tab and per-tab scroll positions persist in UI-only localStorage;
- cold reopen restores the worker's last tab/position after authoritative startup completes;
- unconfirmed AppData is durably preserved in IndexedDB, scoped by authenticated user + Petalon location;
- retryable failures keep optimistic entries visible and retry with bounded backoff plus online/focus/visibility recovery;
- accepted saves clear the recovery record only after server acceptance/recognition;
- ambiguous or incompatible newer-server states preserve pending work as conflict rather than force-overwrite;
- only narrowly provable, unattempted compatible Beach-set edits may rebase automatically;
- prior attempted-save metadata is treated conservatively so stale recovery data cannot resurrect a later legitimate Beach state;
- account switch/sign-out cannot expose or submit another user's pending work;
- RLS revocation remains authoritative.

Review found and corrected two R1 races before approval: a blind no-echo boolean could swallow an interleaved worker mutation, and stale attempted recovery metadata could reapply an already-completed Beach state after a later server change. Both are fixed at PR #17 head `70fc0657...` with focused regressions. Reported verification after correction: 75/75 tests, build pass, `git diff --check` pass, plus real-phone continuity/network-recovery checks.

KNO remains separate and untouched.

## Main navigation

1. [[01_Main_Plan]]
2. [[02_Project_Boundaries_and_AI_Roles]]
3. [[03_Current_Architecture_and_Repository_State]]
4. [[04|Shared Architecture]]
5. [[05_Authentication_Authorization_and_Security]]
6. [[06_Licensing_White_Label_and_Seasonality]]
7. [[07_Offline_Sync_and_Conflict_Resolution]]
8. [[08_Infrastructure_Costs_and_Environments]]
9. [[09_Development_Workflow_and_Deployment]]
10. [[10_Risk_Register]]
11. [[11_Project_Status_and_Next_Actions]]
12. [[12_Decision_Log]]
13. [[13_Second_Brain_Operating_System]]
14. [[14_Implementation_Roadmap]]
15. [[15_Open_Questions_and_Clarifications]]
16. [[16_Experiments_and_Evidence]]
17. [[17_Domain_and_Production_Branding]]

## Current product areas

- Beaches: 56 numbered sets across Beach 1 and Beach 2.
- Beds: 4 extra beds.
- Beach reservations: date-based, paid amount, notes, multi-assignment to sets/beds.
- Non-numbered Sunbeds: quantity + amount + description sales.
- Aquapark: wristbands, ticket types, prices, timing, extra time, returned wristbands, expiry highlighting.
- Transactions: current-day ledger with deletion audit state.
- Reports: current-day totals and Report Archive behavior.
- Settings: transactions, reports, reset, backups/shared tools and account sign-out.

## Immediate objective

Merge and deploy the reviewed R1 reliability layer, then use the real phone deployment under normal Petalon work and watch specifically for any remaining entry loss, duplicate recovery, conflict friction or position-reset behavior before introducing role-specific owner/worker UI differences.

The frontend is not treated as a security boundary. A copied browser bundle must not grant access to Petalon data without a valid authenticated user and active membership.

Commercial white-labeling, multi-location provisioning, advanced licensing and device controls remain later work.

See [[11_Project_Status_and_Next_Actions]].
