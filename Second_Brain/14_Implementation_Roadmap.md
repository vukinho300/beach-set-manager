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
8. ✅ **Step 8 VERIFIED** — real Vuk/Vito/Mark verification of Auth/session, shared reads/writes, realtime convergence, stale conflict protection, anonymous denial, live revocation/restoration, worker privilege protection and final clean state. No implementation changes required.
9. ✅ **Production phone deployment configured/working enough to expose real workflow evidence** — production public Supabase configuration works and the app is usable on phones.
10. **Production Reliability R1 — independently reviewed, PR #17 pending merge:** keep realtime refresh in the background without remount/scroll resets; persist UI-only tab/scroll continuity; durably preserve unconfirmed AppData in user/location-scoped IndexedDB; bounded retry/resume; conservative conflict/recovery; narrow safe unattempted Beach reconciliation; prevent stale attempted records from resurrecting old state. Review corrections are included at head `70fc0657...`.
11. **Next operational checkpoint:** merge/deploy R1 and validate under normal beach use. Do not treat role UI as higher priority than proving no silent entry loss or disruptive refresh remains.
12. Add user-specific owner/worker UI/permission differences only after R1 is stable enough in normal production use.
13. Migrate/refine individual domains into normalized tables later only when the whole-AppData JSONB model becomes an actual limitation.

## Reliability architecture now required by evidence

- Supabase remains authoritative.
- Initial Auth/shared access load may block; background realtime/reconnect refresh must not blank/remount working UI.
- Operational UI position is separate device UI state, not shared AppData.
- Unconfirmed operational mutations must have a durable device copy before retryable network failure/reopen can erase them.
- Current R1 uses a whole-AppData IndexedDB recovery snapshot, not a full immutable command outbox.
- Attempted/ambiguous recovery must prefer preserved conflict over guessing or force overwrite.
- Account/user scoping and RLS remain mandatory around every recovery path.

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
