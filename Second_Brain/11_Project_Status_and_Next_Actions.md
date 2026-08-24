# Project Status and Next Actions

Status: `canonical`

## Current state

The repository is still a local-only React/Vite/TypeScript PWA using browser `localStorage`. Shared persistence, Beach Set Manager Supabase Auth, RLS and multi-user state are not implemented yet.

The connected Supabase account currently contains an unrelated `KNO` project; no dedicated Beach Set Manager project exists yet.

## Immediate milestone

**Shared Petalon v1** — Vuk, Vito and Mark can sign in, load the same Petalon state, make shared updates, see accepted changes, retain shared state after refresh, and be denied Petalon data when membership is inactive.

## Immediate next action

Codex should add the minimal Supabase client/repository foundation to the application without switching live persistence yet:

- pinned `@supabase/supabase-js` dependency;
- environment contract using URL + publishable key only;
- lazy/controlled browser client initialization;
- typed boundary for loading/saving versioned shared `AppData`;
- no service-role key;
- no UI/auth behavior change yet;
- no Second Brain edits.

After that foundation is reviewed, create the dedicated Supabase project, create the minimal schema/migration with RLS, then provision Vuk/Vito/Mark and connect the app.

## Deferred

Do not block Shared Petalon v1 on device/session limits, offline writes, licensing, multi-location provisioning, white-labeling, infrastructure concealment or payment integrations.
