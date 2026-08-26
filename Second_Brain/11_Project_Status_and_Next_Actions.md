# Project Status and Next Actions

Status: `canonical`

## Current state

**Shared Petalon v1 is VERIFIED.** Steps 1–7 are implemented and merged, and Step 8 final three-account/security/realtime verification passed with no implementation changes required.

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

### Step 7 — merged

PR #14:

- Supabase-specific realtime subscription stays inside `supabaseRepository.ts`;
- listens only to `UPDATE` on `public.location_state` filtered to the Petalon location ID;
- realtime is invalidation-only; authoritative AppData/revision still comes from repository `load()` or accepted `save()`;
- focused migration adds only `public.location_state` to `supabase_realtime` in Beach Set Manager;
- old/self revisions are ignored;
- clean newer invalidations trigger automatic authoritative reload;
- in-flight/pending local work remains protected by the revision-safe save lifecycle;
- conflict/unavailable/not-found states are not automatically cleared by realtime;
- automatic reloads are serialized/coalesced;
- user/controller-scoped subscription cleanup prevents cross-account callbacks;
- manual Vuk/Vito no-refresh convergence passed.

### Step 8 — VERIFIED

Final verification ran against main checkpoint `1e9b67d4a7755dafd26f31dff2aef73bb69da56e` and required no implementation changes.

Verified:

- Vuk, Vito and Mark authenticate successfully;
- sessions survive refresh and sign-out returns to login;
- same-browser account switching does not expose previous-user AppData;
- all active users load the same authoritative Petalon state;
- accepted shared writes persist and automatically converge in all three directions without refresh;
- stale writes cannot silently overwrite newer revisions and use the deliberate conflict path;
- anonymous API access is denied and anonymous table/update privileges are absent;
- worker privilege protection remains effective;
- live membership revocation denied protected load/save without deleting Auth or falling back to cached/local operational data;
- restored membership returned access normally;
- local/remote migrations are aligned through `20260826072628`;
- `public.location_state` remains the only application table in `supabase_realtime`;
- tests pass 49/49, production build passes and `git diff --check` passes;
- no credentials were committed and KNO remained untouched.

Final clean Petalon state after Step 8:

- revision `33`;
- 56/56 sets free;
- 4/4 beds free;
- no reservations, sunbed sales, Aquapark activity, transactions, report archive entries or saved surnames;
- Vuk active `PLATFORM_OWNER`;
- Vito active `WORKER`;
- Mark active `WORKER`.

Current Supabase advisor state remains:

- provider-level Auth warning: leaked-password protection disabled;
- informational performance notice: `location_state_updated_by_idx` currently unused.

## Immediate milestone

**Production Phone Deployment Readiness** — make the already-verified Shared Petalon v1 usable from the deployed Vercel Production URL on Vuk's phone.

## Immediate next action

Audit and configure the Vercel Production deployment for the current merged `main`.

At minimum:

- confirm the correct Vercel project/deployment is linked to `beach-set-manager`;
- ensure Production has the browser-safe Beach Set Manager values for `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`;
- never put a service-role/secret key or other privileged credential in the browser environment;
- redeploy current `main` after environment changes because Vite injects `VITE_*` values at build time;
- confirm the production build contains the current shared persistence + realtime implementation;
- verify on Vuk's phone: login, shared state load, refresh/session persistence, normal write/save, realtime convergence with another session/device and sign-out/re-login;
- keep the existing Auth/RLS/revision/conflict/realtime architecture unchanged unless an actual deployment-specific bug is discovered.

Do not begin owner/worker UI differences until phone Production readiness is complete and independently reviewed.

## Deferred

Do not block phone Production readiness on user-specific role UI, device/session limits, offline writes, licensing, multi-location provisioning, white-labeling, infrastructure concealment or payment integrations.
