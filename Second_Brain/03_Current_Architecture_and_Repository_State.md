# Current Architecture and Repository State

Status: `canonical`
Repository reviewed: 2026-08-28
Main checkpoint inspected: `8f7f332e51e402dbdcba4bc63d029f5ff6c4c042`

## Application

Beach Set Manager is a React 18 + Vite + TypeScript PWA deployed through Vercel.

The frontend remains relatively monolithic in `src/App.tsx`, while Supabase/Auth/shared-state/recovery concerns have progressively moved into dedicated services.

## Authoritative backend

Beach Set Manager uses a dedicated Supabase/Postgres project.

Petalon is represented as location:

`00000000-0000-4000-8000-000000000001`

Authoritative operational state currently remains one versioned `public.location_state` JSONB row per location:

- `location_id`;
- `state`;
- `revision`;
- `updated_at`;
- `updated_by`.

Writes use expected-revision compare-and-swap protection.

Supabase is authoritative for server-confirmed state.

## Authentication and membership

Supabase Auth is active.

Canonical Petalon memberships:

- Vuk — `PLATFORM_OWNER`;
- Mark — `LOCATION_ADMIN`;
- Vito — `WORKER`.

`location_memberships` + RLS are the access/revocation boundary.

Frontend role presentation is not the database security boundary.

## Current reliability architecture

Production Reliability R1 provides:

- background authoritative convergence;
- UI continuity;
- user/location-scoped pending recovery;
- retry/resume behavior;
- conservative conflict handling.

Production Reliability R2 is merged and running.

R2 adds:

- explicit visible-mutation admission;
- bounded device-durability operations;
- localStorage + IndexedDB resilience;
- fail-closed unsafe-write behavior;
- emergency preserved-state export;
- client write-stage telemetry;
- authoritative-Realtime versus local-divergence classification.

Private immutable `location_state_history` records accepted revisions for forensic reconstruction.

Private client sync telemetry records pipeline stages without storing operational/customer payloads.

## Proven current limitation

The Second Incident on 2026-08-28 proves the whole-location CAS boundary is too coarse for normal concurrent operation.

Vuk's unrelated Aquapark change and Vito's Set 13 payment both began from revision 443.

Vuk's write became revision 444.

Vito's Set 13 whole-location save then returned conflict even though revision 443 → 444 changed no Set, Bed or financial transaction.

The current model therefore protects against stale overwrite but can manufacture false contention between independent resources.

This is the immediate Reliability R3 driver.

## Current transaction/report model

`AppData` includes:

- 56 numbered Sets;
- 4 Extra Beds;
- beach reservations;
- saved surnames;
- non-numbered Sunbed sales;
- Aquapark entries;
- current transaction ledger;
- Report Archive;
- automatic reset date.

Transactions support active/deleted state.

Reports derive revenue from transaction data.

## Step 10 / Koversada status

Draft PR #28 implements the multi-location frontend architecture but remains unmerged.

The reviewed additive database foundation has been provisioned remotely.

Koversada exists as:

`00000000-0000-4000-8000-000000000002`

with Aquapark-only profile and separate memberships/state.

Production frontend code remains current main/R2, not PR #28.

Do not treat Step 10 frontend behavior as Production until PR #28 or its successor is reviewed, merged and deployed.

## Architecture direction

The whole-AppData JSONB row remains an MVP bridge.

Reliability R3 should move real business actions toward:

- immutable client operation IDs;
- durable operation outbox;
- authenticated idempotent server commands;
- append-only accepted-operation history;
- immutable/voidable financial ledger;
- narrower entity/resource concurrency boundaries.

KNO remains unrelated and untouched.
