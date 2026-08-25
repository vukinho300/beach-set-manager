# Project Status and Next Actions

Status: `canonical`

## Current state

The React application still uses browser `localStorage` as its live operational persistence.

Completed Shared Petalon foundations:

### Step 1 — merged

PR #3:

- pinned `@supabase/supabase-js`;
- browser-safe public environment contract;
- lazy Supabase client;
- provider-neutral `SharedLocationStateRepository<T>`.

### Step 2 — merged

PR #5:

- dedicated Supabase project `Beach Set Manager` / `uonovdnxfjqfjkhopxwg`;
- KNO separate and untouched;
- `locations`, `location_memberships`, versioned `location_state`;
- RLS + explicit least-privilege grants;
- active membership as data-access boundary;
- trigger-owned revision, `updated_at`, `updated_by`;
- generated database types.

### Step 3 — merged

PR #6:

- real Auth identities for Vuk, Vito and Mark;
- Vuk active `PLATFORM_OWNER`; Vito and Mark active `WORKER`;
- controlled non-operational state;
- authenticated reads/writes, stale-write rejection, audit-field ownership, same-session revocation/restoration and worker privilege denials verified.

### Step 4 — merged

PR #8:

- typed Supabase-backed `SharedLocationStateRepository<T>` adapter;
- load distinguishes visible, missing-active-member and inaccessible states;
- save always sends only `state` and always filters by `location_id + expectedRevision`;
- stale zero-row writes become `conflict`, revoked/network/access cases remain `unavailable`;
- no unconditional overwrite path;
- realtime intentionally deferred;
- focused adapter tests pass.

### Step 5 — implemented and independently reviewed, PR #10 pending merge

PR #10 head `cebdaa2024e3d129d296d952ae20e61d4d0bbfe6`:

- normalized browser Auth boundary with `{ id, email }` user model;
- Supabase email/password sign-in only; no signup/reset/OAuth paths;
- persisted browser session restoration and one auth-state subscription with cleanup;
- controlled initializing/unauthenticated/unavailable/authenticated states;
- existing operational app gated behind authentication;
- Settings → Account sign-out using local Supabase sign-out;
- sign-out does not erase operational localStorage;
- missing public Supabase configuration fails safely;
- focused Auth tests plus existing adapter tests pass 22/22;
- Vuk manually verified Vuk/Vito/Mark login, session persistence across refresh, sign-out/re-login and preservation of existing local app data;
- no operational Supabase AppData persistence, realtime, schema, Vercel or credential changes.

Current Supabase advisor state remains:

- provider-level Auth warning: leaked-password protection disabled;
- informational performance notice: `location_state_updated_by_idx` currently unused.

## Immediate milestone

**Shared Petalon v1** — Vuk, Vito and Mark can sign in, load the same Petalon state, make shared updates, see accepted changes, retain shared state after refresh, and be denied Petalon data when membership is inactive.

## Immediate next action — Step 6

Switch authenticated operational application load/save from browser localStorage to the reviewed Supabase `SharedLocationStateRepository<AppData>` path.

Step 6 must be deliberate because the current remote `location_state` contains controlled verification data, not a valid operational AppData payload. Before the operational app consumes it, establish one controlled valid Petalon AppData state through a trusted/reproducible path. Do **not** automatically upload Vuk's current browser/localStorage data.

The live application should then:

- wait for the initial shared-state load before rendering operational data;
- use Petalon location `00000000-0000-4000-8000-000000000001`;
- treat the loaded Supabase revision as the save base;
- save every accepted application state through the adapter with expected revision;
- advance the in-memory revision only from accepted server responses;
- never fall back to silent localStorage writes when Supabase is unavailable or membership is revoked;
- surface loading, access/unavailable and conflict states safely;
- preserve backup/import functionality as explicit user tools, but stop treating localStorage as operational shared truth once the switch is enabled;
- keep realtime deferred to the following step.

Do not automatically merge divergent local browser state into the server. Conflict resolution remains conservative until a later workflow explicitly defines reconciliation behavior.

## Deferred

Do not block Shared Petalon v1 on device/session limits, offline writes, licensing, multi-location provisioning, white-labeling, infrastructure concealment or payment integrations.
