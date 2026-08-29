# Risk Register

Status: `canonical`
Last reviewed: 2026-08-29

## Critical — silent operational data loss

**Evidence:** First Incident, 2026-08-27. Roughly twenty visible iPhone PWA entries never reached Supabase during a real round.

Required mitigation before broader/commercial production:

- explicit mutation admission;
- bounded local durability operations;
- fail-closed operational UI when durability is unsafe;
- independent recovery path(s);
- privacy-safe client pipeline telemetry;
- immutable server history;
- realistic affected-device lifecycle and concurrent-worker release testing;
- progression toward immutable operation IDs and idempotent server commands.

Reference: [[18_Production_Incidents_and_Never_Again_Rules]].

## Critical — proven disjoint-resource whole-location contention

**Evidence:** Second Incident, 2026-08-28, and Third Incident, 2026-08-29.

The Second Incident proved that unrelated Aquapark and numbered-Set operations can collide solely because they share one whole-location CAS revision.

The Third Incident proved that a first narrow R2.1 fix was not sufficient: a normal remote Set workflow advanced two revisions before the unrelated local Aquapark request returned, so the exact-one-revision reconciliation gate never ran.

Required mitigation:

- immediate bounded bridge: strict semantic disjoint-operation reconciliation with safe multi-revision history proof where needed;
- remove semantically meaningless source writes that create unnecessary revisions;
- retain explicit fail-closed behavior for genuine same-resource/unsupported/ambiguous cases;
- move toward immutable business-operation IDs and idempotent server commands;
- progressively narrow concurrency to the relevant resource/entity;
- test concurrent different-domain operations on real devices.

## Critical — single-revision assumptions can invalidate conflict recovery

**Evidence:** Third Incident, 2026-08-29.

PR #31 only attempted known-CAS reconciliation when `currentRevision === expectedRevision + 1`.

The real conflict was 521 → 523, caused by an updatedAt-only Set revision followed by the real Set status change.

A concurrency correction that works only when one remote revision wins is not sufficient for normal production. Remote devices may legitimately perform several accepted operations while another request is in flight.

Required mitigation:

- test 2+ remote revisions before the loser returns;
- do not infer multi-revision safety from final BASE→CURRENT alone;
- use immutable intermediate history or a stronger operation model to rule out hidden third values/add-remove/reset-restore behavior;
- bound proof complexity and fail closed when proof is absent;
- do not call a patch field-validated until representative real-device multi-revision races pass.

## Critical — conflict detection can cause whole-app operational lockout

**Evidence:** Second and Third Incidents.

R2/R2.1 safely preserved the losing operation and rejected unsafe overwrite, but the conflict state replaced the entire Petalon operational UI.

`Check shared data again` reloads state; it does not retire or reconcile the preserved mutation.

Draft PR #32 adds a scoped deliberate discard/use-current action, but that path remains a release gate until the already-conflicted iPhone proves upgrade-in-place recovery after deployment.

Required mitigation:

- explicit safe conflict-resolution choices;
- worker-readable explanation of what is preserved and what conflicts;
- safe reapply/rebase only when independently proven compatible;
- deliberate scoped discard/cancel path where product rules allow it;
- authoritative load/validation before destructive local discard;
- removal of only the exact user+location pending record;
- recovery/resume behavior that does not silently lose evidence;
- no expectation that workers interpret raw JSON.

## High — snapshot-proof bridge remains intentionally incomplete

PR #32 does not remove whole-AppData CAS.

It intentionally fails closed for >10 revision gaps, missing/non-contiguous history, hidden intermediate third states, unsupported compound deltas, same-resource conflicts, ambiguity and a second post-rebase conflict.

This is acceptable as a temporary conservative bridge but not as the final commercial concurrency architecture. R3 remains required.

## High — false safety reactions to legitimate Realtime

Incoming authoritative updates must not be classified as unsent local mutations. A normal remote save must not lock another worker or cause false STOP behavior. Interleaved local work must still be preserved and admitted safely.

## High — cross-location data exposure

RLS membership remains the security boundary. Vito must not see Koversada; Koversada workers must not see Petalon. Vuk/Mark can access both according to active memberships.

## High — ambiguous/retried financial operations

A lost response must not duplicate a payment/transaction on retry. Future operation IDs must be unique/idempotent and financial corrections should use explicit reversal/void records rather than hard deletion.

## High — browser/PWA lifecycle failure

Frequent Home Screen PWA close/reopen, background/foreground and phone lock/unlock are normal work. Any architecture relying on one long-lived browser handle/session must be tested against this lifecycle.

## High — development/production mixing

Preview/fault-injection paths must never be enabled accidentally in Production. KNO remains unrelated and must never be linked/touched.

## High — privileged credential exposure

No browser service-role key, database password or Auth-admin secret. Privileged actions require narrow server/RPC boundaries with RLS/membership validation.

The R2.1 revision-chain verifier is deliberately boolean-only. Authenticated callers may execute only the public membership-checked proof RPC; private history/helpers remain inaccessible.

## Medium — backup/recovery limits

Server revision history and future operation history protect accepted data. Database backup/PITR should be evaluated before commercial rollout. Neither can recover a mutation that never reached durable device/server storage.

## Medium — large App.tsx/App.css regression surface

The monolithic UI increases the chance that reliability, Realtime and local UI-state behavior become coupled. Refactor only where evidence justifies it, but reliability boundaries should increasingly live in dedicated tested services.

Every critical/high risk must have a tested mitigation before commercial production.
