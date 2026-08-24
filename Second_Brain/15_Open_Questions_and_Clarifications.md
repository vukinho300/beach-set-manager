# Open Questions and Clarifications

Status: `canonical`

## Resolved immediate product scope

As of 2026-08-24:

1. Initial real users are Vuk, Vito and Mark.
2. Initial authentication is email/password.
3. All three initially use the same Petalon operational app; user differences come later.
4. Petalon is the only required shared location for v1.
5. RLS + active membership is the required access/revocation boundary.
6. Device/session-count enforcement is not required.
7. Offline operational/financial writes are not required for v1.
8. Multi-location production/provisioning automation is deferred until another location is actually needed.
9. Hiding ownership/provider/repository traces is deferred but remains important before broader customer-facing rollout.
10. ChatGPT maintains Second Brain; Codex writes application code.

## Operational information still required before account provisioning

The actual email addresses to use for the Vuk, Vito and Mark Supabase Auth accounts must be known when those accounts are created. Passwords should be created/set through an appropriate secure Auth flow and must never be written into the repository or Second Brain.

## Supabase project creation

A dedicated Beach Set Manager Supabase project does not yet exist in the connected account. Before ChatGPT creates it directly, the target Supabase organization must be explicitly confirmed because project creation is a billable/account-scoped action even when the selected plan/cost is free.

## Intentionally deferred technical choices

- exact future multi-location provisioning pipeline;
- exact white-label/ownership-separation topology;
- exact server scheduler for future midnight business-day rollover;
- whether the JSONB state model should later be normalized domain-by-domain.
