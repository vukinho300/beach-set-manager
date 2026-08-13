# Current Architecture and Repository State

Status: `canonical`
Repository reviewed: 2026-08-13
Checkpoint inspected: `7431bd93884337db1ab47e9bac2a50fc8e07a168`

## Verified repository state

The app is a React 18 + Vite + TypeScript PWA. `package.json` currently has only React/ReactDOM as runtime dependencies; there is no Supabase/Firebase/backend SDK yet.

The application is still mostly monolithic: `src/App.tsx` is roughly 150 KB and `src/App.css` roughly 80 KB. This is acceptable as a prototype but should be decomposed gradually during the backend phase rather than rewritten all at once.

## Current persistence

Operational state is saved into browser `localStorage` under versioned keys. Current app data includes:

- 56 numbered beach sets;
- 4 extra beds;
- beach reservations;
- saved surnames;
- non-numbered sunbed sales;
- Aquapark entries;
- transaction ledger;
- automatic reset date.

There is migration code for older localStorage versions and backup/import compatibility.

## Current transaction model

The app already has a current-day `Transaction` ledger with types:

- `beach_set`
- `bed`
- `sunbed`
- `beach_reservation`
- `aquapark`

Transactions support active/deleted state and deleted timestamps. Daily reports are derived from active transactions. Operational objects still contain some pricing and linkage fields such as `dailySaleId`, so the backend migration must remove duplicate financial ownership carefully rather than assuming the ledger is already the only source of truth.

## Current pages/navigation

Top-level tabs:

- Beaches
- Sunbeds
- Aquapark
- Settings

Settings contains Transactions and Reports views plus reset/backup tooling. Beaches has persistent Beach 1 / Beach 2 / Beds shortcuts.

## Current offline behavior

The PWA registers `public/sw.js`. It provides network-first GET caching with cached fallbacks and navigation fallback to `/`. This supports app-shell/read availability when network access is lost, but there is no shared backend and no offline mutation queue or conflict-aware synchronization.

## Current deployment

Repository docs describe Vercel deployment as a Vite static app with no environment variables. Existing README/DEPLOYMENT still explicitly say the app is local-only. These files will become outdated once the shared-backend implementation begins and must be updated in that phase.

## Important current constraints

1. No authentication.
2. No server/database.
3. No cross-device synchronization.
4. Browser localStorage is authoritative.
5. Daily Reset is device-driven.
6. No server-side concurrency controls.
7. No tenant/customer isolation.
8. No licensing enforcement.

## Do not mistake for implemented

The following are accepted direction, not current code:

- Supabase/Postgres;
- Auth;
- RLS;
- multi-tenancy;
- realtime shared state;
- offline sync outbox;
- licensing/session controls;
- private platform-admin control plane.
