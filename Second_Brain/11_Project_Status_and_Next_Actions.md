# Project Status and Next Actions

Status: `canonical`

## Current state

The application still uses browser `localStorage` as its live operational persistence, but Step 1 of Shared Petalon v1 is implemented and merged in PR #3 at repository commit `85005007d285a2cd3366c1297286b7f5b96a43ad`.

Implemented foundation:

- pinned `@supabase/supabase-js` dependency;
- `.env.example` contract for `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`;
- lazy browser Supabase client that is unused by normal startup when unconfigured;
- provider-neutral versioned shared-state repository contract with accepted/conflict/unavailable outcomes;
- existing localStorage behavior verified unchanged by build checks and Vuk's manual refresh-persistence check.

Still not implemented:

- dedicated Beach Set Manager Supabase project;
- database tables/migrations;
- RLS policies;
- Auth accounts;
- live Supabase persistence;
- realtime shared updates.

The connected Supabase account currently contains an unrelated `KNO` project. It must not be reused for Beach Set Manager.

## Immediate milestone

**Shared Petalon v1** — Vuk, Vito and Mark can sign in, load the same Petalon state, make shared updates, see accepted changes, retain shared state after refresh, and be denied Petalon data when membership is inactive.

## Immediate next action — Step 2

Create the dedicated Beach Set Manager Supabase development project and establish the reproducible database/security foundation.

Step 2 should produce repository migrations for the minimal first schema:

- `locations`;
- `location_memberships`;
- versioned `location_state` JSONB.

All exposed application tables must have RLS enabled. Normal browser access must require authenticated active membership for the target location. `TO authenticated` alone is not sufficient authorization.

Step 2 should also establish revision-safe shared-state writes at the database boundary so a stale expected revision cannot silently overwrite newer state.

Do not create Vuk/Vito/Mark production-style account flows or switch the application to live Supabase persistence in Step 2. Those follow after the schema/RLS foundation is independently reviewed and tested.

## Deferred

Do not block Shared Petalon v1 on device/session limits, offline writes, licensing, multi-location provisioning, white-labeling, infrastructure concealment or payment integrations.
