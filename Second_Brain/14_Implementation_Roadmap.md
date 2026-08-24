# Implementation Roadmap

Status: `prototype_decision`

## Shared Petalon v1 — current track

1. ✅ Completed — add the minimal Supabase browser/client and shared-state repository foundation while keeping current local behavior unchanged. Merged in PR #3 at `85005007d285a2cd3366c1297286b7f5b96a43ad`.
2. **Current step** — create a dedicated Beach Set Manager Supabase development project and link the local repository to it.
3. In the same database-foundation step, add repository migrations for `locations`, `location_memberships` and a versioned `location_state` JSONB record; enable required grants and RLS, and implement revision-safe state writes.
4. Independently verify the schema/security foundation: no anon data access, authenticated users without active membership cannot access Petalon data, membership predicates are enforced by RLS, and stale expected revisions cannot silently overwrite newer state.
5. Create/authenticate Vuk, Vito and Mark and attach all three to Petalon with active memberships.
6. Seed Petalon using controlled development state, not an automatic upload of Vuk's working browser data.
7. Implement the Supabase-backed repository adapter and switch application load/save for the shared state behind the existing repository boundary.
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
