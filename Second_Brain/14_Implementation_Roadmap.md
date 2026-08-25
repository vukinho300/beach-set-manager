# Implementation Roadmap

Status: `prototype_decision`

## Shared Petalon v1 — current track

1. ✅ **Step 1 completed** — minimal Supabase browser/client and shared-state repository foundation while keeping current local behavior unchanged. Merged in PR #3.
2. ✅ **Step 2 completed** — dedicated Beach Set Manager Supabase project, repository migrations for `locations`, `location_memberships` and versioned `location_state`, RLS/least-privilege grants, generated database types, Petalon identity and revision-safe conditional-write foundation. Merged in PR #5.
3. ✅ **Step 3 completed** — real Vuk/Vito/Mark Auth identities and active Petalon memberships; controlled non-operational initial state; authenticated active-member reads/writes; stale-revision conflict proof; server-owned audit-field proof; same-session inactive-membership revocation/restoration; worker privilege-escalation denial. Merged in PR #6.
4. ✅ **Step 4 implemented and reviewed** — Supabase-backed `SharedLocationStateRepository<T>` adapter with generated DB types, mandatory `location_id + expectedRevision` writes, accepted/conflict/unavailable classification, RLS-aware zero-row handling, and focused 11/11 tests. PR #8 pending merge; live `App.tsx` persistence remains localStorage.
5. **Current step — Step 5:** add the minimal email/password browser login/session UX for Vuk, Vito and Mark. Restore sessions across refresh, support sign-out, keep Supabase provider details behind a small boundary where practical, and test authenticated/unauthenticated/loading behavior. Do not switch operational AppData persistence yet.
6. Switch application load/save for shared state behind the reviewed repository adapter. Use the authenticated browser session, preserve `location_id + expectedRevision` semantics, make first-load/controlled-seed behavior explicit, and do not automatically upload Vuk's existing browser/localStorage data.
7. Add realtime subscription or simple invalidation/reload so the three clients converge on accepted server state.
8. Verify from separate sessions/devices: login/session persistence, shared reads, shared writes, refresh persistence, conflict behavior, no anon access, no-member denial and membership revocation.
9. Add user-specific UI/permission differences only where the real Petalon workflow requires them.
10. Migrate/refine individual domains into normalized tables later only when JSONB shared state becomes an actual limitation.

## Security hardening before broader production/commercial use

- Enable Supabase Auth leaked-password protection unless a later documented constraint argues against it.
- Re-run security/performance advisors after each material schema/Auth change.

## Later work — explicitly not blocking v1

11. Replace remaining device-owned business-day/reset behavior with server-owned `Europe/Zagreb` business-day logic when shared operation makes this necessary.
12. Prepare separate production infrastructure, neutral branding/domain and stronger ownership separation before broader external/commercial rollout.
13. When a second real location exists, design the provisioning/deployment pipeline and revisit multi-location architecture from evidence.
14. Add seasonal licensing only if the business model requires it.
15. Add offline writes only if operational testing proves they are needed.
16. Add payment/fiscal integrations later.
