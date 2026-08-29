# Implementation Roadmap

Status: `prototype_decision`
Last reviewed: 2026-08-29

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

14. ⚠️ **Second Incident — 2026-08-28:** normal concurrent Production operation proved that the whole-location CAS boundary can manufacture a conflict between unrelated business resources. Vuk's Aquapark wristband-return write and Vito's Set 13 payment both started from revision 443; Vuk's write became revision 444 and Vito's Set write returned explicit conflict. R2 preserved Set 13 but the conflict state locked Vito out of the entire operational application.

15. ⚠️ **R2.1 PR #31 — first disjoint-conflict bridge:** merged and deployed after the Second Incident. It added a strict closed operation allowlist, one durable automatic rebase/retry, and no blind overwrite, but only when the explicit conflict's current revision was exactly `expected + 1`. This must not be marked as the completed reliability fix because field evidence immediately invalidated that assumption.

16. ⚠️ **Third Incident — 2026-08-29:** deliberate real two-device reproduction on the PR #31 Production build. From base 521, Vito produced revision 522 (`Set 53 FREE -> FREE + updatedAt`) then revision 523 (`FREE -> LEFT`). Vuk's unrelated Aquapark close, still expecting 521, received conflict against 523. The +1 gate prevented R2.1 reconciliation entirely and the full conflict lockout returned.

17. ✅ **Incident 3 forensic/design correction:** the extra revision was traced to a Set source no-op, and multi-revision final-snapshot inference was judged unsafe without intermediate-history proof. The accepted bounded correction is source no-op suppression + strict server proof of a short monotonic revision chain + existing semantic allowlist + one durable rebase.

18. 🟡 **R2.1 corrective PR #32 — reviewed, awaiting frontend merge/field gate:**

- 268/268 tests pass;
- 64/64 ordered safe two-controller operation-family races pass;
- multi-revision and negative matrices pass;
- 33/33 real local SQL integration checks pass;
- Production migration `20260829135041_add_safe_revision_chain_verification` is applied and independently verified;
- real Incident 3 history 521→523 proves compatible under the new history semantics;
- explicit upgrade-compatible scoped discard/use-current recovery is implemented;
- frontend still must be merged/deployed and tested on the already-conflicted iPhone.

19. **R2.1 corrective field gate:** after PR #32 deployment, recover the preserved old iPhone conflict without clearing site data; then perform representative real two-device races across Set/Bed/Sunbed/Aquapark and inspect telemetry/history. Only then mark Incident 3 resolved and the bridge field-validated.

20. **Reliability R3 — immediate next architecture after field gate:** move business actions toward immutable client operation IDs/outbox, idempotent authenticated server commands, append-only accepted-operation history and immutable/voidable financial records. Progressively narrow concurrency from one location revision toward resource/entity boundaries.

21. **R3 field verification:** exercise independent domains from separate real devices, repeated PWA lifecycle changes, ambiguous response/retry cases and genuine same-resource conflicts.

22. **Layer 5 Owner Real Revenue vs App Revenue:** remain a boss-only detection/audit control. It does not replace Layers 1–4 write correctness, R2.1 or R3.

## Multi-location track

23. **Step 10 — Koversada / Multi-Location v1:** may proceed only after the current reliability gate is satisfied and must not weaken any Never-Again Rule.
24. Koversada initial interface: Aquapark + Settings only; same app/link/Supabase project; own location state and RLS memberships.
25. Koversada access: Koversada Worker operates Koversada; Vuk and Mark can monitor/manage both Petalon and Koversada; Vito remains Petalon-only.
26. Koversada must support multiple independent Worker Auth users next season. Two workers using one location simultaneously plus Vuk/Mark monitoring is a required architecture/test scenario.
27. Add location switching/reporting for Vuk/Mark and location-specific UI profiles while preserving strict location scoping in Realtime, pending/recovery storage, telemetry and RLS.
28. The owner revenue summary should expose Petalon App Revenue / Real Revenue / difference %, Koversada App Revenue / Real Revenue / difference %, plus combined App Revenue and combined Real Revenue when complete.

## Reliability invariants

- Supabase remains authoritative for server-confirmed state.
- A visible mutation cannot be silently ignored by the shared controller.
- No durability/persistence operation may block forever.
- Unsafe local durability hard-stops further operational work.
- Temporary server/network failure with confirmed local durability is different from unsafe device storage.
- Incoming authoritative Realtime must not create a false STOP or false local mutation.
- Accepted server facts must leave immutable forensic history.
- A whole-location revision conflict is not automatically a business-resource conflict.
- Multi-revision reconciliation cannot rely only on final BASE→CURRENT if hidden intermediate states could matter.
- Automatic reconciliation must remain closed/allowlisted, bounded and fail-closed.
- Deliberate local conflict discard must never mutate authoritative shared state.
- Real Home Screen PWA lifecycle and concurrent phones are mandatory release-test conditions.
- Owner revenue comparison is a detection/audit control, not a replacement for durability, idempotency or backups.
- The whole-AppData JSONB model is an MVP bridge, not the final commercial transaction architecture.

## R3 decision status

The Second Incident promoted R3 to immediate reliability direction. The Third Incident does not reverse that decision; it shows why the bounded R2.1 bridge must not grow into an endless snapshot-merge framework.

PR #32 exists to keep current Petalon operation viable while R3 is designed. Do not repeatedly widen the R2.1 classifier whenever a new complex domain case appears. If a case cannot be proven safely within the bounded bridge, let it fail closed and move the capability into R3.

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

29. Server-owned `Europe/Zagreb` business-day/reset logic where needed.
30. Seasonal licensing if required by the business model.
31. Payment/fiscal integrations later only if the product actually needs them.
