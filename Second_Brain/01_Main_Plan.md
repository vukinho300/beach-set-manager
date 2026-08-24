# Main Plan

Status: `canonical`

## Goal

Turn the existing Petalon local PWA into a secure shared application used by Vuk, Vito and Mark.

Immediate target direction:

`React/Vite PWA → Supabase Auth → RLS-protected shared state → multi-user Petalon`

The first success criterion is not a full SaaS platform. It is that the three approved users can sign in to the same deployed app, see the same Petalon data, make accepted updates, and lose access when their membership is disabled.

## Immediate phases

1. Add the minimal Supabase application foundation without changing current user-facing behavior.
2. Create a dedicated Beach Set Manager Supabase project and apply a small RLS-protected schema.
3. Create Vuk, Vito and Mark accounts plus active Petalon memberships.
4. Move the existing operational app state from browser-only `localStorage` to one shared versioned Petalon state record, retaining a controlled local fallback/import path during migration.
5. Add authenticated loading, shared writes, conflict detection and realtime/invalidation behavior.
6. Verify RLS and revocation from three real accounts/devices.
7. Only after Shared Petalon v1 is stable, add differentiated user experiences/permissions where useful.

## Deliberately deferred

The following are not prerequisites for Shared Petalon v1:

- concurrent-device/session-seat limits;
- permanent device fingerprinting;
- offline mutation queues;
- seasonal licensing enforcement;
- white-label configuration;
- hiding all infrastructure/ownership traces;
- automatic production of deployments for additional locations;
- payment/fiscal integrations.

When a second real location is needed, design a repeatable provisioning/deployment pipeline then, based on what the proven Petalon deployment actually requires.

## Build principle

Prefer the smallest architecture that gives secure shared state and a clean future migration path. Do not perform a giant rewrite of `App.tsx` merely to satisfy an abstract architecture plan.

## Security principle

The browser code is public to anyone who can load it. Security must come from Supabase Auth, database grants, RLS, active membership checks and server/database constraints — never from hidden UI, obscured JavaScript or a secret embedded in the frontend.
