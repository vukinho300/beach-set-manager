# Implementation Roadmap

Status: `prototype_decision`

## Shared Petalon v1 — current track

1. ✅ **Step 1 completed** — minimal Supabase browser/client and shared-state repository foundation while keeping current local behavior unchanged. Merged in PR #3.
2. ✅ **Step 2 completed** — dedicated Beach Set Manager Supabase project, repository migrations for `locations`, `location_memberships` and versioned `location_state`, RLS/least-privilege grants, generated database types, Petalon identity and revision-safe conditional-write foundation. Merged in PR #5.
3. ✅ **Step 3 completed** — real Vuk/Vito/Mark Auth identities and active Petalon memberships; controlled non-operational initial state; authenticated active-member reads/writes; stale-revision conflict proof; server-owned audit-field proof; same-session inactive-membership revocation/restoration; worker privilege-escalation denial. Merged in PR #6.
4. ✅ **Step 4 completed** — Supabase-backed `SharedLocationStateRepository<T>` adapter with generated DB types, mandatory `location_id + expectedRevision` writes, accepted/conflict/unavailable classification, RLS-aware zero-row handling, and focused tests. Merged in PR #8.
5. ✅ **Step 5 completed** — minimal browser email/password Auth/session UX for Vuk, Vito and Mark; session restoration, sign-out, controlled auth states and focused tests; manually verified with all three real accounts. Merged in PR #10.
6. ✅ **Step 6 completed** — controlled clean Petalon operational seed; server-first authoritative Supabase AppData; no operational localStorage fallback; revision-tracked serialized/coalesced saves; conservative conflict/unavailable behavior; explicit backup/import/reset flow through the shared save path; cross-session Vuk/Vito verification; account-switch isolation bound to authenticated user/controller. Merged in PR #12.
7. ✅ **Step 7 completed** — filtered realtime invalidation for the Petalon `location_state` row; authoritative reload through the existing repository; old/own revision suppression; save/pending/conflict safety; serialized/coalesced automatic convergence; user-scoped subscription cleanup; focused realtime publication migration; manual Vuk/Vito automatic convergence verified. Merged in PR #14.
8. ✅ **Step 8 VERIFIED** — final real Vuk/Vito/Mark verification of login/session persistence, authoritative shared reads/writes, automatic realtime convergence, refresh persistence, stale-write conflict behavior, anonymous denial, live membership revocation/restoration, worker privilege protection, account-switch isolation and final clean Petalon state. No implementation changes were required. Final verified Petalon revision: `33`.
9. **Current operational task — Production Phone Deployment Readiness:** configure and verify the Vercel Production deployment so the verified Shared Petalon v1 can be used from Vuk's phone. Ensure only browser-safe Supabase public configuration is present, redeploy current `main`, and verify production mobile login/session/shared-state/realtime behavior.
10. Add user-specific owner/worker UI/permission differences only where the real Petalon workflow requires them and only after phone Production readiness is verified.
11. Migrate/refine individual domains into normalized tables later only when JSONB shared state becomes an actual limitation.

## Security hardening before broader production/commercial use

- Enable Supabase Auth leaked-password protection unless a later documented constraint argues against it.
- Re-run security/performance advisors after each material schema/Auth change.

## Later work — explicitly not blocking current production-phone readiness

12. Replace remaining device-owned business-day/reset behavior with server-owned `Europe/Zagreb` business-day logic when shared operation makes this necessary.
13. Prepare separate production infrastructure, neutral branding/domain and stronger ownership separation before broader external/commercial rollout.
14. When a second real location exists, design the provisioning/deployment pipeline and revisit multi-location architecture from evidence.
15. Add seasonal licensing only if the business model requires it.
16. Add offline writes only if operational testing proves they are needed.
17. Add payment/fiscal integrations later.
