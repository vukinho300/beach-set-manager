# Project Status and Next Actions

Status: `canonical`

## Current state

**Shared Petalon v1 and Production Reliability R1 are merged. Step 9 / PR #19 is independently reviewed and pending merge.**

Steps 1–8 remain the verified shared foundation: browser Auth/session, RLS membership boundary, authoritative Supabase `location_state`, revision-safe conditional writes, realtime invalidation, account isolation, anonymous denial, worker privilege restrictions and live membership revocation/restoration.

Production Reliability R1 is now merged and is part of the required production architecture:

- background realtime/reconnect refresh does not remount the operational app;
- active tab and per-tab scroll continuity are preserved separately from shared AppData;
- unconfirmed operational mutations are durably preserved in user/location-scoped IndexedDB;
- retryable network failures retain optimistic work and retry conservatively;
- attempted/ambiguous recovery prefers preserved conflict over forced overwrite;
- stale attempted Beach snapshots cannot resurrect later legitimate server state;
- account switch/sign-out cannot expose or submit another user's pending work.

## Step 9 — independently reviewed, PR #19 pending merge

Canonical roles:

- Vuk — `PLATFORM_OWNER` — **Platform Admin**;
- Mark — `LOCATION_ADMIN` — **Location Owner**;
- Vito — `WORKER` — **Worker**.

Step 9 findings/changes:

- the Second Brain already documented Mark as the future `LOCATION_ADMIN`, but the old Step 3 verification script and the live membership had drifted to `WORKER`;
- Mark's production membership was verified active `WORKER` and corrected only to active `LOCATION_ADMIN`; Vuk/Vito were untouched;
- `supabase/verification/role_expectations.json` now records the canonical roles and the credential-local authenticated verification script consumes those expectations;
- the browser loads the current user's own Petalon membership/role through RLS and scopes it to the current Auth user identity;
- no role inference from email, user metadata, display name or frontend UUID map;
- product labels are Platform Admin, Location Owner and Worker;
- all three retain normal operations and Daily Reset;
- Vuk and Mark receive location-management/destructive shared UI such as Import Backup and Full Reset Shared App Data;
- Vito keeps normal Beaches/Aquapark/reservation/reports/transactions/Export Backup workflow but does not receive those destructive controls;
- this is explicitly product/UI capability gating, not complete semantic action-level DB authorization while all operational data remains one broadly writable revision-safe `location_state` JSONB row.

Paid-set editor correction included in Step 9:

- prior root cause: a new Set editor initialized payment draft fields from historical persisted `set.price` / `priceMode`;
- new behavior: every Set payment editor opens with fixed total `0`, fixed/default mode and blank special price;
- historical transaction/revenue/reporting data remains untouched;
- opening/closing the editor alone creates no AppData mutation or revision;
- Extra Bed has a similar historical-price initialization pattern but was deliberately left outside Step 9 scope.

Reported Step 9 verification:

- 92/92 tests across 12 files;
- production build passed;
- `git diff --check` passed;
- PowerShell verification-script syntax passed;
- R1 regression suite passed;
- manual Vuk, Mark and Vito role checks passed;
- paid-set EUR 12 regression passed;
- realtime/no-jump smoke passed.

KNO remains untouched.

## Immediate milestone

**Mark Location Owner Dashboard** — build the first owner/manager-focused experience on top of the Step 9 `LOCATION_ADMIN` role/capability foundation.

## Immediate next action

After PR #19 and the Step 9 Second Brain PR merge:

1. Define the owner dashboard's exact business questions before coding.
2. Prefer a focused dashboard for Mark rather than a generic admin console.
3. Reuse the current authoritative AppData/reports only for information that is acceptable as owner-focused UX.
4. Explicitly identify any dashboard information that must be confidential from Vito. Such data must not merely be hidden in React; it needs a separate RLS-protected server boundary.
5. Do not add browser service-role credentials or broad membership-admin writes.
6. Preserve all R1 reliability behavior and the normal operational workflow.

Likely owner-dashboard candidates to decide with Vuk before implementation:

- current/today revenue overview;
- breakdown by Beaches/Sunbeds/Aquapark;
- report/archive access and trends;
- current operational status/occupancy summary;
- owner-level backup/destructive tools already authorized in Step 9;
- future worker/location management only after designing a trusted write path.

## Deferred / later

- True confidential/action-level owner authorization requires a separate RLS-protected server boundary where needed; the monolithic `location_state` JSONB cannot provide semantic action authorization by itself.
- Full worker add/remove/role-management UI remains deferred until a trusted management path is designed.
- Extra Bed payment-draft reset remains a possible later workflow fix if Vuk wants the same fresh-payment behavior there.
- Full immutable offline command/outbox + server operation-id idempotency remains a later architecture if R1's whole-AppData pending snapshot proves insufficient.
- Device/session limits, licensing, multi-location provisioning, white-labeling, infrastructure concealment and payment integrations remain deferred.
