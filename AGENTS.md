# Beach Set Manager Agent Guide

## Project

Beach Set Manager is a live, Supabase-backed, multi-user operational PWA. Petalon contains real Production data used during beach operations. Treat repository and remote actions accordingly.

## Sources of truth

- Repository code, tests, migrations and verified database state are the technical truth.
- `Second_Brain/` is the architecture, product-decision and project-memory source.
- Vuk is the product owner and final decision authority.

## Required reading

Before material work, read:

1. this file;
2. `Second_Brain/00_HOME.md`;
3. `Second_Brain/11_Project_Status_and_Next_Actions.md`;
4. the relevant domain, security or reliability notes for the task.

For persistence, concurrency or recovery work, also read `Second_Brain/07_Offline_Sync_and_Conflict_Resolution.md` and `Second_Brain/18_Production_Incidents_and_Never_Again_Rules.md`.

## AI roles

- ChatGPT owns architecture review, Codex prompts and Second Brain maintenance.
- Codex implements scoped repository/application work and verifies it.
- Codex must not edit `Second_Brain/` unless Vuk explicitly grants a narrow exception for named files and that task.

## Production safety

- Never mutate Petalon Production data merely for convenience or testing.
- Prefer read-only checks and rollback-safe verification where practical.
- Verify the GitHub, Vercel and Supabase target before any remote action.
- Beach Set Manager Supabase project ref: `uonovdnxfjqfjkhopxwg`.
- KNO is unrelated. Never touch or reuse project ref `asrrkwyqerfkynhjypov`.
- Never expose or commit passwords, tokens, database credentials or service-role/secret keys.
- Never ship a service-role credential in browser code. Auth plus membership-enforced RLS is the data-access boundary.
- Preserve unrelated local changes. Use a clean worktree when the current checkout is dirty.

## Current reliability state

Production Reliability R2 remains the fail-closed containment layer.

R2.1 PR #31 is merged in Production main. It added a strict one-revision known-CAS reconciliation path, but it is **not** considered a successful field fix. The Third Incident on 2026-08-29 proved that its `currentRevision === expectedRevision + 1` assumption was too narrow for normal operation: one remote Set workflow advanced Petalon from revision 521 to 523 before Vuk's unrelated Aquapark save returned, so R2.1 never entered reconciliation and the full-screen conflict lockout returned.

Draft PR #32 is the reviewed corrective bridge. It adds source-level no-op suppression, bounded multi-revision proof using private immutable history, exhaustive two-controller concurrency tests, and an explicit scoped discard/use-current recovery action. Its additive Production verification RPC migration has been applied and independently verified, but the PR frontend is not yet merged/deployed and the preserved conflicted iPhone has not yet completed the real upgrade-in-place recovery test.

Do not describe Incident 3 as resolved or PR #32 as field-validated until that real device recovery and controlled concurrent-device validation pass.

R3 remains the long-term reliability direction: immutable operation IDs/outbox, idempotent server commands, append-only accepted-operation evidence and narrower resource/entity concurrency.

## Step 10

Draft PR #28 contains the Step 10/Koversada frontend. Its additive database foundation exists, but the frontend is not Production and rollout remains paused behind the current reliability gate. Do not mix Step 10 changes into unrelated reliability work.

## Workflow

1. Fetch and inspect the latest `origin/main`.
2. Preserve dirty user state; use a focused branch and clean worktree when needed.
3. Keep scope minimal and separate unrelated work.
4. Run the repository's relevant verification.
5. Inspect the complete diff.
6. Commit and push only approved work.
7. Open a Draft PR. Do not merge automatically.

Normal verification:

```powershell
npm test
npm run build
git diff --check
```

Documentation-only work may use `git diff --check` without running application tests/build when no executable or configuration file changed.

## Manual handoff

After at most two sensible attempts at the same external credential, browser, CLI or provider blocker, stop and use:

```text
BLOCKER:
<exact blocker>

VUK ACTION:
<one exact short manual action>

AFTERWARD I WILL:
<next command/check>
```

Do not loop around a human-only approval or credential flow.
