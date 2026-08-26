# Beach Management Platform — Second Brain

Status: `canonical`
Last reviewed: 2026-08-26
Repository implementation checkpoint reviewed: `7af26050fd596e46db1ecaffaba957b61ffa19f8` (PR #14 head; independently reviewed, pending merge to main)

This vault is the human-readable control center for `beach-set-manager` as it evolves from a local-only Petalon PWA into a secure shared operational application.

## Project rule

> ==The repository, running code, tests, migrations and database are the technical source of truth. The Second Brain is the architecture memory, decision log and operating manual.==

## Current phase

The shared-platform, database/RLS, real-account authorization, repository-adapter, browser Auth/session, authoritative shared operational persistence and realtime-invalidation foundations now exist. Step 7 / PR #14 has been independently reviewed and is pending merge.

Completed / reviewed foundation:

- Step 1 / PR #3: browser Supabase dependency/environment contract, lazy client and provider-neutral versioned shared-state repository contract.
- Step 2 / PR #5: dedicated `Beach Set Manager` Supabase project `uonovdnxfjqfjkhopxwg`, migrations for `locations`, `location_memberships` and `location_state`, RLS/least-privilege grants, deterministic Petalon identity, generated database types and revision-safe conditional writes.
- Step 3 / PR #6: real Auth identities for Vuk, Vito and Mark, active Petalon memberships, controlled non-operational initial state and authenticated verification proving active-member access, stale-write rejection, trigger-owned audit fields, same-session membership revocation/restoration and worker privilege denials.
- Step 4 / PR #8: typed Supabase-backed `SharedLocationStateRepository<T>` adapter with RLS-aware load classification, mandatory `location_id + expectedRevision` saves, conflict classification and focused tests.
- Step 5 / PR #10: minimal browser email/password authentication and session UX with persisted session restoration, local sign-out and no signup path.
- Step 6 / PR #12: Supabase `location_state` became authoritative operational AppData; server-first load; controlled clean Petalon seed; revision-tracked serialized/coalesced saves; conservative conflict/unavailable handling; no operational localStorage fallback; backup/import/reset continue through the shared save path; account-switch isolation is bound to the current authenticated user/controller.
- Step 7 / PR #14: filtered Supabase Postgres Changes subscription for Petalon `location_state`; realtime payloads are invalidation hints only; authoritative AppData still comes through repository `load()`; old/own revisions are ignored; remote invalidations wait behind local saves/pending mutations; conflict/unavailable states remain conservative; automatic reloads are serialized/coalesced; subscription lifecycle is user/controller scoped; `public.location_state` is added to `supabase_realtime` through a focused migration.

Manual Vuk/Vito verification proved automatic convergence in both directions without manual refresh, including cleanup convergence. KNO remains separate and untouched.

The next implementation target after PR #14 merges is Step 8: final separate-session/device verification of login/session persistence, shared reads/writes, automatic convergence, refresh persistence, stale-write conflict behavior, no-anon/no-member denial and membership revocation.

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

Complete **Shared Petalon v1** by independently verifying the already-implemented shared/realtime behavior across real separate sessions/devices before introducing user-specific differences.

The frontend is not treated as a security boundary. A copied browser bundle must not grant access to Petalon data without a valid authenticated user and active membership.

Commercial white-labeling, production ownership concealment, multi-location deployment automation, advanced licensing and device controls are later work.

See [[11_Project_Status_and_Next_Actions]].
