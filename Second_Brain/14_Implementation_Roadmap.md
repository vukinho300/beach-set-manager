# Implementation Roadmap

Status: `prototype_decision`

## Shared Petalon v1 — current track

1. Add the minimal Supabase browser/client and shared-state repository foundation while keeping current local behavior unchanged.
2. Create a dedicated Beach Set Manager Supabase project.
3. Add migrations for `locations`, `location_memberships` and a versioned `location_state` JSONB record; enable RLS and required grants.
4. Create/authenticate Vuk, Vito and Mark and attach all three to Petalon with active memberships.
5. Seed Petalon using controlled development state, not an automatic upload of Vuk's working browser data.
6. Switch application load/save for the shared state to Supabase behind the repository boundary, with expected-revision conflict protection.
7. Add realtime subscription or simple invalidation/reload so the three clients converge on accepted server state.
8. Verify from separate sessions/devices: shared reads, shared writes, refresh persistence, conflict behavior, no anon access, no-member denial and membership revocation.
9. Add user-specific UI/permission differences only where the real Petalon workflow requires them.
10. Migrate/refine individual domains into normalized tables later only when JSONB shared state becomes an actual limitation.

## Later work — explicitly not blocking v1

11. Replace remaining device-owned business-day/reset behavior with server-owned `Europe/Zagreb` business-day logic when shared operation makes this necessary.
12. Prepare separate production infrastructure, neutral branding/domain and stronger ownership separation before broader external/commercial rollout.
13. When a second real location exists, design the provisioning/deployment pipeline and revisit multi-location architecture from evidence.
14. Add seasonal licensing only if the business model requires it.
15. Add offline writes only if operational testing proves they are needed.
16. Add payment/fiscal integrations later.
