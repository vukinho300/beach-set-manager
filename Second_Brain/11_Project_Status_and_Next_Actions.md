# Project Status and Next Actions

Status: `canonical`

## Current state

The React application still uses browser `localStorage` as its live operational persistence.

Completed Shared Petalon foundations:

### Step 1 — merged

PR #3 / `85005007d285a2cd3366c1297286b7f5b96a43ad`:

- pinned `@supabase/supabase-js`;
- browser-safe public environment contract;
- lazy Supabase client;
- provider-neutral `SharedLocationStateRepository<T>` with accepted/conflict/unavailable results.

### Step 2 — merged

PR #5:

- dedicated Supabase project `Beach Set Manager` / `uonovdnxfjqfjkhopxwg`;
- KNO separate and untouched;
- migrations for `locations`, `location_memberships`, and versioned `location_state`;
- Petalon location `00000000-0000-4000-8000-000000000001`;
- RLS + explicit least-privilege grants;
- active membership as the Petalon data-access boundary;
- browser writes limited to `location_state.state`;
- trigger-owned revision, `updated_at`, and `updated_by`;
- stale expected-revision updates affect zero rows when the required `location_id + revision` filter is used;
- generated database types.

### Step 3 — implemented and independently reviewed, PR #6 pending merge

PR #6 head `a8bb0073469ca2dcbd6d0275a03a6a0d7275ded3` adds one credential-safe PowerShell verification helper and uses the real development Auth identities:

- Vuk: active `PLATFORM_OWNER` membership;
- Vito: active `WORKER` membership;
- Mark: active `WORKER` membership;
- controlled non-operational `location_state` instead of importing Vuk's browser data;
- real authenticated reads/writes verified for all three users;
- accepted write advances revision exactly once;
- stale expected revision affects zero rows and cannot overwrite newer state;
- `updated_by` is stamped from the authenticated identity;
- browser attempts to forge revision/`updated_by`/`updated_at` are denied;
- same authenticated Vito session loses Petalon location/state access immediately when membership becomes inactive and regains access when reactivated;
- worker membership administration, role elevation and location creation/deletion are denied;
- credential-free verification report assertions passed 49/49;
- KNO remains untouched.

Live Supabase advisor state after Step 3 review:

- security/RLS schema checks are clean;
- one provider-level Auth warning remains: leaked-password protection is disabled;
- one informational performance notice remains: `location_state_updated_by_idx` has not yet been used.

The leaked-password warning is a hardening item, not a blocker for the current repository/RLS architecture. It should be enabled before broader production/commercial use unless product constraints justify otherwise.

Still not implemented:

- Supabase-backed repository adapter;
- live application persistence through Supabase;
- login/auth UI in the React application;
- realtime shared updates;
- controlled migration of actual operational AppData.

## Immediate milestone

**Shared Petalon v1** — Vuk, Vito and Mark can sign in, load the same Petalon state, make shared updates, see accepted changes, retain shared state after refresh, and be denied Petalon data when membership is inactive.

## Immediate next action — Step 4

Implement the Supabase-backed `SharedLocationStateRepository<T>` adapter only.

Step 4 must:

- use the existing lazy Supabase client and generated database types;
- load `location_state` through RLS;
- save with both `location_id` and `expectedRevision` in the update predicate;
- treat exactly one returned row as `accepted`;
- distinguish a stale zero-row update from unavailability and map it to the existing `conflict` result, retrieving current state if necessary without masking authorization/network failures;
- keep provider response objects behind the repository boundary;
- avoid letting callers accidentally perform an unconditional state overwrite;
- add focused tests for accepted save, stale conflict, denied/unavailable behavior and mapping to the domain contract.

Do **not** switch `App.tsx` or the live application to this adapter in Step 4. The browser application remains localStorage-live until the adapter is independently reviewed.

## Deferred

Do not block Shared Petalon v1 on device/session limits, offline writes, licensing, multi-location provisioning, white-labeling, infrastructure concealment or payment integrations.
