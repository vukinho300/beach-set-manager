# Project Status and Next Actions

Status: `canonical`

## Current state

The repository is still a local-only React/Vite/TypeScript PWA using browser localStorage. The current product workflows, transaction ledger, reports, reservations, Sunbeds and Aquapark are implemented, but shared persistence, authentication, RLS, realtime and licensing are not.

## Immediate next action

Do not change application code yet. Finish the Phase 0 architecture contract, resolve the open questions, then create the development backend environment.

## First implementation milestone

**Secure Shared Petalon:** Vuk and Vito authenticate, load the same Petalon records, make shared Beach/Bed updates, see changes in realtime, and retain the same state after refresh.

## After that

Migrate the remaining domains, harden transaction ownership, add production environment separation, then licensing/admin controls. Offline mutation sync comes after the online shared path is proven. Payment integrations remain later work.
