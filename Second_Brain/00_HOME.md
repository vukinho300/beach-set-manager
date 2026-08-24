# Beach Management Platform — Second Brain

Status: `canonical`
Last reviewed: 2026-08-24
Repository implementation checkpoint reviewed: `8680bf97a513457cffb7b61d75aa2e5a49c00d76`

This vault is the human-readable control center for `beach-set-manager` as it evolves from a local-only Petalon PWA into a secure shared operational application.

## Project rule

> ==The repository, running code, tests, migrations and database are the technical source of truth. The Second Brain is the architecture memory, decision log and operating manual.==

## Current phase

The current application is still a polished single-browser React/Vite/TypeScript PWA using browser `localStorage`. There is no Beach Set Manager Supabase project, login, shared database or multi-user synchronization implemented yet.

The immediate goal is deliberately narrow: make one Petalon deployment work securely for Vuk, Vito and Mark against one shared database.

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

- Supabase Auth accounts for Vuk, Vito and Mark;
- one Petalon location;
- one shared database-backed application state;
- Row Level Security on every exposed application table;
- active location membership as the access/revocation boundary;
- realtime or equivalent refresh behavior so all three users see accepted changes;
- no device/session-seat enforcement;
- no offline write queue;
- no multi-location provisioning automation yet.

The frontend is not treated as a security boundary. A copied browser bundle must not grant access to Petalon data without a valid authenticated user and active membership.

Commercial white-labeling, production ownership concealment, multi-location deployment automation, advanced licensing and device controls are later work.

See [[11_Project_Status_and_Next_Actions]].
