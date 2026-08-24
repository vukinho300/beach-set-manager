# Beach Management Platform — Second Brain

Status: `canonical`
Last reviewed: 2026-08-25
Repository implementation checkpoint reviewed: `a8bb0073469ca2dcbd6d0275a03a6a0d7275ded3` (PR #6 head; pending merge to main)

This vault is the human-readable control center for `beach-set-manager` as it evolves from a local-only Petalon PWA into a secure shared operational application.

## Project rule

> ==The repository, running code, tests, migrations and database are the technical source of truth. The Second Brain is the architecture memory, decision log and operating manual.==

## Current phase

The browser application is still operationally localStorage-based, but the shared-platform, database/security and real-account authorization foundations now exist.

Completed foundation:

- Step 1 / PR #3: browser Supabase dependency/environment contract, lazy client and provider-neutral versioned shared-state repository contract.
- Step 2 / PR #5: dedicated `Beach Set Manager` Supabase project `uonovdnxfjqfjkhopxwg`, migrations for `locations`, `location_memberships` and `location_state`, RLS/least-privilege grants, deterministic Petalon identity, generated database types and revision-safe conditional writes.
- Step 3 / PR #6: real Auth identities for Vuk, Vito and Mark, active Petalon memberships, controlled non-operational initial state and credential-safe authenticated verification proving active-member access, stale-write rejection, trigger-owned audit fields, same-session membership revocation/restoration and worker privilege denials.

KNO remains separate and untouched. The React application has not yet been switched to Supabase persistence and still has no login UI or realtime synchronization.

The current implementation target is Step 4: implement the Supabase-backed repository adapter behind the existing `SharedLocationStateRepository<T>` boundary. Step 4 must make the required `location_id + expectedRevision` predicate unavoidable and correctly classify zero-row stale writes as `conflict`, while leaving the live app localStorage-based until the adapter itself is reviewed.

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
