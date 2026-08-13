# Main Plan

Status: `canonical`

## Goal

Evolve the current Petalon local PWA into one configurable shared platform for seasonal beach, sunbed, bed and Aquapark operations.

Target direction:

`React/Vite PWA → authentication → shared Postgres database → realtime updates → worker/admin UI`

Later payment integrations should feed the same transaction model rather than redefine the application.

## Phases

1. Stabilize and document the current prototype.
2. Build Secure Shared Petalon for Vuk and Vito: authentication, location membership, RLS, shared persistence, realtime and concurrency protection.
3. Migrate transactions, reservations, sets, beds, sunbeds, Aquapark, reports and settings from operational localStorage to Postgres.
4. Add commercial platform controls: customer locations, seasonal access periods, account/session limits, feature entitlements and white-label configuration.
5. Add offline write support only after the online synchronization rules are proven.
6. Add Viva/NeoSalon/Marketino integrations later through provider adapters.

## Build principle

Do not replace every localStorage call with ad-hoc database calls inside React components. Introduce a service/repository boundary first.

## Product principle

Use one codebase and configuration-driven locations. Do not clone the repository or create a separate application per customer.
