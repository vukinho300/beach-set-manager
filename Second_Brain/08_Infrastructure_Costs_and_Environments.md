# Infrastructure, Costs and Environments

Status: `canonical research snapshot`
Reviewed: 2026-08-13

## Development cost target

Current phase target: as close to €0/month as practical.

Recommended now:

- local development: free;
- GitHub: existing repository;
- Vercel Hobby: acceptable while the project remains personal/non-commercial development;
- Supabase Free: acceptable for development/shared prototype;
- local Supabase is an option for schema/migration work.

## Supabase Free snapshot

Current public limits include:

- 500 MB database;
- 5 GB egress;
- 50,000 MAU;
- 2 million Realtime messages/month;
- 200 peak Realtime connections;
- 500,000 Edge Function invocations;
- 2 active Free projects;
- inactive Free projects may pause after about one week of low activity;
- automatic backups are not included on Free.

These limits are far above the expected Vuk/Vito development load and likely above a few small beach locations by raw capacity. Free-tier capacity is therefore not the main reason to upgrade.

## Supabase upgrade trigger

Upgrade to Pro when at least one of these becomes true:

1. first paying production customer;
2. production reliability/backups/support justify it;
3. Free quota approaches a meaningful threshold;
4. automatic pausing is unacceptable for the active season;
5. required production-only feature appears.

Current Pro entry price is about $25/month and includes 7-day daily backups.

## Vercel

Hobby is $0 and intended for personal/non-commercial use. Pro is currently $20/month and is designed for professional/commercial work.

Upgrade trigger: when the deployed customer-facing app becomes commercial/paid, not when development traffic becomes large.

## Environments

Minimum before backend migration:

- Development: local/Vercel Preview + Development Supabase.
- Production: main deployment + Production Supabase only after the shared prototype is validated.

Preview builds must never point at the production database.

## Usage monitoring

Record both provider-level and location-level usage.

Provider metrics:

- database size;
- egress;
- Realtime messages;
- Realtime peak connections;
- MAUs;
- Edge Function invocations;
- frontend hosting/compute usage.

Application metrics later:

- active users/location/day;
- peak active sessions;
- transactions/day;
- reservations/day;
- Aquapark entries/day;
- mutation count/day.

This allows cost per active location to be measured from real seasonal usage instead of guessed.

## Winter strategy

If some locations remain active, keep the shared production stack and suspend only expired location licenses.

If every customer is inactive:

1. end/suspend licenses;
2. generate season reports;
3. export verified database backup(s);
4. test restore;
5. evaluate downgrading Supabase to Free so it can pause;
6. take commercial hosting off paid service if appropriate;
7. before next season, restore/resume, apply migrations, test, upgrade production tier and activate new license periods.

Supabase currently allows a paused Free project to be restored for up to one year, but an external backup remains mandatory.

## Research sources

Re-check provider pricing and terms before every commercial season because limits and prices can change.
