# Development Workflow and Deployment

Status: `draft`

Development and production must use separate data environments. Preview deployments must not use production data. Database schema changes should be captured as repository migrations. Update the current local-only README and deployment documentation when the shared backend is actually introduced.

## Terminal-first Codex workflow

Codex normally runs from the local repository checkout in the terminal. It may inspect files, run builds/tests, create a focused feature branch, commit, push and open a PR when the required local CLI authentication is already available.

Do not give Codex plaintext passwords or privileged access tokens in prompts. Authenticate external CLIs locally using their supported interactive login flows.

Preferred local access setup:

### Git/GitHub

- the repository is already available because Codex runs inside the local clone;
- GitHub authentication is needed only for remote actions such as fetch/push/PR work;
- verify with `git remote -v` and the locally installed GitHub/Git credential flow;
- if GitHub remote authentication is blocked, Vuk should perform the short login/approval step rather than having Codex retry indefinitely.

### Supabase

When a Beach Set Manager Supabase project exists and the current implementation step actually needs remote database access:

1. install/use the project-scoped Supabase CLI version selected for the repository;
2. Vuk performs `supabase login` / `npx supabase login` interactively;
3. link from the repository root with `supabase link --project-ref <project-ref>`;
4. verify the linked project before any destructive or remote schema command;
5. keep access tokens and database passwords out of prompts, committed files and the Second Brain.

Schema changes must remain represented as repository migrations even when Codex uses the linked remote project for verification.

### Vercel

Vercel CLI access is not required for the first Supabase-foundation step. When deployment configuration, preview verification or environment variables actually need Vercel access:

1. Vuk performs `vercel login` interactively;
2. run `vercel link` from the project root and select the existing Beach Set Manager Vercel project;
3. verify the link before Codex changes deployment configuration;
4. use `vercel env pull` only when local environment values are actually needed, writing them to ignored local env files;
5. never commit sensitive environment values.

## Human/manual handoff rule

Automation is not automatically better.

If a short manual action by Vuk is simpler, faster or more reliable than agent automation, ChatGPT/Codex should explicitly hand that action to Vuk. Typical examples include:

- browser login/authorization;
- approving an OAuth/CLI login;
- visually checking one or two screens/devices;
- entering a small amount of one-off test data;
- toggling one dashboard setting;
- confirming which account/project is selected;
- performing a destructive action that deserves direct human confirmation.

Codex must not burn time/tokens looping around external-tool blockers. After at most two sensible attempts at the same credential, CLI, browser or provider blocker, stop and report:

1. the exact blocker;
2. the exact manual action Vuk should perform;
3. the command/check Codex will run immediately afterward.

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
