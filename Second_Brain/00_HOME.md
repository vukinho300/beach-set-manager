# Beach Management Platform — Second Brain

Status: `canonical`
Last reviewed: 2026-08-24
Repository implementation checkpoint reviewed: `96c169971b45719daa35b8e73de1e1d69163f885` (PR #5 head; pending merge to main)

This vault is the human-readable control center for `beach-set-manager` as it evolves from a local-only Petalon PWA into a secure shared operational application.

## Project rule

> ==The repository, running code, tests, migrations and database are the technical source of truth. The Second Brain is the architecture memory, decision log and operating manual.==

## Current phase

The browser application is still operationally localStorage-based, but the shared-platform foundation and database/security foundation now exist.

Implemented and merged in Step 1 / PR #3:

- pinned `@supabase/supabase-js` browser dependency;
- browser-safe Supabase environment contract using project URL + publishable key only;
- lazy Supabase client creation with no live startup request;
- provider-neutral versioned shared-state repository contract.

Implemented in Step 2 / PR #5 and independently reviewed against the dedicated remote Supabase project:

- dedicated `Beach Set Manager` Supabase project `uonovdnxfjqfjkhopxwg` (separate from KNO);
- project-scoped Supabase CLI 2.115.0;
- repository migration for `locations`, `location_memberships`, and `location_state`;
- deterministic Petalon location identity `00000000-0000-4000-8000-000000000001`;
- RLS and least-privilege grants using active location membership as the data-access boundary;
- revision-safe shared-state updates using `location_id + expectedRevision`, with trigger-owned revision/audit fields;
- generated Supabase TypeScript database types;
- clean Supabase security advisor result and verified anon/no-membership denial paths.

No Vuk/Vito/Mark Auth accounts, live Supabase application persistence, login UI, or realtime synchronization are implemented yet.

The immediate goal remains deliberately narrow: make one Petalon deployment work securely for Vuk, Vito and Mark against one shared database.

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
