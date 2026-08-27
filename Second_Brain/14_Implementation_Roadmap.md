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

## First Incident reliability track

11. **First Incident — 2026-08-27:** roughly twenty visible iPhone Home Screen PWA operations during a real round did not reach Supabase. Treat [[18_Production_Incidents_and_Never_Again_Rules]] as a permanent release reference.
12. **Production Reliability R2 — Draft PR #25:** fail closed when device durability or controller admission is unsafe; bound persistence operations; explicit update admission; emergency recovery export; privacy-safe pipeline telemetry; distinguish incoming Realtime convergence from genuine local divergence.
13. **R2 release checkpoint:** affected-iPhone lifecycle/concurrent-device/walking-style field validation and controlled durability failure/recovery validation. R2 exists to ensure one unsafe mutation cannot silently become a long sequence of volatile customer entries.
14. **Reliability R3 — preventative database architecture:** design/implement immutable client operation IDs/outbox, append-only server operation ledger, idempotent authenticated server commands and immutable/voidable financial ledger. Move concurrency gradually toward per-entity versions instead of one whole-location replacement revision.
15. **Layer 5 Daily Compare / reconciliation:** per location, automatically calculate app revenue and require the closing worker to submit real/external revenue; store the comparison on a separate RLS-protected server boundary; require a reason when difference exceeds 10%; show missing reconciliation explicitly to owner/admin users; expose Petalon and Koversada App vs Real revenue separately plus combined owner totals. Consider an additional configurable absolute-EUR materiality threshold before implementation.

## Multi-location track

16. **Step 10 — Koversada / Multi-Location v1:** currently paused behind the First Incident reliability gate. Resume only without weakening Never-Again Rules.
17. Koversada initial interface: Aquapark + Settings only; same app/link/Supabase project; own location state and RLS memberships.
18. Koversada access: Worker A operates Koversada; Vuk and Mark can monitor/manage both Petalon and Koversada; Vito remains Petalon-only.
19. Koversada must support multiple independent Worker Auth users next season. Two workers using one location simultaneously plus Vuk/Mark monitoring is a required architecture/test scenario.
20. Add location switching/reporting for Vuk/Mark and location-specific UI profiles only after shared-state/reliability scoping is proven safe.

## Reliability invariants

- Supabase remains authoritative for server-confirmed state.
- A visible mutation cannot be silently ignored by the shared controller.
- No durability/persistence operation may block forever.
- Unsafe local durability hard-stops further operational work.
- Temporary server/network failure with confirmed local durability is different from unsafe device storage.
- Incoming authoritative Realtime must not create a false STOP or false local mutation.
- Accepted server facts must leave immutable forensic history.
- Real Home Screen PWA lifecycle and concurrent phones are mandatory release-test conditions.
- Daily reconciliation is a detection/audit control, not a replacement for durability, idempotency or backups.
- The whole-AppData JSONB model is an MVP bridge, not the final commercial transaction architecture.

## Future owner/admin work

The Mark Location Owner Dashboard remains valid product work, but reliability and the real second-location architecture take priority. Owner-only confidential data must use an RLS-protected server boundary; hiding shared `location_state` data in React is not confidentiality.

The owner dashboard should ultimately expose per-location App Revenue and Real Revenue, reconciliation status/difference/reason, and combined Petalon + Koversada App and Real totals for authorized owner/admin users.

Worker/location membership administration requires a trusted server-side write path and must never use a service-role credential in the browser.

## Security/commercial hardening

- Enable Supabase Auth leaked-password protection unless a documented constraint prevents it.
- Re-run security/performance advisors after material schema/Auth changes.
- Evaluate database backup/PITR before commercial rollout for accepted server data and perform a restore drill rather than merely assuming backups work.
- Keep KNO separate and untouched.
- Prepare neutral production ownership/branding/infrastructure before selling the product externally.

## Later

21. Server-owned `Europe/Zagreb` business-day/reset logic where needed.
22. Seasonal licensing if required by the business model.
23. Payment/fiscal integrations later.
