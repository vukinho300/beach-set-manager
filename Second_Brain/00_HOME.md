# Beach Management Platform — Second Brain

Status: `canonical`
Last reviewed: 2026-08-28
Repository implementation checkpoint reviewed: `8f7f332e51e402dbdcba4bc63d029f5ff6c4c042`

This vault is the human-readable control center for `beach-set-manager` as it evolves from a local-only Petalon PWA into a secure shared operational application.

## Project rule

> ==The repository, running code, tests, migrations and database are the technical source of truth. The Second Brain is the architecture memory, decision log and operating manual.==

## Current phase

**Production Reliability R2 is merged and running. The Second Incident on 2026-08-28 has now been forensically diagnosed as a whole-location CAS conflict between unrelated normal Petalon operations. Reliability R3 / conflict-correctness is the immediate engineering priority.**

Vuk and Vito were using Petalon concurrently as intended:

- Vuk changed Aquapark;
- Vito recorded Set 13.

Both writes began from revision 443. Vuk's unrelated Aquapark change became revision 444; Vito's Set 13 save then returned a CAS conflict.

R2 preserved Set 13 and prevented unsafe overwrite, but current conflict UX made the entire operational application unavailable to Vito.

See [[18_Production_Incidents_and_Never_Again_Rules]].

Draft PR #28 contains Step 10 / Koversada frontend work. It remains unmerged and is not the Production frontend. Its additive database foundation has been provisioned remotely, but Step 10 frontend rollout remains behind the Second Incident reliability gate.

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

1. Finalize the Second Incident record and accepted corrective architecture.
2. Promote Reliability R3 / disjoint-resource conflict correctness to immediate implementation work.
3. Ensure a normal Aquapark operation and unrelated Set/Bed/Sunbed operation can proceed concurrently without whole-location false conflicts.
4. Add a safe worker conflict-resolution/resume path without blind overwrite.
5. Field-test the correction with Vuk and Vito concurrently.
6. Re-review and resume Step 10 / Koversada only after that reliability gate passes.

Koversada is a real shared second location: its worker(s) operate it while Vuk and Mark may monitor concurrently; future architecture must support multiple independent Koversada worker accounts/devices rather than one shared worker identity.

The frontend is not a security boundary. A copied browser bundle must not grant location data without a valid authenticated user and active membership.

See [[11_Project_Status_and_Next_Actions]] and [[18_Production_Incidents_and_Never_Again_Rules]].
