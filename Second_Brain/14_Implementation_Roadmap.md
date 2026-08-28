# Implementation Roadmap

Status: `prototype_decision`
Last reviewed: 2026-08-28

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

## Production reliability track

12. ✅ **First Incident — 2026-08-27:** roughly twenty visible iPhone Home Screen PWA operations during a real round did not reach Supabase. This produced the permanent Never-Again Rules and R2 containment architecture.

13. ✅ **Production Reliability R2 — PR #25:** explicit admission, bounded durability, fail-closed unsafe writes, recovery export, pipeline telemetry and correct authoritative-Realtime/local-divergence classification. Merged and deployed 2026-08-27.

14. ⚠️ **Second Incident — 2026-08-28:** normal concurrent Production operation proved that the whole-location CAS boundary can manufacture a conflict between unrelated business resources. Vuk's Aquapark wristband-return write and Vito's Set 13 payment both started from revision 443; Vuk's write became revision 444 and Vito's Set write returned an explicit conflict. R2 preserved Set 13 but the conflict state locked Vito out of the entire operational application.

15. **Immediate conflict-correctness milestone:** define and implement a safe response to disjoint-resource concurrent operations. No blind whole-state overwrite. Conflict handling must preserve evidence while providing a practical resolution/resume path.

16. **Reliability R3 — immediate priority:** move business actions toward immutable client operation IDs/outbox, idempotent authenticated server commands, append-only accepted-operation history and immutable/voidable financial records. Progressively narrow concurrency from one location revision toward resource/entity boundaries.

17. **R3 field verification:** simultaneously exercise independent domains from separate real devices, including Vuk Aquapark + Vito Sets/Beds/Sunbeds, repeated PWA lifecycle changes, ambiguous response/retry cases and genuine same-resource conflicts.

18. **Layer 5 Owner Real Revenue vs App Revenue:** remain a boss-only detection/audit control. It does not replace Layers 1–4 write correctness or R3.

## Multi-location track

19. **Step 10 — Koversada / Multi-Location v1:** may proceed only after the Second Incident reliability gate is satisfied and must not weaken any Never-Again Rule.
20. Koversada initial interface: Aquapark + Settings only; same app/link/Supabase project; own location state and RLS memberships.
21. Koversada access: Koversada Worker operates Koversada; Vuk and Mark can monitor/manage both Petalon and Koversada; Vito remains Petalon-only.
22. Koversada must support multiple independent Worker Auth users next season. Two workers using one location simultaneously plus Vuk/Mark monitoring is a required architecture/test scenario.
23. Add location switching/reporting for Vuk/Mark and location-specific UI profiles while preserving strict location scoping in Realtime, pending/recovery storage, telemetry and RLS.
24. The owner revenue summary should expose Petalon App Revenue / Real Revenue / difference %, Koversada App Revenue / Real Revenue / difference %, plus combined App Revenue and combined Real Revenue when complete.

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

## R3 decision status

The previous decision rule said R3 should be promoted to immediate priority if R2 produced another unresolved multi-user conflict after forensic diagnosis.

The Second Incident satisfies that condition.

R3 is therefore no longer merely deferred commercial/high-concurrency hardening. It is the immediate reliability direction.

The exact migration should still be staged domain-by-domain rather than performed as an unreviewed whole-application rewrite.

Step 10 frontend rollout remains behind this reliability gate.

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

25. Server-owned `Europe/Zagreb` business-day/reset logic where needed.
26. Seasonal licensing if required by the business model.
27. Payment/fiscal integrations later only if the product actually needs them.
