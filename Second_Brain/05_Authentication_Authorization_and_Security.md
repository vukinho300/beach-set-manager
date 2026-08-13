# Authentication, Authorization and Security

Status: `prototype_decision`

## Direction

Use Supabase Auth plus Postgres Row Level Security for the first shared-platform implementation.

## Roles

Initial roles:

- PLATFORM_OWNER — Vuk, platform-wide administration only through private/admin paths.
- LOCATION_ADMIN — customer/boss management for assigned location(s).
- WORKER — daily operational work.

## Membership model

A user may access a location only through an active `location_membership` row. Role is location-scoped except PLATFORM_OWNER.

## RLS rules

RLS must be enabled on every exposed tenant-facing table. Policies should enforce location membership and role-based operation permissions.

Do not rely on hidden buttons or frontend route guards as security.

## Privileged keys

Supabase secret/service-role credentials must never be shipped to the browser. Privileged platform-owner actions belong in trusted server-side functions/admin tooling.

## Immediate revocation

Do not rely only on JWT claims for states that may need immediate revocation, such as location suspension, membership disablement or expired license. Authoritative database state must be checked for protected mutations.

## Security before first paying customer

- automated RLS isolation tests;
- separate development and production projects;
- database constraints on exclusive resources;
- audit log for destructive/financial/admin actions;
- MFA for PLATFORM_OWNER, strongly recommended for LOCATION_ADMIN;
- backup + restore test;
- no production secrets in Git or frontend bundles;
- input validation both client and server side;
- explicit handling of stale/offline mutations.
