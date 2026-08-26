# Project Status and Next Actions

Status: `canonical`

## Current state

Shared Petalon operational persistence is merged in Step 6 / PR #12. Realtime/invalidation is implemented and independently reviewed in Step 7 / PR #14, pending merge.

Completed Shared Petalon foundations:

### Step 1 — merged

PR #3:

- browser-safe Supabase client/environment foundation;
- provider-neutral `SharedLocationStateRepository<T>`.

### Step 2 — merged

PR #5:

- dedicated Beach Set Manager Supabase project;
- `locations`, `location_memberships`, versioned `location_state`;
- RLS + least privilege;
- active membership as data-access boundary;
- trigger-owned revision/audit fields.

### Step 3 — merged

PR #6:

- real Auth identities for Vuk, Vito and Mark;
- active Petalon memberships;
- authenticated reads/writes, stale-write rejection, revocation/restoration and worker privilege denials verified.

### Step 4 — merged

PR #8:

- typed Supabase shared-state adapter;
- revision-safe conditional saves;
- RLS-aware conflict/unavailable classification.

### Step 5 — merged

PR #10:

- browser email/password Auth/session UX;
- persisted session restoration;
- account sign-out;
- no signup path.

### Step 6 — merged

PR #12:

- clean controlled operational Petalon seed;
- Supabase `location_state` is authoritative AppData;
- server-first load before editable UI;
- no operational localStorage fallback;
- tracked server revision and revision-checked saves;
- one save in flight with in-memory coalescing;
- no mount echo-save;
- conservative conflict/unavailable handling;
- backup/import/reset flow through shared persistence;
- account-switch isolation bound to authenticated user/controller;
- manual Vuk/Vito shared persistence verification passed.

### Step 7 — implemented and independently reviewed, PR #14 pending merge

PR #14 head `7af26050fd596e46db1ecaffaba957b61ffa19f8`:

- Supabase-specific realtime subscription stays inside `supabaseRepository.ts`;
- listens only to `UPDATE` on `public.location_state` filtered to the Petalon location ID;
- realtime payload carries only a revision invalidation hint; authoritative AppData/revision still comes from repository `load()` or accepted `save()`;
- focused migration adds only `public.location_state` to `supabase_realtime` in Beach Set Manager;
- successful subscribe/reconnect causes a defensive unversioned invalidation so missed events are reconciled;
- old/self revisions at or below the local accepted revision are ignored;
- clean newer invalidations trigger automatic authoritative reload;
- remote invalidations never replace an in-flight save or coalesced local mutation;
- existing stale-save conflict behavior remains authoritative;
- conflict/unavailable/not-found states are not automatically cleared by realtime events;
- at most one automatic reload is in flight; rapid invalidations coalesce to the newest necessary target;
- each authenticated user/controller owns one subscription; sign-out/account switch removes it and stale callbacks cannot affect the next user;
- manual Vuk→Vito and Vito→Vuk automatic convergence passed without refresh, including cleanup convergence;
- test suite reported 49/49 passing with build and `git diff --check` passing;
- migration status/publication verification passed; KNO remained untouched.

Review note: the initial `SUBSCRIBED` callback can defensively cause one additional authoritative reload if it arrives after the first load. This is an efficiency detail, not a correctness blocker: it cannot write state, bypass revision checks or create a mount echo-save.

Current Supabase advisor state remains:

- provider-level Auth warning: leaked-password protection disabled;
- informational performance notice: `location_state_updated_by_idx` currently unused.

## Immediate milestone

**Shared Petalon v1 verification** — prove the merged Auth + shared persistence + realtime + RLS behavior across real separate sessions/devices, including stale conflicts and membership revocation.

## Immediate next action — Step 8

After PR #14 merges, perform final separate-session/device verification.

Step 8 should verify at minimum:

- login/session persistence for Vuk, Vito and Mark;
- all three load the same authoritative Petalon state;
- accepted writes persist and converge automatically across open clients;
- refresh preserves the accepted server state;
- stale concurrent writes cannot silently overwrite newer state;
- conflict UI/recovery remains conservative;
- anonymous clients cannot access shared operational data;
- inactive/no membership prevents protected Petalon reads/writes through RLS;
- revocation does not expose a previous account's cached operational state;
- realtime subscriptions cleanly follow sign-out/account switch;
- cleanup leaves Petalon in a known valid operational state.

Do not add user-specific Vuk/Vito/Mark product differences until this verification passes and is independently reviewed.

## Deferred

Do not block Shared Petalon v1 on device/session limits, offline writes, licensing, multi-location provisioning, white-labeling, infrastructure concealment or payment integrations.
