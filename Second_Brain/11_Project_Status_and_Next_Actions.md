# Project Status and Next Actions

Status: `canonical`

## Current state

The React application still uses browser `localStorage` as its live operational persistence.

Step 1 is implemented and merged in PR #3 at `85005007d285a2cd3366c1297286b7f5b96a43ad`:

- pinned `@supabase/supabase-js` dependency;
- `.env.example` contract for `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`;
- lazy browser Supabase client;
- provider-neutral versioned shared-state repository contract with accepted/conflict/unavailable outcomes;
- existing localStorage behavior verified unchanged.

Step 2 is implemented on PR #5 at head `96c169971b45719daa35b8e73de1e1d69163f885` and has been independently reviewed against the remote Supabase project:

- dedicated Supabase project: `Beach Set Manager` / `uonovdnxfjqfjkhopxwg`;
- KNO remains separate and untouched;
- Supabase CLI pinned at 2.115.0;
- reproducible migration for `locations`, `location_memberships`, and `location_state`;
- Petalon location identity seeded as `00000000-0000-4000-8000-000000000001` without operational AppData;
- RLS enabled on all application tables;
- anon has no application-table privileges;
- active membership is required for Petalon location/state access;
- browser membership administration/role elevation is not allowed;
- `location_state` client writes are limited to `state`, while revision/audit fields are trigger-owned;
- stale expected-revision updates affect zero rows when the adapter uses the required `location_id + revision` predicate;
- generated database types exist;
- Supabase security advisor reports no issues;
- authenticated no-membership access was verified as denied/empty;
- anon access was verified denied.

The only current Supabase performance advisor notice is informational: `location_state_updated_by_idx` is unused so far. It is intentionally retained for future FK cleanup/query needs unless evidence later shows it is unnecessary.

Still not implemented:

- real Vuk/Vito/Mark Auth accounts;
- active Petalon memberships for those three users;
- active-member and inactive-membership revocation verification with real accounts;
- controlled initial `location_state` seed;
- Supabase-backed repository adapter;
- switching live application persistence away from localStorage;
- login/auth UI;
- realtime shared updates.

## Immediate milestone

**Shared Petalon v1** — Vuk, Vito and Mark can sign in, load the same Petalon state, make shared updates, see accepted changes, retain shared state after refresh, and be denied Petalon data when membership is inactive.

## Immediate next action — Step 3

Provision the three real development Auth identities for Vuk, Vito and Mark, attach all three to Petalon with active memberships, create one controlled initial `location_state`, and verify the RLS/revocation model with those real identities.

Step 3 must prove at minimum:

- each active member can read the Petalon location and current state;
- each active member can perform the intended revision-safe state update path;
- a stale expected revision is classified as a conflict and does not overwrite newer state;
- setting one membership `active=false` immediately blocks that user's subsequent Petalon location/state access;
- reactivation restores access;
- users cannot create/elevate memberships or modify audit/revision fields through the browser role;
- KNO remains untouched.

The revision invariant is not considered complete at the application boundary until the Supabase repository adapter always includes the required expected-revision predicate. That adapter remains a later step after real-account RLS verification.

Do not switch the production/live React persistence path in Step 3. The app remains localStorage-live until the account/RLS setup and controlled server state are reviewed.

## Deferred

Do not block Shared Petalon v1 on device/session limits, offline writes, licensing, multi-location provisioning, white-labeling, infrastructure concealment or payment integrations.
