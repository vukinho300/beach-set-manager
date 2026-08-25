# Beach Management Platform — Second Brain

Status: `canonical`
Last reviewed: 2026-08-26
Repository implementation checkpoint reviewed: `cebdaa2024e3d129d296d952ae20e61d4d0bbfe6` (PR #10 head; pending merge to main)

This vault is the human-readable control center for `beach-set-manager` as it evolves from a local-only Petalon PWA into a secure shared operational application.

## Project rule

> ==The repository, running code, tests, migrations and database are the technical source of truth. The Second Brain is the architecture memory, decision log and operating manual.==

## Current phase

The shared-platform, database/RLS, real-account authorization, repository-adapter and browser Auth/session foundations now exist. The React application is still operationally `localStorage`-backed; Step 6 is the first step that will move operational truth to Supabase.

Completed foundation:

- Step 1 / PR #3: browser Supabase dependency/environment contract, lazy client and provider-neutral versioned shared-state repository contract.
- Step 2 / PR #5: dedicated `Beach Set Manager` Supabase project `uonovdnxfjqfjkhopxwg`, migrations for `locations`, `location_memberships` and `location_state`, RLS/least-privilege grants, deterministic Petalon identity, generated database types and revision-safe conditional writes.
- Step 3 / PR #6: real Auth identities for Vuk, Vito and Mark, active Petalon memberships, controlled non-operational initial state and authenticated verification proving active-member access, stale-write rejection, trigger-owned audit fields, same-session membership revocation/restoration and worker privilege denials.
- Step 4 / PR #8: typed Supabase-backed `SharedLocationStateRepository<T>` adapter with RLS-aware load classification, mandatory `location_id + expectedRevision` saves, conflict classification and focused tests.
- Step 5 / PR #10: minimal browser email/password authentication and session UX. It restores Supabase sessions across refresh, gates the existing operational app behind authentication, supports local sign-out, has no signup path, and preserves existing localStorage operational behavior. Vuk manually verified login with all three real accounts, refresh persistence and sign-out/re-login.

KNO remains separate and untouched. Realtime is not implemented yet. Operational AppData has not yet been migrated or uploaded to Supabase.

The current implementation target is Step 6: switch authenticated application load/save from browser localStorage to the reviewed Supabase shared-state repository with explicit controlled initial operational state, revision-aware saves and safe failure/conflict behavior. Do not automatically upload Vuk's existing browser data.

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
- Reports: current-day totals and local Report Archive behavior implemented in the browser application.
- Settings: transactions, reports, reset, backups/local tools.

## Immediate objective

Build **Shared Petalon v1**:

- dedicated Beach Set Manager Supabase project;
- Supabase Auth accounts for Vuk, Vito and Mark;
- one Petalon location;
- one shared database-backed application state;
- Row Level Security on every exposed application table;
- active location membership as the access/revocation boundary;
- revision-checked shared state so stale writes cannot silently overwrite newer data;
- realtime or equivalent refresh behavior so all three users see accepted changes;
- no device/session-seat enforcement;
- no offline write queue;
- no multi-location provisioning automation yet.

The frontend is not treated as a security boundary. A copied browser bundle must not grant access to Petalon data without a valid authenticated user and active membership.

Commercial white-labeling, production ownership concealment, multi-location deployment automation, advanced licensing and device controls are later work.

See [[11_Project_Status_and_Next_Actions]].
