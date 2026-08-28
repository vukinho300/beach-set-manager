# Open Questions and Clarifications

Status: `canonical`
Last reviewed: 2026-08-28

## Settled current facts

These are no longer open questions:

- Beach Set Manager has a live Supabase/Postgres backend and Vercel Production frontend.
- Petalon is location `00000000-0000-4000-8000-000000000001` and contains real shared operational data.
- Supabase Auth plus active `location_memberships` RLS is the access/revocation boundary.
- Canonical Petalon roles are Vuk=`PLATFORM_OWNER`, Mark=`LOCATION_ADMIN`, Vito=`WORKER`.
- Production Reliability R1 and R2 are implemented; durable pending writes and fail-closed safety are required.
- Koversada is the real second location. Its additive database foundation and memberships exist remotely.
- Draft PR #28 contains the Step 10 frontend, but that frontend is not Production and rollout is paused behind the Second Incident reliability gate.
- The Second Incident proves whole-location CAS creates false contention between unrelated operations.
- Reliability R3/conflict correctness is the immediate engineering direction.
- Initial Vuk/Vito/Mark account creation and Petalon role provisioning are complete.
- Device/session-count enforcement is not currently required.
- Payment/fiscal integration remains deferred.

## Immediate reliability boundary

1. Is a narrow R2.1 conflict-recovery/resume correction needed before the first R3 domain cutover?
2. What exact behavior may safely auto-reconcile a proven disjoint-resource conflict without normalizing blind whole-state rebasing?
3. What worker-visible actions should resolve, deliberately discard or reapply one preserved operation while retaining evidence and restoring unrelated operational access?
4. Which acceptance gate must pass before Step 10 frontend rollout resumes?

## R3 cutover sequence

1. Which domain should move first to immutable `operation_id` commands and a durable outbox: Sets/Extra Beds, non-numbered Sunbeds, Aquapark or reservations?
2. What temporary compatibility boundary keeps whole-AppData readers/reports correct while individual domains move to server commands?
3. When should financial transactions move to an immutable/voidable ledger, and how will existing deleted-transaction semantics migrate?
4. What per-resource/version rules are required for genuine same-resource conflicts?
5. What evidence and rollback strategy are required before each domain cutover reaches Production?

## Environment isolation

1. When should a separate Beach Set Manager Development Supabase project be created?
2. What non-production seed data and Auth identities are sufficient for realistic Preview testing without copying Production data?
3. How should migrations be promoted and verified between Development and Production?
4. Which Vercel environments currently point to the live backend, and how will that coupling be removed safely?

## Backup, PITR and restore

1. Which Supabase plan/backup/PITR capability is required before commercial rollout or the next active season?
2. What is the verified external backup format and retention policy?
3. How often must a restore drill be performed, and what acceptance checks prove restored Auth, memberships, state, history and future operation records are usable?

## Koversada multi-worker operation

1. What trusted provisioning/admin process will create and revoke independent Koversada Worker accounts next season?
2. How many concurrent Koversada worker devices must be field-tested before broader use?
3. Which R3 domain cutovers are mandatory before multiple Koversada workers operate concurrently?

## Commercial ownership and branding

1. What long-term product name/domain will be used?
2. What repository, Vercel, Supabase, billing and support ownership model is required before external customers?
3. How much white-labeling/configuration is actually needed without creating per-customer code forks?

## Business-day scheduling

1. When should Europe/Zagreb business-day/reset logic become server-owned?
2. Should reset/archive transitions be scheduled automatically, explicitly confirmed by an authorized user, or use a hybrid model?
3. How will retries and missed schedules remain idempotent after R3?
