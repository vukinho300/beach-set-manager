# Domain and Production Branding

Status: `canonical research snapshot`
Reviewed: 2026-08-14

## Decision

A custom domain is **not a blocker for the backend/shared-app phase**.

Continue development with the existing Vercel `vercel.app` deployment/Preview URLs and Supabase Free/local development. Purchase the product domain during **Production Preparation / Petalon Commercial Pilot**, immediately before the first customer-facing commercial production deployment, after Secure Shared Petalon and the main backend migration have been validated.

Exception: if Vuk settles on the final long-term product brand earlier and the preferred domain is available, buying it early is reasonable as brand protection. That is a business choice, not a technical requirement.

## Why this timing

The current backend work does not need a custom hostname. Buying a domain now would add cost without helping authentication, RLS, database design, realtime synchronization or offline experiments.

The domain becomes useful when the application is presented as a real commercial product because it provides a stable professional frontend URL and separates the customer-facing product identity from Vercel's generated deployment URL.

## Registrar strategy

Preferred registrar: **Cloudflare Registrar**, when the chosen TLD is supported.

Reasons:

- registration and renewal are sold at registry/ICANN cost without registrar markup;
- WHOIS redaction is included where the registry permits it;
- DNSSEC is available without an extra registrar fee;
- registrar/DNS ownership stays independent from Vercel hosting, reducing hosting lock-in.

Keep domain registration and DNS ownership separate from the frontend hosting provider. Vercel's registrar is an acceptable convenience fallback, but the default strategy is Cloudflare Registrar + Cloudflare DNS + Vercel hosting.

Do not choose the registrar only from a first-year promotional price. Compare renewal price, supported TLD, account security and transfer policy when the final domain is selected.

## Frontend domain with Vercel

Recommended production pattern after the final product brand exists:

- primary customer-facing application: `app.<product-domain>`;
- root domain `<product-domain>` can later host a landing page or redirect to the application;
- `www.<product-domain>` can redirect to the chosen canonical root/landing URL.

For the first Petalon commercial deployment, one neutral product domain is sufficient. Petalon remains a configured location inside the shared application; do not create a separate repository or backend just to give Petalon a URL.

Vercel setup:

1. purchase the domain at the registrar;
2. add the chosen domain/subdomain in Vercel Project → Settings → Domains;
3. inspect the DNS records Vercel requests;
4. create those A/CNAME/TXT records in Cloudflare DNS;
5. verify the domain in Vercel;
6. let Vercel provision TLS/SSL automatically;
7. test that the domain resolves only to the intended Production deployment.

Preview deployments should continue to use Preview URLs and must remain connected to Development Supabase, never Production.

## Supabase API domain

A Supabase custom API domain is **not needed for the first shared or commercial Petalon version**.

Use the normal Supabase project URL during development and initial production. The Supabase hostname is infrastructure-facing and does not need to match the frontend domain for ordinary browser use.

Supabase custom domains are currently a paid add-on available on paid plans and cost about **$10/month per project**. Do not enable one merely for cosmetic white-labeling.

Reconsider a custom Supabase domain only when it provides concrete value, for example:

- the API hostname becomes customer-visible;
- OAuth consent/redirect branding materially matters;
- third-party integrations or public webhooks should use a stable branded API hostname;
- QR codes or stored external links contain API URLs;
- API portability/versioning justifies decoupling public integrations from the underlying Supabase project URL.

If that milestone arrives, prefer a subdomain such as `api.<product-domain>`.

## Development cost rule

Until commercial production preparation:

- domain purchase: **defer**;
- Vercel: use existing free development/Preview setup while permitted for the project's non-commercial phase;
- Supabase: Free/local development;
- Supabase custom domain: **do not buy**;
- custom production email/domain services: defer unless independently required.

The first unavoidable domain cost should normally appear only when the product identity is finalized and Petalon is about to become the first commercial production location.

## Roadmap placement

Domain work belongs after the shared backend, RLS, realtime, complete operational-data migration and server-owned business-day/audit foundation are validated, and immediately before the Petalon customer-facing production pilot.

It is therefore **production-branding/deployment work, not backend-foundation work**.

## Sources reviewed

- Vercel custom-domain setup: https://vercel.com/docs/domains/set-up-custom-domain
- Vercel domain/project behavior: https://vercel.com/docs/domains/working-with-domains
- Supabase custom domains: https://supabase.com/docs/guides/platform/custom-domains
- Supabase custom-domain usage/pricing: https://supabase.com/docs/guides/platform/manage-your-usage/custom-domains
- Cloudflare Registrar: https://developers.cloudflare.com/registrar/

Re-check registrar prices, Vercel plan rules and Supabase custom-domain pricing at the actual production-launch date.