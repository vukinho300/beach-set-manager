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
- generated database types.

### Step 3 — merged

PR #6:

- real Auth identities for Vuk, Vito and Mark;
- Vuk active `PLATFORM_OWNER`; Vito and Mark active `WORKER`;
- controlled non-operational `location_state` instead of browser data import;
- authenticated reads/writes verified for all three;
- stale expected revision cannot overwrite newer state;
- trigger-owned audit fields verified;
- same-session inactive-membership revocation/restoration verified;
- worker privilege escalation and membership/location administration denied;
- credential-free verification report assertions passed 49/49;
- KNO untouched.

### Step 4 — implemented and independently reviewed, PR #8 pending merge

PR #8 head `210665d25f32ededab9b6b05f13374dfec587acd`:

- typed Supabase-backed `SharedLocationStateRepository<T>` adapter;
- generated `Database` types used by the browser client;
- load distinguishes visible state, active-member missing state, and inaccessible/revoked state;
- save always sends only `state` and always filters by both `location_id` and `expectedRevision`;
- one returned row maps to `accepted`;
- zero-row writes are classified with an RLS-protected follow-up read so stale state becomes `conflict` while revoked/network/authorization cases remain `unavailable`;
- disappearing state with an active membership maps to `conflict` with `current: null`;
- no unconditional state-overwrite path exists in the adapter;
- realtime remains intentionally deferred through a stable no-op subscription;
- focused Vitest coverage passes 11/11;
- `npm run build`, `npm test`, and `git diff --check` pass;
- no `App.tsx`, schema, Vercel, CSS, realtime, credential, or operational persistence changes.

Current Supabase advisor state:

- provider-level Auth warning: leaked-password protection disabled;
- informational performance notice: `location_state_updated_by_idx` currently unused.

These do not block the current Shared Petalon implementation track. Leaked-password protection remains a hardening item before broader production/commercial use.

Still not implemented:

- browser login/session UX;
- live application persistence through the reviewed Supabase adapter;
- controlled initial operational AppData migration/seed;
- realtime shared updates.

## Immediate milestone

**Shared Petalon v1** — Vuk, Vito and Mark can sign in, load the same Petalon state, make shared updates, see accepted changes, retain shared state after refresh, and be denied Petalon data when membership is inactive.

## Immediate next action — Step 5

Implement the minimal email/password browser authentication and session UX required for Vuk, Vito and Mark.

This sequencing is intentional: the verified shared-state adapter reads/writes RLS-protected tables and therefore needs a real authenticated browser session before the application can safely switch live operational persistence away from localStorage.

Step 5 should:

- use the existing Supabase browser client;
- provide minimal email/password sign-in and sign-out;
- restore an existing Supabase session on refresh;
- expose a small provider-neutral Auth/session boundary to application code where useful instead of spreading Supabase response objects throughout the UI;
- clearly represent loading, authenticated and unauthenticated states;
- ensure a revoked/inactive membership is not treated as an authentication failure; membership access remains a database/RLS concern;
- keep the existing operational application on localStorage after authentication succeeds;
- add focused Auth/session tests without storing real passwords or tokens.

Do **not** switch `App.tsx` load/save to Supabase in Step 5. That is the next step after browser Auth/session behavior is independently reviewed.

## Deferred

Do not block Shared Petalon v1 on device/session limits, offline writes, licensing, multi-location provisioning, white-labeling, infrastructure concealment or payment integrations.
