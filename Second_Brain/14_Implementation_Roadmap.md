# Implementation Roadmap

Status: `prototype_decision`

## Shared Petalon v1 — current track

1. ✅ **Step 1 completed** — minimal Supabase browser/client and shared-state repository foundation. Merged in PR #3.
2. ✅ **Step 2 completed** — dedicated Beach Set Manager Supabase project, `locations`, `location_memberships`, versioned `location_state`, RLS/least privilege, generated types and revision-safe writes. Merged in PR #5.
3. ✅ **Step 3 completed** — real Vuk/Vito/Mark Auth identities, memberships, stale-write proof, audit ownership, revocation/restoration and worker privilege denials. Merged in PR #6.
4. ✅ **Step 4 completed** — typed Supabase shared-state adapter with mandatory `location_id + expectedRevision`, conflict/unavailable classification and tests. Merged in PR #8.
5. ✅ **Step 5 completed** — browser Auth/session UX with persisted session, sign-out and no public signup. Merged in PR #10.
6. ✅ **Step 6 completed** — authoritative Supabase AppData, server-first load, no operational localStorage fallback, serialized/coalesced revision-safe saves, conservative conflict/unavailable behavior and account-switch isolation. Merged in PR #12.
7. ✅ **Step 7 completed** — filtered realtime invalidation, background authoritative reload model, revision suppression, save/pending/conflict safety and user-scoped subscription cleanup. Merged in PR #14.
8. ✅ **Step 8 VERIFIED** — real Vuk/Vito/Mark verification of Auth/session, shared reads/writes, realtime convergence, stale conflict protection, anonymous denial, live revocation/restoration, worker privilege protection and final clean state.
9. ✅ **Production Reliability R1 completed** — background convergence without remount/scroll reset; UI-only tab/scroll continuity; durable user/location-scoped IndexedDB recovery for unconfirmed AppData; bounded retry/resume; conservative attempted-save recovery and conflict handling. Merged in PR #17; Second Brain record merged in PR #18.
10. **Step 9 — independently reviewed, PR #19 pending merge:** canonical three-role foundation: Vuk `PLATFORM_OWNER` / Platform Admin, Mark `LOCATION_ADMIN` / Location Owner, Vito `WORKER`; RLS-backed own-membership role loading; identity-scoped role state; Vuk+Mark location-management UI; Vito full normal operations without destructive shared tools; Mark live role drift corrected; verification expectations hardened. Includes fresh paid-set payment draft behavior so historical price no longer pre-fills the next payment intent.
11. **Next product step — Mark Location Owner Dashboard:** define and implement a focused owner/manager dashboard on top of `LOCATION_ADMIN` without confusing owner-focused UI with confidential server-enforced data.
12. Add trusted worker/location membership administration only after a safe server-side write path is designed; never ship service-role credentials to the browser.
13. Migrate/refine individual domains into normalized tables only when the whole-AppData JSONB model becomes an actual limitation or when owner-only confidentiality/action-level authorization requires a separate boundary.

## Canonical role hierarchy

- `PLATFORM_OWNER` — Vuk — Platform Admin / software-platform authority and Petalon support access.
- `LOCATION_ADMIN` — Mark — Location Owner / Petalon owner-manager experience.
- `WORKER` — Vito — daily operational employee experience.

All three currently keep normal operations. Location-management/destructive shared UI is available to Platform Admin and Location Owner, not Worker.

This does not yet create semantic action-level database authorization inside the monolithic `location_state` JSONB update path.

## Reliability architecture required by evidence

- Supabase remains authoritative.
- Initial Auth/shared access load may block; background realtime/reconnect refresh must not blank/remount working UI.
- Operational UI position is separate device UI state, not shared AppData.
- Unconfirmed operational mutations must have a durable device copy before retryable network failure/reopen can erase them.
- Current R1 uses a whole-AppData IndexedDB recovery snapshot, not a full immutable command outbox.
- Attempted/ambiguous recovery must prefer preserved conflict over guessing or force overwrite.
- Account/user scoping and RLS remain mandatory around every recovery path.

## Mark Location Owner Dashboard guardrails

Before implementation, decide which owner questions the dashboard answers.

Owner-focused UX can summarize existing shared operational data, but if data must be truly confidential from Worker users it needs a separate RLS-protected server-side data boundary. Hiding shared `location_state` fields in React is not confidentiality.

Do not create a generic admin console unless actual workflow requires it.

## Security hardening before broader production/commercial use

- Enable Supabase Auth leaked-password protection unless a later documented constraint argues against it.
- Re-run security/performance advisors after material schema/Auth changes.

## Later work

14. If R1's snapshot durability proves insufficient for long offline periods or frequent multi-user conflicts, implement a normalized immutable offline operation/outbox model with server-side idempotency and per-entity versions.
15. Replace remaining device-owned business-day/reset behavior with server-owned `Europe/Zagreb` business-day logic when shared operation makes this necessary.
16. Prepare separate production infrastructure, neutral branding/domain and stronger ownership separation before broader external/commercial rollout.
17. When a second real location exists, design the provisioning/deployment pipeline and revisit multi-location architecture from evidence.
18. Add seasonal licensing only if the business model requires it.
19. Add payment/fiscal integrations later.
