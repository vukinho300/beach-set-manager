# Development Workflow and Deployment

Status: `canonical`
Last reviewed: 2026-08-28

Beach Set Manager is a live Supabase-backed PWA. Petalon contains real Production operational data. Repository work must start from verified current state and preserve both user work and Production evidence.

## Repository front door

Root `AGENTS.md` is the concise operating guide for coding agents. Before material work, read it, [[00_HOME]], [[11_Project_Status_and_Next_Actions]] and the relevant architecture/reliability notes.

The repository, running code, tests, migrations and verified database remain technical truth. The Second Brain records accepted architecture, decisions and project memory.

## Terminal-first Codex workflow

Codex normally works from the local repository checkout:

1. inspect `git status`, current branch and worktrees;
2. fetch and verify current `origin/main`;
3. preserve unrelated local changes;
4. use a clean focused worktree/branch when the existing checkout is dirty;
5. implement only the approved scope;
6. run relevant verification and inspect the full diff;
7. commit/push and open one Draft PR;
8. do not merge or deploy Production automatically.

Normal application verification:

```powershell
npm test
npm run build
git diff --check
```

Documentation-only work may omit tests/build when no executable/configuration file changed, but must still run `git diff --check` and inspect the complete diff.

## Git and GitHub

- Verify repository/remotes before remote actions.
- Use supported local Git/GitHub authentication.
- Keep commits focused and do not incorporate dirty user state.
- Prefer a Draft PR for independent review.
- If authentication is blocked, use the manual handoff rule rather than repeatedly retrying.

## Supabase

Beach Set Manager Supabase project:

`uonovdnxfjqfjkhopxwg`

KNO is unrelated and must never be touched:

`asrrkwyqerfkynhjypov`

Project refs are identifiers, not credentials.

For approved remote database work:

1. use the repository/project-scoped Supabase CLI version where practical;
2. authenticate through the supported local login flow;
3. verify the linked project ref before every remote command;
4. inspect local and remote migration history before applying anything;
5. inspect the exact SQL and target;
6. keep schema changes in reviewed timestamped repository migrations;
7. verify RLS, grants, functions, triggers, Realtime and application invariants afterward;
8. run security/performance advisors and classify every new warning.

Never mutate real Petalon AppData merely for testing convenience. Prefer read-only checks and rollback-only transactions. Never print or commit access tokens, Auth passwords, database passwords or service-role credentials.

## Vercel and current environment reality

The existing Vercel application deploys the Production frontend from `main` and creates Preview deployments for branches/PRs.

Required public browser variables are:

- `VITE_SUPABASE_URL`;
- `VITE_SUPABASE_PUBLISHABLE_KEY`.

A separate Development Supabase environment is not currently proven. A Preview configured with the live Beach Set Manager backend is Production-capable and must receive Production-level data precautions.

The desired future state is separate Development and Production data environments. Until that exists, do not describe Preview isolation as implemented merely because it is the preferred policy.

For Vercel work:

1. authenticate through the supported local flow when necessary;
2. verify the existing Vercel project/link and environment target;
3. pull environment values only into ignored local files when genuinely required;
4. never commit populated environment files;
5. verify the deployed commit/build and required PWA lifecycle after reliability-sensitive changes.

## Production and PWA release rules

- Treat Petalon as live operational data.
- Do not use Preview/Production for casual destructive testing.
- Verify Auth, membership loading, one safe authoritative write and Realtime convergence after an authorized deployment.
- Reliability releases require realistic installed-PWA close/reopen, background/foreground, lock/unlock and concurrent-device testing.
- Frontend rollback does not undo a database migration; prefer additive compatibility and deliberate forward fixes.
- Preserve incident evidence before corrective action.

## Human/manual handoff rule

Automation is not automatically better. If a short manual action by Vuk is simpler, faster or more reliable, request it directly.

After at most two sensible attempts at the same credential, CLI, browser or provider blocker, stop and report:

```text
BLOCKER:
<exact blocker>

VUK ACTION:
<one exact short manual action>

AFTERWARD I WILL:
<next command/check>
```

Typical human steps include provider/OAuth login, visual device testing, target confirmation and destructive-action approval.

## Credential rules

- Never put passwords, service-role keys, database passwords, personal access tokens or privileged provider credentials in prompts, committed files or the Second Brain.
- Use supported local authentication and ignored environment/credential storage.
- Only the publishable Supabase key belongs in browser configuration.
- Authorization comes from Auth plus active membership RLS, never from frontend identity maps or metadata.

## Domain workflow

The current `vercel.app` URL is sufficient for development and operational validation. A custom product domain remains a Production Preparation / commercial-branding task.

When approved:

1. finalize the long-term brand;
2. purchase the domain through an independently controlled registrar/DNS provider where practical;
3. connect the Production frontend domain to the existing Vercel project;
4. verify DNS, HTTPS/TLS and routing;
5. verify Preview/Production environment separation or clearly retain Production-capable Preview precautions;
6. keep the standard Supabase URL unless a branded API hostname has a concrete value.

See [[17_Domain_and_Production_Branding]].
