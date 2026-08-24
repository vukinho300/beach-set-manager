# Domain and Production Branding

Status: `canonical research snapshot`
Reviewed: 2026-08-24

## Current decision

A custom domain, full white-labeling and ownership/infrastructure concealment are **not blockers for Shared Petalon v1**.

Continue backend/shared-app development without delaying it for branding work.

Vuk still considers it important that a future customer-facing production version not expose obvious links back to his personal GitHub/Vercel/developer identity. That work is deferred until the shared application is proven, then must be revisited before broader external/commercial rollout.

## What later ownership-separation work should examine

When production hardening begins, review at least:

- neutral product domain and customer-facing branding;
- whether production hosting should live in a dedicated organization/account rather than a personal developer context;
- whether production Supabase should live in an appropriately separated organization/project structure;
- repository visibility and whether any customer-visible build/deployment metadata exposes repository/account identifiers;
- customer-facing error pages, URLs, emails and OAuth/redirect surfaces;
- removal of developer/provider references from the UI and public metadata.

The goal is to reduce obvious attribution and operational coupling. It is not realistic to promise that a public web application can have literally no technical trace to its operators/providers.

## Security distinction

Ownership concealment is not the access-control mechanism. A copied frontend must still be blocked by Auth + RLS + active membership. No service-role or other privileged secret belongs in the browser.

## Domain timing

The final product domain should normally be purchased during production preparation, after Shared Petalon is validated and before the first broader customer-facing deployment.

If Vuk settles on the final brand earlier and wants to reserve the domain, that is a business/brand-protection choice rather than a backend requirement.

Preferred registrar/DNS direction remains independent ownership (for example Cloudflare Registrar/DNS where supported) with the frontend connected to Vercel or a later chosen host.

## Supabase API domain

A paid Supabase custom API domain is not required for Shared Petalon v1. Use the standard project URL unless a later public integration or branding requirement creates concrete value.

## Future multi-location deployment

Do not build a speculative deployment factory now. When a second location is ready, design a repeatable provisioning/deployment pipeline based on the actual Petalon production process and decide then whether locations share one frontend deployment or need separate branded deployments.

## Re-check at production launch

Provider pricing, plan rules, registrar choices, account-organization strategy and production privacy requirements must be re-checked at the actual production-launch date.
