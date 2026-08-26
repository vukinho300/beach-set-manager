# Project Status and Next Actions

Status: `canonical`

## Current state

Shared Petalon operational persistence is implemented and independently reviewed in Step 6 / PR #12, pending merge.

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
- realtime intentionally deferred.

### Step 5 — merged

PR #10:

- normalized browser Auth boundary with `{ id, email }` user model;
- Supabase email/password sign-in only; no signup/reset/OAuth paths;
- persisted browser session restoration and auth-state subscription cleanup;
- controlled initializing/unauthenticated/unavailable/authenticated states;
- Settings sign-out without erasing operational browser data.

### Step 6 — implemented and independently reviewed, PR #12 pending merge

PR #12 head `f37a9bbe517f2c187c126f134b11d41eeb3afe88`:

- extracted canonical AppData/domain types and default factories from `App.tsx` without a broad UI rewrite;
- conditionally replaced only the exact Step 3 revision-4 verification marker with clean operational Petalon AppData;
- initial clean seed contained 56 free sets, four free beds and no reservations, sales, transactions, reports or Aquapark activity;
- Supabase `location_state` is now the operational source of truth;
- authenticated application waits for server load before rendering editable operational state;
- missing/unavailable/revoked/malformed shared state never falls back to operational localStorage;
- the legacy `sunbed-beach-manager:v5` browser key is left physically untouched but is no longer read, written or deleted by the operational state lifecycle;
- in-memory server revision is retained from load and advanced only by accepted server responses;
- every save uses Petalon `location_id + expectedRevision` through the reviewed repository adapter;
- at most one save is in flight; rapid local changes coalesce to the latest pending snapshot;
- initial server mount does not create a redundant write;
- stale conflicts stop automatic writes and require deliberate shared reload rather than forced overwrite;
- save/backend/access unavailability suspends unsafe continued operation without localStorage fallback or automatic Auth sign-out;
- backup import, Daily Reset and Reset app data remain explicit AppData mutations through the shared revision-safe save path;
- realtime remains deferred;
- Vuk manually verified shared persistence across separate Vuk/Vito sessions and refreshes, then restored the test sets to free;
- after review, the account-switch isolation flaw was corrected: renderable shared state is tagged/bound to the current authenticated user ID, a user mismatch synchronously exposes loading, each identity gets a fresh controller, and deactivation invalidates old pending loads/saves/queued state;
- the correction prevents a newly authenticated or revoked account from rendering the previous account's cached AppData during the React effect boundary;
- test suite reported 41/41 passing after the correction, with build and `git diff --check` passing.

Current Supabase advisor state remains:

- provider-level Auth warning: leaked-password protection disabled;
- informational performance notice: `location_state_updated_by_idx` currently unused.

## Immediate milestone

**Shared Petalon v1** — Vuk, Vito and Mark can sign in, load the same authoritative Petalon state, save revision-safe shared updates and retain them after refresh. The next missing behavior is automatic cross-client convergence without manual refresh.

## Immediate next action — Step 7

After PR #12 merges, add realtime subscription or a minimal invalidation/reload mechanism so separate authenticated clients converge on accepted server state.

Step 7 must preserve Step 6 safety:

- Supabase remains authoritative;
- no localStorage operational fallback;
- do not bypass `location_id + expectedRevision` saves;
- do not force-overwrite stale state;
- incoming remote changes must not silently overwrite unsaved local changes or an in-flight save;
- subscription lifecycle must remain bound to the current authenticated user/location and clean up on sign-out/account switch;
- membership revocation must remain RLS-authoritative;
- no offline queue or role-specific UI yet.

After realtime/invalidation is independently reviewed, Step 8 will perform final separate-session/device verification including shared reads/writes, automatic convergence, stale conflict behavior and revocation.

## Deferred

Do not block Shared Petalon v1 on device/session limits, offline writes, licensing, multi-location provisioning, white-labeling, infrastructure concealment or payment integrations.
