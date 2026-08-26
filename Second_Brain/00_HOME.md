# Beach Management Platform — Second Brain

Status: `canonical`
Last reviewed: 2026-08-26
Repository implementation checkpoint reviewed: `1e9b67d4a7755dafd26f31dff2aef73bb69da56e` (Step 8 final verification; no implementation changes required)

This vault is the human-readable control center for `beach-set-manager` as it evolves from a local-only Petalon PWA into a secure shared operational application.

## Project rule

> ==The repository, running code, tests, migrations and database are the technical source of truth. The Second Brain is the architecture memory, decision log and operating manual.==

## Current phase

**Shared Petalon v1 is VERIFIED.** The shared-platform, database/RLS, real-account authorization, repository-adapter, browser Auth/session, authoritative shared operational persistence and realtime-invalidation foundations are implemented, merged and now verified across all three real accounts.

Completed / verified foundation:

- Step 1 / PR #3: browser Supabase dependency/environment contract, lazy client and provider-neutral versioned shared-state repository contract.
- Step 2 / PR #5: dedicated `Beach Set Manager` Supabase project `uonovdnxfjqfjkhopxwg`, migrations for `locations`, `location_memberships` and `location_state`, RLS/least-privilege grants, deterministic Petalon identity, generated database types and revision-safe conditional writes.
- Step 3 / PR #6: real Auth identities for Vuk, Vito and Mark, active Petalon memberships, authenticated verification, stale-write rejection, trigger-owned audit fields, revocation/restoration and worker privilege denials.
- Step 4 / PR #8: typed Supabase-backed `SharedLocationStateRepository<T>` adapter with mandatory `location_id + expectedRevision`, RLS-aware load/save classification and conservative conflict handling.
- Step 5 / PR #10: browser email/password authentication and persisted session UX with local sign-out and no public signup path.
- Step 6 / PR #12: Supabase `location_state` became authoritative operational AppData; server-first load; controlled clean seed; revision-tracked serialized/coalesced saves; no operational localStorage fallback; conservative conflict/unavailable handling; backup/import/reset remain on the shared save path; account-switch isolation is bound to the current authenticated user/controller.
- Step 7 / PR #14: filtered Supabase Postgres Changes invalidation for the Petalon `location_state` row; authoritative AppData still comes through repository `load()`; old/own revisions are ignored; in-flight/pending local work is protected; automatic reloads are serialized/coalesced; subscription lifecycle is user/controller scoped; `public.location_state` is published to `supabase_realtime` through a focused migration.
- Step 8: final real three-account verification passed with no implementation changes required. Vuk, Vito and Mark authenticated, retained sessions across refresh, loaded the same authoritative state, converged automatically through realtime, and passed account-switch isolation. Anonymous access denial, stale-write conflict protection, worker privilege restrictions, live membership revocation/restoration and no-local-fallback behavior were all verified.

Final Step 8 Petalon state:

- revision `33`;
- exactly one Petalon `location_state` row;
- 56/56 sets free;
- 4/4 beds free;
- no reservations, sunbed sales, Aquapark activity, transactions, report archive entries or saved surnames;
- Vuk, Vito and Mark memberships all restored active;
- KNO remains separate and untouched.

Current known Supabase advisor items remain the provider-level leaked-password-protection warning and the informational unused `location_state_updated_by_idx` notice.

The immediate operational next task is **Production Phone Deployment Readiness**: configure the Vercel deployment with the Beach Set Manager browser-safe Supabase public environment values, redeploy current `main`, and verify the real production URL on Vuk's phone including login, persisted session, shared state and realtime convergence. This is deployment/readiness work, not a new data-architecture step.

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

Make the **verified Shared Petalon v1** available and verified on the real Vercel Production URL used from Vuk's phone, without weakening the existing Auth/RLS/revision/realtime architecture.

The frontend is not treated as a security boundary. A copied browser bundle must not grant access to Petalon data without a valid authenticated user and active membership.

User-specific owner/worker UI differences, commercial white-labeling, multi-location deployment automation, advanced licensing and device controls remain later work.

See [[11_Project_Status_and_Next_Actions]].
