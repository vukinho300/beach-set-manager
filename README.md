# Beach Set Manager

Beach Set Manager is a live multi-user operational PWA for shared beach and Aquapark work. It is built with React 18, Vite and TypeScript, deployed through Vercel, and backed by Supabase/Postgres, Supabase Auth and Realtime.

Petalon is the current Production frontend location. It contains real operational data and must not be used for casual or destructive testing. Koversada's additive database foundation exists, while its Step 10 frontend remains in Draft PR #28 and is not deployed to Production.

## Operational areas

The Petalon application currently covers:

- 56 numbered beach Sets;
- 4 Extra Beds;
- beach reservations and saved surnames;
- non-numbered Sunbed sales;
- Aquapark tickets, timing and wristbands;
- current transactions and deleted-transaction audit state;
- Daily Reports and Report Archive;
- Daily Reset, backup/recovery and role-aware Settings.

## Authentication and access

Users sign in through Supabase Auth. Production-main currently uses email/password login.

Canonical Petalon roles are:

- Vuk — `PLATFORM_OWNER` / Platform Admin;
- Mark — `LOCATION_ADMIN` / Location Owner;
- Vito — `WORKER` / Worker.

Authorization comes from the authenticated user's active `location_memberships` row and Postgres Row Level Security. Email, display name, user metadata and hidden frontend controls are not authorization boundaries.

Only a Supabase publishable key belongs in the browser. Never expose a service-role/secret key, Auth password, database password or privileged token.

## Shared state and reliability

Supabase is authoritative for server-confirmed operational state. The current Production write model stores one versioned `location_state` JSONB row per location and uses expected-revision compare-and-swap writes. Realtime events are location-filtered invalidation hints; clients reload the authoritative row before presenting new shared state.

Production Reliability R1 and R2 provide user/location-scoped recovery, localStorage plus IndexedDB durability, bounded persistence, explicit mutation admission, retry behavior, emergency recovery export, fail-closed unsafe-write protection, immutable server revision history and privacy-safe client pipeline telemetry.

Browser storage is a recovery layer, not the authoritative database. Clearing site data can remove the local Auth session, PWA cache and device-only pending recovery records, but it does not delete server-confirmed Supabase state.

R2 is containment, not the final concurrency architecture. The Second Incident proved that unrelated operations can collide on the current whole-location revision. Reliability R3/conflict correctness is the immediate engineering direction.

## Local development

Install dependencies:

```powershell
npm install
```

Copy `.env.example` to an ignored local environment file and provide:

```text
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
```

Use the appropriate non-secret public values for the intended environment. Do not commit populated environment files.

Start Vite:

```powershell
npm run dev
```

The development server binds to `127.0.0.1`; use the URL printed by Vite.

## Verification

```powershell
npm test
npm run build
git diff --check
```

The production build is written to `dist/`.

## Deployment

The Vercel project uses:

- Framework preset: Vite
- Install command: `npm install`
- Build command: `npm run build`
- Output directory: `dist`

Both public Supabase environment variables are required. A Preview deployment connected to the live Beach Set Manager backend is Production-capable and must be treated with the same operational-data caution as Production.

See [DEPLOYMENT.md](DEPLOYMENT.md) for the complete deployment and database-safety checklist.

## Project guidance

Coding agents should begin with [AGENTS.md](AGENTS.md). Project architecture, decisions, reliability evidence and current priorities live in [Second_Brain/00_HOME.md](Second_Brain/00_HOME.md).

For the installed iPhone PWA, open the deployed URL in Safari and use **Share → Add to Home Screen**. Repeated close/reopen, background/foreground and lock/unlock are supported operational lifecycle requirements and must be included in reliability testing.
