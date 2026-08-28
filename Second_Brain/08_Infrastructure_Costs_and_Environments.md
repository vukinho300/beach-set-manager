# Infrastructure, Costs and Environments

Status: `canonical research snapshot`
Last project-state review: 2026-08-28
Pricing snapshot reviewed: 2026-08-14

## Current environment reality

Beach Set Manager is no longer a local-only prototype.

Current verified project state:

- one GitHub repository and one Vercel application;
- Production frontend deployed from `main`;
- one live Beach Set Manager Supabase/Postgres project: `uonovdnxfjqfjkhopxwg`;
- live Petalon Auth, active membership RLS, authoritative shared state and Realtime;
- Production Reliability R1/R2, private immutable revision history and private client sync telemetry;
- additive Koversada database foundation, location state and memberships provisioned remotely;
- Draft PR #28 contains the unmerged Step 10 frontend, whose rollout remains behind the Second Incident reliability gate.

KNO project `asrrkwyqerfkynhjypov` is unrelated and must never be touched or reused.

A separate Beach Set Manager Development Supabase project is not currently proven to exist. Local development and Vercel Previews may therefore be configured against the live backend. Any Preview using live credentials is Production-capable and must be handled with Production operational-data precautions.

## Desired future environment topology

The safer target is:

- Development: local/Vercel Preview frontend plus a separate Development Supabase project containing non-production seed data;
- Production: `main` Vercel deployment plus the live Beach Set Manager Supabase project.

Under that target:

- Preview deployments do not use Production data;
- migrations are exercised against Development first and promoted through reviewed repository files;
- destructive/fault-injection tests use non-production data;
- provider links and environment variables clearly identify their environment.

This section describes a desired future topology, not an implemented current separation.

## Current cost objective

Keep infrastructure cost as low as practical without treating price as more important than operational reliability, backups or restore capability.

Current low-cost components include:

- local development;
- the existing GitHub repository;
- Vercel Hobby while use remains eligible under its terms;
- Supabase Free while its reliability, pause and backup characteristics remain acceptable;
- local Supabase for migration/schema development where practical;
- deferred custom product/API domains until branding or integration creates a concrete need.

## Supabase Free pricing snapshot

The 2026-08-14 research snapshot recorded public limits including:

- 500 MB database;
- 5 GB egress;
- 50,000 MAU;
- 2 million Realtime messages/month;
- 200 peak Realtime connections;
- 500,000 Edge Function invocations;
- 2 active Free projects;
- inactive Free projects may pause after about one week of low activity;
- automatic backups are not included on Free.

Raw capacity is likely sufficient for the current small user count, but capacity alone does not establish Production suitability. Active-season availability, backup/PITR and tested restoration matter independently of traffic volume.

Re-check current provider limits and prices before relying on this snapshot.

## Supabase upgrade triggers

Evaluate Pro or another appropriate plan when any of these becomes true:

1. automatic pausing is unacceptable during the active season;
2. managed backups/PITR and support are required for operational risk;
3. a paying/commercial customer is onboarded;
4. a quota approaches a meaningful threshold;
5. a required Production-only feature appears.

The 2026-08-14 snapshot recorded Pro entry pricing around $25/month with seven-day daily backups. Verify current pricing and retention before a commercial or seasonal decision.

## Vercel

The 2026-08-14 snapshot recorded Hobby at $0 for eligible personal/non-commercial use and Pro around $20/month for professional/commercial use.

Re-evaluate the plan when customer-facing use becomes commercial or current plan terms/features no longer fit. Traffic volume is not the only trigger.

## Domain cost

A custom domain is not required for shared-backend development. Purchase one during Production Preparation / Petalon Commercial Pilot after the product brand is finalized, unless Vuk chooses earlier reservation.

Prefer independent registrar/DNS ownership where supported. A paid Supabase custom API domain is not part of the default budget and should be added only for a concrete product or integration need. See [[17_Domain_and_Production_Branding]].

## Usage and reliability monitoring

Provider metrics:

- database size;
- egress;
- Realtime messages and peak connections;
- MAUs;
- Edge Function invocations;
- frontend hosting/compute usage;
- backup/PITR status and restore evidence.

Application metrics later:

- active users/location/day;
- peak active sessions;
- transactions/day;
- reservations/day;
- Aquapark entries/day;
- mutation/operation count/day;
- conflict and recovery rates.

This supports real cost-per-location and reliability decisions rather than guesses.

## Winter strategy

If locations remain active, keep the shared Production stack and suspend only expired location licenses when licensing exists.

If every customer is inactive:

1. end/suspend licenses when implemented;
2. generate season reports;
3. export verified database backups;
4. perform a restore drill;
5. evaluate plan downgrade/pausing only after recovery is proven;
6. adjust commercial hosting if appropriate;
7. before the next season, restore/resume, apply migrations, test real workflows and activate required plans/licenses.

An external verified backup remains mandatory when relying on any provider pause/retention behavior.

## Research rule

Re-check provider pricing, quotas, backup retention, registrar renewal prices and hosting terms before every commercial season because they can change.
