# Deployment and Environment Safety

Beach Set Manager is a live Vercel PWA backed by Supabase. Petalon contains real operational Production data.

## Current reality

- The Production frontend is deployed from `main` through the existing Vercel project.
- The current Production frontend is the Petalon/R2 application.
- Beach Set Manager uses Supabase project `uonovdnxfjqfjkhopxwg` for Auth, Postgres, RLS and Realtime.
- A separate Development Supabase environment is not currently proven to exist.
- Preview deployments may be configured with the live backend. Such previews are Production-capable and must not be used for casual destructive testing.
- Draft PR #28's Step 10 frontend is not Production. Its additive database foundation already exists remotely.

KNO project `asrrkwyqerfkynhjypov` is unrelated. Never link, query, migrate or reuse it for Beach Set Manager.

## Desired safer environment policy

The target topology is:

- Development: local/Vercel Preview frontend plus a separate Development Supabase project containing non-production test data.
- Production: `main` Vercel deployment plus the live Beach Set Manager Supabase project.

This is a target, not a claim about today's environment. Until separate isolation exists, every Preview using the live Supabase URL must be treated as Production-capable.

## Vercel settings

- Framework preset: `Vite`
- Install command: `npm install`
- Build command: `npm run build`
- Output directory: `dist`

Required public environment variables:

```text
VITE_SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY
```

These values identify/connect the public browser client. Never put a Supabase service-role/secret key, database password, Auth password or privileged provider token into a Vite browser variable.

Verify the Vercel project and target environment before changing variables. Do not assume Preview and Production use different backends merely because they are different frontend deployments.

## Supabase migrations and security

Database migrations live in `supabase/migrations/`. Schema changes must remain represented by reviewed timestamped migrations.

Before remote database work:

1. verify the linked project ref is exactly `uonovdnxfjqfjkhopxwg`;
2. run the migration list and inspect pending files;
3. inspect the SQL and confirm it does not modify real Petalon operational AppData;
4. apply only reviewed migrations;
5. run the migration list again;
6. verify affected RLS, grants, functions, triggers and Realtime publication;
7. run Supabase security/performance advisors and classify new findings.

Auth plus active location-membership RLS is the data-access boundary. Frontend navigation and hidden controls are not security. No service-role credential belongs in the browser.

Prefer read-only checks and rollback-only test transactions against Production. Never rewrite Petalon operational state merely to make a verification convenient.

## Pre-deployment verification

From a clean branch/worktree based on current `origin/main`:

```powershell
npm test
npm run build
git diff --check
```

Inspect the complete diff and confirm the deployment target and commit. Use a Draft PR for review. Do not merge or deploy Production automatically unless the task explicitly authorizes it.

## Preview precautions

When a Preview points at the live backend:

- treat all authenticated actions as real Production actions;
- do not run resets, imports, destructive recovery or fault injection against real Petalon data;
- use read-only or transaction-rolled-back security checks where possible;
- do not create fake operational transactions that could enter reports;
- complete required multi-device manual testing with harmless reversible actions and explicit cleanup.

Future fault-injection/test seams must remain unavailable in normal Production UI and builds.

## PWA lifecycle

The application installs from Safari/compatible browsers as a Home Screen PWA. A new deployment does not guarantee that every already-open PWA process immediately runs the new build.

After reliability-sensitive deployment, verify:

- a fresh browser load;
- installed-PWA close/reopen;
- background/foreground and lock/unlock;
- Auth/session restoration;
- IndexedDB and localStorage recovery paths;
- Realtime reconnection and convergence from another device.

The current service worker caches only same-origin application-shell requests and does not intercept Supabase/Auth/API traffic.

## Production verification and rollback

After deployment, confirm the expected commit/build, successful authentication, membership loading, authoritative state load, one safe save path and Realtime convergence.

Frontend rollback and database rollback are separate concerns. Reverting a frontend deployment does not revert an applied database migration. Prefer additive, backward-compatible migrations and forward fixes. Never destructively restore or overwrite operational data without explicit evidence, authorization and a verified recovery plan.

If a release creates an operational safety risk, stop further rollout, preserve evidence and use the incident/Never-Again process in `Second_Brain/18_Production_Incidents_and_Never_Again_Rules.md`.
