# Project Status and Next Actions

Status: `canonical`

## Current state

**Shared Petalon v1 is VERIFIED. Production Reliability R1 / PR #17 is independently reviewed and pending merge.**

Steps 1–8 remain the verified foundation: browser Auth/session, RLS membership boundary, authoritative Supabase `location_state`, revision-safe conditional writes, realtime invalidation, account isolation, anonymous denial, worker privilege restrictions and live membership revocation/restoration.

## Production evidence after Step 8

Real phone use at Petalon exposed two issues that verification had not reproduced under the earlier workflow:

1. Realtime/reconnect refreshes were technically safe but operationally disruptive: the app displayed the blocking shared-data loader, remounted `OperationalApp`, reset tabs/scroll and forced workers to find their physical place on the beach again.
2. Retryable network/save failures could leave a worker-entered Beach/Aquapark change only in volatile React memory. Reload/reopen could discard that only copy before Supabase accepted it. Vuk and Vito both observed disappearing operational entries.

These findings are production blockers because set/wristband numbers can be forgotten immediately after the worker moves on.

## Production Reliability R1 — independently reviewed, PR #17 pending merge

PR #17 head `70fc0657a68a63b5a2aa46f79ffa370d52327893`:

- distinguishes initial/blocking load from background authoritative refresh;
- background realtime/reconnect refresh keeps the operational app mounted and updates shared AppData in place;
- removes generation-key remounting for normal remote convergence;
- exact authoritative echoes are suppressed from the local-save path, while any interleaved worker mutation is forwarded normally;
- active tab and per-tab scroll positions persist in UI-only `beach-set-manager:ui-continuity:v1` localStorage;
- Safari/page teardown protection prevents a final zero scroll reading from replacing the last real visible position;
- cold reopen restores tab/scroll after safe authoritative startup;
- unconfirmed shared AppData is durably persisted in IndexedDB as a recovery buffer scoped by authenticated user + location;
- pending records retain base revision/state, desired state, timestamps and save-attempt metadata;
- retryable failures keep optimistic changes visible and marked pending rather than forcing a destructive unavailable screen;
- retries use bounded backoff and resume on `online`, focus and visibility/resume events;
- accepted/ambiguous network responses can be recognized without duplicate submission when the server proves the exact attempted state is present;
- incompatible/newer server state preserves local pending work as conflict; no force overwrite or broad last-write-wins merge;
- narrow compatible Beach-set rebase is allowed only for **unattempted** pending records where non-set fields are unchanged and every changed set is provably compatible;
- attempted-save metadata blocks that rebase unless the server explicitly proves the attempted snapshot was accepted, preventing stale recovery records from resurrecting later legitimate Beach state;
- account switch/sign-out cannot expose or submit another user's pending recovery state;
- RLS revocation remains authoritative and IndexedDB never authorizes access.

Independent review found two R1 defects before approval and both were corrected on the same PR:

- blind `suppressNextEmission` could swallow a local mutation interleaved with a remote snapshot; replaced with exact-snapshot structural suppression;
- a stale attempted pending Beach snapshot could fall through to compatible reconciliation and resurrect old state; attempted metadata now creates a conservative ambiguity barrier.

Reported verification after correction:

- 75/75 tests pass across 8 files;
- `npm run build` passes;
- `git diff --check` passes;
- phone background convergence passed without loading flash/remount/tab reset/scroll jump;
- cold reopen tab/scroll restoration passed;
- temporary network failure recovery passed;
- failure plus close/reopen recovery passed.

No schema/migration/Vercel/role/credential changes. KNO remains untouched.

## Immediate milestone

**Merge and deploy R1, then validate it under normal Petalon use.**

The immediate operational goal is no longer merely “the phone can connect”; it is that the phone workflow remains smooth and submitted operational work is never silently lost during ordinary mobile-network instability.

## Immediate next action

1. Merge PR #17 after final human review.
2. Merge the corresponding Second Brain documentation PR.
3. Deploy current merged `main` to Vercel Production.
4. Use the production phone app during normal Petalon work and specifically watch for:
   - any loading-screen flash during background convergence;
   - any tab/scroll reset;
   - pending status that never recovers;
   - duplicate Aquapark/transaction recovery;
   - preserved-conflict states that are hard to resolve;
   - any submitted number disappearing after network loss/reopen.
5. If the reliability layer remains stable in real use, proceed to owner/worker role/UI decisions.

## Deferred / later

- Full immutable offline command/outbox + server operation-id idempotency is still a later architecture if R1's whole-AppData pending snapshot proves insufficient.
- Do not add role-specific UI before the R1 merge/deploy is stable enough for normal operation.
- Device/session limits, licensing, multi-location provisioning, white-labeling, infrastructure concealment and payment integrations remain deferred.
