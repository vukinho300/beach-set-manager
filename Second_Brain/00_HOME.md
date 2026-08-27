# Beach Management Platform — Second Brain

Status: `canonical`
Last reviewed: 2026-08-27
Repository implementation checkpoint reviewed: `cfc465fe34f177accb7d605153fd8a1f80effbce` (R2 / PR #25 corrected head; pending affected-iPhone release verification)

This vault is the human-readable control center for `beach-set-manager` as it evolves from a local-only Petalon PWA into a secure shared operational application.

## Project rule

> ==The repository, running code, tests, migrations and database are the technical source of truth. The Second Brain is the architecture memory, decision log and operating manual.==

## Current phase

**Shared Petalon v1, Production Reliability R1 and Step 9 are merged. Step 10 / Koversada is paused because the 2026-08-27 First Incident proved the write path required another reliability gate. Production Reliability R2 is in Draft PR #25 and is not yet approved for Production.**

Canonical Petalon roles:

- `PLATFORM_OWNER` — Vuk; product label **Platform Admin**.
- `LOCATION_ADMIN` — Mark; product label **Location Owner**.
- `WORKER` — Vito; product label **Worker**.

Production Reliability R1 remains baseline architecture: background authoritative convergence must not remount/reset working UI; tab/scroll continuity is device UI state; unconfirmed work receives user/location-scoped recovery protection; conflicts remain conservative.

The **First Incident** is now a permanent architecture reference. During a real iPhone Home Screen PWA round, roughly twenty visible operational entries never reached Supabase. The server revision chain proves the work was not accepted and later overwritten. The exact client exception is unproven. See [[18_Production_Incidents_and_Never_Again_Rules]].

R2 adds fail-closed write safety, bounded device-durability operations, explicit controller admission, privacy-safe sync telemetry and hard-stop recovery behavior. The corrected PR #25 also distinguishes incoming authoritative Realtime convergence from genuine unadmitted local divergence. R2 still requires real affected-iPhone Preview testing before merge/deploy.

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
18. [[18_Production_Incidents_and_Never_Again_Rules]]

## Current product areas

- Beaches: 56 numbered sets across Beach 1 and Beach 2.
- Beds: 4 extra beds.
- Beach reservations: date-based, paid amount, notes, multi-assignment to sets/beds.
- Non-numbered Sunbeds: quantity + amount + description sales.
- Aquapark: wristbands, ticket types, prices, timing, extra time, returned wristbands, expiry highlighting.
- Transactions: current-day ledger with deletion audit state.
- Reports: current-day totals and Report Archive behavior.
- Settings: role-aware records, resets, backups/shared tools and account state.

## Immediate objective

1. Finish R2 / PR #25 review and affected-iPhone Preview verification.
2. Deploy R2 only after realistic Home Screen PWA close/reopen, concurrent-worker, walking-style and forced-failure tests pass.
3. Design **Reliability R3: immutable client operations/outbox + idempotent server operation ledger/commands** as the next preventative database architecture.
4. Resume Step 10 / Koversada only without weakening First Incident Never-Again Rules.

Koversada is a real shared second location: its worker(s) operate it while Vuk and Mark may monitor concurrently; future architecture must support multiple independent Koversada worker accounts/devices rather than one shared worker identity.

The frontend is not a security boundary. A copied browser bundle must not grant location data without a valid authenticated user and active membership.

See [[11_Project_Status_and_Next_Actions]] and [[18_Production_Incidents_and_Never_Again_Rules]].
