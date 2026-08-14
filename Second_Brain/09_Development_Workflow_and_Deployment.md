# Development Workflow and Deployment

Status: `draft`

Development and production must use separate data environments. Preview deployments must not use production data. Database schema changes should be captured as repository migrations. Update the current local-only README and deployment documentation when the shared backend is actually introduced.

## Domain workflow

A custom domain is not required for backend/shared-app development.

During development:

- use local URLs and Vercel Preview / `vercel.app` URLs;
- keep Development Supabase separate from future Production Supabase;
- do not buy a Supabase custom API domain.

During Production Preparation / Petalon Commercial Pilot:

1. finalize the long-term product brand;
2. purchase the product domain;
3. add the production frontend domain/subdomain to the Vercel project;
4. create the DNS records requested by Vercel at the registrar/DNS provider;
5. verify HTTPS/TLS and production routing;
6. confirm Preview deployments still use development data only;
7. keep the standard Supabase project URL unless a later integration creates a real need for `api.<product-domain>`.

See [[17_Domain_and_Production_Branding]].
