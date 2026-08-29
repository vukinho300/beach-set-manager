# Beach Management Platform — Second Brain

Status: `canonical`
Last reviewed: 2026-08-29
Repository implementation checkpoint reviewed: PR #32 code head `87b754802486247662de63a194537abccdd95737` on top of Production main `21c6e25d5caf83bf46e53aa260aedab2596e0168`

This vault is the human-readable control center for `beach-set-manager` as it evolves from the original local Petalon PWA into a secure shared multi-location operational application.

## Project rule

> ==The repository, running code, tests, migrations and verified database are the technical source of truth. The Second Brain is the architecture memory, decision log and operating manual.==

## Current phase

**Production Reliability R2 is the fail-closed containment layer. R2.1 PR #31 is merged, but the Third Incident on 2026-08-29 proved that the first R2.1 patch did not solve the real concurrent-operation problem. Draft PR #32 is the reviewed corrective bridge; its additive Production revision-chain proof migration is already applied and verified, while the frontend remains unmerged until this documentation reconciliation is complete.**

The Second Incident on 2026-08-28 proved the fundamental false-contention class: Vuk's unrelated Aquapark update won revision 444 while Vito's Set 13 payment, based on revision 443, received a whole-location CAS conflict.

R2.1 PR #31 attempted a narrow safe bridge. It could automatically rebase a supported disjoint local bundle only when the explicit CAS conflict showed the server had advanced by **exactly one revision**. That protected against blind merge, but it encoded an assumption that did not survive real field behavior.

On 2026-08-29 Vuk intentionally reproduced the race while both phones ran the R2.1 Production build:

- both relevant operations began from revision 521;
- Vito's Set 53 flow first produced revision 522 with `FREE -> FREE` plus only `updatedAt`;
- Vito then produced revision 523 with `FREE -> LEFT`;
- Vuk's unrelated Aquapark close was durably preserved and sent with expected revision 521;
- the repository returned explicit conflict against current revision 523;
- PR #31 refused reconciliation because `523 !== 521 + 1`;
- Vuk returned to the same full-screen `Newer shared data exists` lockout.

Therefore PR #31 was operationally useless for this real two-revision race even though it still provided useful fail-closed safety and could handle a narrower exactly-one-revision case. It must not be described as the fix that made normal concurrent Petalon operation reliable.

PR #32 theoretically closes the exact gap by combining:

- source-level suppression of semantically meaningless Set/Bed status writes such as `FREE -> FREE + updatedAt`;
- bounded multi-revision eligibility only when the server proves the complete immutable revision chain is contiguous and monotonic, with no hidden intermediate third state, add/remove, reset/restore or transaction disappearance;
- the existing strict AppData operation allowlist to prove the local and final remote business changes are compatible;
- one durably persisted automatic rebase/retry only;
- an explicit `Discard local change and use current shared data` recovery action that first loads/validates authoritative state, then removes only the exact user+location pending record and never saves to the server.

The new Production boolean proof RPC has been applied and independently verified against the real Incident 3 history. Revisions 521–523 are contiguous, strict-validation compatible and semantically monotonic; current real chains 539–541 and 540–541 also prove true, while >10 gaps, wrong-current revisions and nonexistent locations fail closed.

This is still **theoretical application correctness until the PR #32 frontend is merged/deployed and the already-conflicted iPhone exits the old conflict in place without clearing site data, followed by controlled real two-phone concurrency validation.**

R3 remains required. PR #32 is a bounded bridge over the whole-AppData CAS architecture, not the final commercial concurrency model.

Draft PR #28 contains Step 10 / Koversada frontend work. It remains unmerged and its rollout stays behind this reliability gate.

KNO remains separate and untouched.

## Main navigation

1. [[01_Main_Plan]]
2. [[02_Project_Boundaries_and_AI_Roles]]
3. [[03_Current_Architecture_and_Repository_State]]
4. [[04|Shared Architecture]]
5. [[05_Authentication_Authorization_and_Security]]
6. [[06_Licensing_White_Label_and_Seasonality]]
7. [[07_Offline_Sync_and_Conflict_Resolution]]
8. [[08_Infrastructure_Costs_and_Environments]]
9. [[09_Development_Workflow_and_Deployment]]
10. [[10_Risk_Register]]
11. [[11_Project_Status_and_Next_Actions]]
12. [[12_Decision_Log]]
13. [[13_Second_Brain_Operating_System]]
14. [[14_Implementation_Roadmap]]
15. [[15_Open_Questions_and_Clarifications]]
16. [[16_Experiments_and_Evidence]]
17. [[17_Domain_and_Production_Branding]]
18. [[18_Production_Incidents_and_Never_Again_Rules]]

## Current product areas

- Beaches: 56 numbered sets across Beach 1 and Beach 2.
- Beds: 4 extra beds.
- Beach reservations: date-based, paid amount, notes, multi-assignment to sets/beds.
- Non-numbered Sunbeds: quantity + amount + description sales.
- Aquapark: wristbands, ticket types, prices, timing, extra time, returned wristbands, expiry highlighting.
- Transactions: current-day ledger with deletion audit state.
- Reports: current-day totals and Report Archive behavior.
- Settings: role-aware records, resets, backups/shared tools and account state.

## Immediate objective

1. Merge/deploy the reviewed PR #32 corrective frontend only after this Second Brain update is part of the PR.
2. Reopen the same already-conflicted iPhone without clearing site data and prove the new scoped discard/use-current recovery path returns it to normal Petalon operation.
3. Run controlled representative two-phone races across numbered Sets, Beds, non-numbered Sunbeds and Aquapark; keep the 64-case automated matrix as the broader deterministic coverage.
4. Inspect telemetry and immutable history after the real-device test.
5. Only then mark Incident 3 resolved/field-validated and move immediately into R3A design.
6. Re-review and resume Step 10 / Koversada only after that reliability gate passes.

Koversada is a real shared second location: its worker(s) operate it while Vuk and Mark may monitor concurrently; future architecture must support multiple independent Koversada worker accounts/devices rather than one shared worker identity.

The frontend is not a security boundary. A copied browser bundle must not grant location data without a valid authenticated user and active membership.

See [[11_Project_Status_and_Next_Actions]] and [[18_Production_Incidents_and_Never_Again_Rules]].
