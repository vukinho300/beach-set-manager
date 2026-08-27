# Implementation Roadmap

Status: `prototype_decision`
Last reviewed: 2026-08-27

## Completed shared foundation

1. ✅ Step 1 — Supabase browser/client and shared-state repository foundation. PR #3.
2. ✅ Step 2 — Beach Set Manager Supabase project, locations/memberships/versioned `location_state`, RLS and revision-safe writes. PR #5.
3. ✅ Step 3 — real Auth identities, memberships, stale-write/revocation/privilege verification. PR #6.
4. ✅ Step 4 — typed shared-state adapter and conflict/unavailable classification. PR #8.
5. ✅ Step 5 — browser Auth/session UX. PR #10.
6. ✅ Step 6 — authoritative Supabase AppData, serialized/coalesced CAS writes and account isolation. PR #12.
7. ✅ Step 7 — filtered Realtime invalidation and lifecycle-safe shared controller. PR #14.
8. ✅ Step 8 — real Vuk/Vito/Mark shared-production verification.
9. ✅ Production Reliability R1 — background convergence, UI continuity and durable user/location pending recovery. PR #17; Second Brain PR #18.
10. ✅ Step 9 — three-role foundation: Vuk `PLATFORM_OWNER`, Mark `LOCATION_ADMIN`, Vito `WORKER`; role-aware product controls and fresh Set payment drafts. PR #19 plus Second Brain update.
11. ✅ Production Reliability R2 — fail-closed operational writes, bounded persistence, explicit admission, recovery export, pipeline telemetry and correct distinction between incoming Realtime and local divergence. PR #25 merged 2026-08-27.

## First Incident reliability track

12. **First Incident — 2026-08-27:** roughly twenty visible iPhone Home Screen PWA operations during a real round did not reach Supabase. Treat [[18_Production_Incidents_and_Never_Again_Rules]] as a permanent release reference.
13. **R2 field validation:** observe realistic Petalon use on the affected iPhone with Vito concurrently using Android, repeated normal PWA close/reopen/background behavior, Sunbed/Set/Bed/Aquapark work, Realtime convergence and end-of-day money/report review. A clean day is evidence, not proof that rare failure classes are impossible.
14. **Reliability R3 — preventative database architecture:** design/implement immutable client operation IDs/outbox, append-only server operation ledger, idempotent authenticated server commands and immutable/voidable financial ledger. Move concurrency gradually toward per-entity versions instead of one whole-location replacement revision.
15. **Layer 5 Owner Real Revenue vs App Revenue:** owner/admin only. Mark or Vuk manually enters Real Revenue per authorized location/date; App Revenue is calculated automatically; show EUR and percentage difference; percentage is red above 10%; no Worker task, no explanation field and no Marketino/fiscal integration requirement. Store the boss-entered revenue in a separate RLS-protected server boundary with audit history.

## Multi-location track

16. **Step 10 — Koversada / Multi-Location v1:** may proceed on top of R2, but must not weaken any Never-Again Rule or replace the R2 production write architecture with R3 during this step.
17. Koversada initial interface: Aquapark + Settings only; same app/link/Supabase project; own location state and RLS memberships.
18. Koversada access: Koversada Worker operates Koversada; Vuk and Mark can monitor/manage both Petalon and Koversada; Vito remains Petalon-only.
19. Koversada must support multiple independent Worker Auth users next season. Two workers using one location simultaneously plus Vuk/Mark monitoring is a required architecture/test scenario.
20. Add location switching/reporting for Vuk/Mark and location-specific UI profiles while preserving strict location scoping in Realtime, pending/recovery storage, telemetry and RLS.
21. The owner revenue summary should expose Petalon App Revenue / Real Revenue / difference %, Koversada App Revenue / Real Revenue / difference %, plus combined App Revenue and combined Real Revenue when complete.

## Reliability invariants

- Supabase remains authoritative for server-confirmed state.
- A visible mutation cannot be silently ignored by the shared controller.
- No durability/persistence operation may block forever.
- Unsafe local durability hard-stops further operational work.
- Temporary server/network failure with confirmed local durability is different from unsafe device storage.
- Incoming authoritative Realtime must not create a false STOP or false local mutation.
- Accepted server facts must leave immutable forensic history.
- Real Home Screen PWA lifecycle and concurrent phones are mandatory release-test conditions.
- Owner revenue comparison is a detection/audit control, not a replacement for durability, idempotency or backups.
- The whole-AppData JSONB model is an MVP bridge, not the final commercial transaction architecture.

## R3 decision rule

R3 does not have to block the current internal Petalon/Koversada pilot if R2 behaves correctly under real field use. However, a clean field day does not eliminate the architectural limitations of whole-AppData CAS writes.

R3 should become mandatory before either of these conditions:

- external/commercial customer rollout where silent loss/duplication must be independently recoverable and auditable;
- sustained high-concurrency operation, including next-season Koversada with multiple independent workers writing simultaneously.

If R2 produces another unexplained STOP, missing operation, unresolved multi-user conflict or revenue discrepancy attributable to write reliability, R3 should be promoted from planned hardening to immediate priority after forensic diagnosis.

## Future owner/admin work

The Mark Location Owner Dashboard remains valid product work, but reliability and the real second-location architecture take priority. Owner-only confidential data must use an RLS-protected server boundary; hiding shared `location_state` data in React is not confidentiality.

The owner dashboard should expose per-location App Revenue and Real Revenue plus the percentage difference. Workers do not enter or need to see Real Revenue.

Worker/location membership administration requires a trusted server-side write path and must never use a service-role credential in the browser.

## Security/commercial hardening

- Enable Supabase Auth leaked-password protection unless a documented constraint prevents it.
- Re-run security/performance advisors after material schema/Auth changes.
- Evaluate database backup/PITR before commercial rollout for accepted server data and perform a restore drill rather than merely assuming backups work.
- Keep KNO separate and untouched.
- Prepare neutral production ownership/branding/infrastructure before selling the product externally.

## Later

22. Server-owned `Europe/Zagreb` business-day/reset logic where needed.
23. Seasonal licensing if required by the business model.
24. Payment/fiscal integrations later only if the product actually needs them.
