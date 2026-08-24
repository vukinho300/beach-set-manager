# Implementation Roadmap

Status: `prototype_decision`

## Shared Petalon v1 — current track

1. ✅ **Step 1 completed** — minimal Supabase browser/client and shared-state repository foundation while keeping current local behavior unchanged. Merged in PR #3.
2. ✅ **Step 2 completed** — dedicated Beach Set Manager Supabase project, repository migrations for `locations`, `location_memberships` and versioned `location_state`, RLS/least-privilege grants, generated database types, Petalon identity and revision-safe conditional-write foundation. Merged in PR #5.
3. ✅ **Step 3 completed for implementation/review scope** — real Vuk/Vito/Mark Auth identities and active Petalon memberships; controlled non-operational initial state; authenticated active-member reads/writes; stale-revision conflict proof; server-owned audit-field proof; same-session inactive-membership revocation/restoration; worker privilege-escalation denial. Implemented in PR #6 at head `a8bb0073469ca2dcbd6d0275a03a6a0d7275ded3` pending merge.
4. **Current step — Step 4:** implement the Supabase-backed `SharedLocationStateRepository<T>` adapter. Every save must use `location_id + expectedRevision`, map one returned row to `accepted`, map a genuine stale zero-row write to `conflict`, and preserve authorization/network failures as `unavailable`. Add focused adapter tests. Do not switch `App.tsx` or live persistence yet.
5. Switch application load/save for shared state behind the reviewed repository adapter, with deliberate first-load/seed behavior and no automatic upload of Vuk's working browser data.
6. Add the minimal email/password login/session UX required for Vuk, Vito and Mark to use the shared backend safely.
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
