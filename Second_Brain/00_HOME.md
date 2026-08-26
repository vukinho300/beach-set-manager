# Beach Management Platform — Second Brain

Status: `canonical`
Last reviewed: 2026-08-26
Repository implementation checkpoint reviewed: `1ef3b037cfde097180f467fde432a15ed8d495ce` (Step 9 / PR #19 head; independently reviewed, pending merge)

This vault is the human-readable control center for `beach-set-manager` as it evolves from a local-only Petalon PWA into a secure shared operational application.

## Project rule

> ==The repository, running code, tests, migrations and database are the technical source of truth. The Second Brain is the architecture memory, decision log and operating manual.==

## Current phase

**Shared Petalon v1 and Production Reliability R1 are merged. Step 9's three-role product foundation is independently reviewed in PR #19 and pending merge.**

The canonical Petalon role model is now explicit:

- `PLATFORM_OWNER` — Vuk; product label **Platform Admin**; private platform/developer authority plus normal Petalon use.
- `LOCATION_ADMIN` — Mark; product label **Location Owner**; owner/manager of the Petalon location plus normal operations.
- `WORKER` — Vito; product label **Worker**; full daily operational workflow without destructive location-management UI.

Step 9 corrects prior implementation drift where Mark had been provisioned as `WORKER`. The live Petalon membership was verified active and changed only from `WORKER` to `LOCATION_ADMIN`; Vuk and Vito were left unchanged. The authenticated verification script now reads canonical role expectations from `supabase/verification/role_expectations.json` so future verification does not revert Mark.

Role state comes from the current authenticated user's own RLS-readable `location_memberships` row for Petalon. It is identity-scoped so account switches cannot briefly expose another user's role/capabilities. No email, user metadata or frontend UUID map is used for role inference.

Current product capability split:

- all three roles retain normal Beaches, Beds, reservations, Sunbeds, Aquapark, transactions/reports, Daily Reset, realtime and R1 durability/recovery behavior;
- Vuk and Mark can see location-management/destructive shared tools such as Import Backup and Full Reset Shared App Data;
- Vito does not receive those destructive controls in the normal UI;
- this is currently a product/UI capability boundary, not complete action-level database authorization, because all active members still need broad revision-safe updates to the monolithic `location_state` JSONB row for ordinary work.

Step 9 also fixes the paid-set editor workflow: historical `set.price`/`priceMode` remain saved for transaction/revenue/reporting purposes, but each newly opened set-payment editor starts with a fresh zero/blank draft. A previous EUR 12 payment no longer pre-fills the next payment intent.

Production Reliability R1 remains required architecture: background realtime convergence must not remount or reset the worker's position, UI-only tab/scroll continuity is persisted separately, and unconfirmed operational work is durably protected in user/location-scoped IndexedDB with conservative retry/conflict recovery.

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
- Settings: role-aware records, resets, backups/shared tools and account state.

## Immediate objective

Merge Step 9, then design the **Mark Location Owner Dashboard** on top of the reusable `LOCATION_ADMIN` role/capability foundation.

The dashboard must distinguish owner-facing UX from genuinely confidential owner data. Anything already readable through the shared `location_state` row is not made confidential merely by hiding it from Worker UI; truly owner-only financial/management data will require its own RLS-protected server boundary.

The frontend is not treated as a security boundary. A copied browser bundle must not grant access to Petalon data without a valid authenticated user and active membership.

Commercial white-labeling, multi-location provisioning, advanced licensing and device controls remain later work.

See [[11_Project_Status_and_Next_Actions]].
