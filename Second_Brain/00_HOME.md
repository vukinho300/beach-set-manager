# Beach Management Platform — Second Brain

Status: `canonical`
Last reviewed: 2026-08-13
Repository checkpoint: `7431bd93884337db1ab47e9bac2a50fc8e07a168`

This vault is the human-readable control center for `beach-set-manager` as it evolves from a local-only Petalon PWA into a secure, shared, multi-tenant seasonal SaaS platform.

## Project rule

> ==The repository, running code, tests, migrations and database are the technical source of truth. The Second Brain is the architecture memory, decision log and operating manual.==

## Current phase

The current application is a polished single-browser React/Vite/TypeScript PWA. Operational state is still stored in browser `localStorage`; there is no backend, login, shared database or real-time multi-user synchronization yet. The next major chapter is the shared-platform foundation.

## Main navigation

1. [[01_Main_Plan]]
2. [[02_Project_Boundaries_and_AI_Roles]]
3. [[03_Current_Architecture_and_Repository_State]]
4. [[04_Data_Model_and_Realtime_Sync]]
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

## Current product areas

- Beaches: 56 numbered sets across Beach 1 and Beach 2.
- Beds: 4 extra beds.
- Beach reservations: date-based, paid amount, notes, multi-assignment to sets/beds.
- Non-numbered Sunbeds: quantity + amount + description sales.
- Aquapark: wristbands, ticket types, prices, timing, extra time, returned wristbands, expiry highlighting.
- Transactions: current-day ledger with deletion audit state.
- Reports: current-day totals derived from active transactions.
- Settings: transactions, reports, reset, backups/local tools.

## Immediate objective

Build **Secure Shared Petalon** for Vuk and Vito first: authenticated users, one shared database-backed state, Row Level Security, durable persistence, and real-time updates between devices. Offline mutation sync is designed now but should be implemented only after the online shared path and concurrency rules are proven.

See [[11_Project_Status_and_Next_Actions]].
