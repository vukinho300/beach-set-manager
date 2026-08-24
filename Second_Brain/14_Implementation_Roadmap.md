# Implementation Roadmap

Status: `prototype_decision`

## Shared Petalon v1 — current track

1. ✅ Completed — add the minimal Supabase browser/client and shared-state repository foundation while keeping current local behavior unchanged. Merged in PR #3 at `85005007d285a2cd3366c1297286b7f5b96a43ad`.
2. ✅ Completed — create a dedicated Beach Set Manager Supabase project and link the repository to it. Dedicated project: `uonovdnxfjqfjkhopxwg`; KNO remains separate and untouched.
3. ✅ Completed — add repository migrations for `locations`, `location_memberships` and versioned `location_state` JSONB; enable required grants/RLS; establish trigger-owned revision/audit fields and revision-safe conditional updates. Implemented in PR #5 at head `96c169971b45719daa35b8e73de1e1d69163f885` pending merge.
4. ✅ Completed for current foundation scope — independently verify no anon access, no-membership denial, security advisor cleanliness, migration parity, and stale revision non-overwrite behavior. Active-member/revocation tests remain intentionally deferred until real accounts exist.
5. **Current step — Step 3:** create/authenticate Vuk, Vito and Mark, attach all three to Petalon with active memberships, create controlled initial `location_state`, and verify active-member reads/writes plus inactive-membership revocation using real identities.
6. Implement the Supabase-backed repository adapter so every save uses `location_id + expectedRevision` and reliably maps zero-row stale updates to the existing `conflict` result.
7. Switch application load/save for shared state behind the existing repository boundary, keeping migration/fallback behavior deliberate and avoiding automatic upload of Vuk's working browser data.
8. Add realtime subscription or simple invalidation/reload so the three clients converge on accepted server state.
9. Verify from separate sessions/devices: shared reads, shared writes, refresh persistence, conflict behavior, no anon access, no-member denial and membership revocation.
10. Add user-specific UI/permission differences only where the real Petalon workflow requires them.
11. Migrate/refine individual domains into normalized tables later only when JSONB shared state becomes an actual limitation.

## Later work — explicitly not blocking v1

12. Replace remaining device-owned business-day/reset behavior with server-owned `Europe/Zagreb` business-day logic when shared operation makes this necessary.
13. Prepare separate production infrastructure, neutral branding/domain and stronger ownership separation before broader external/commercial rollout.
14. When a second real location exists, design the provisioning/deployment pipeline and revisit multi-location architecture from evidence.
15. Add seasonal licensing only if the business model requires it.
16. Add offline writes only if operational testing proves they are needed.
17. Add payment/fiscal integrations later.
