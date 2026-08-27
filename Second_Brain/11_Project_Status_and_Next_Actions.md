# Project Status and Next Actions

Status: `canonical`
Last reviewed: 2026-08-27

## Current state

Shared Petalon v1, Production Reliability R1 and Step 9 are merged. Canonical roles remain:

- Vuk — `PLATFORM_OWNER` — Platform Admin;
- Mark — `LOCATION_ADMIN` — Location Owner;
- Vito — `WORKER` — Worker.

Step 10 / Koversada was initiated but is **paused**. At the time of the First Incident no Step 10 frontend/schema/location/membership changes had reached Production; only an isolated Koversada Auth user had been created.

## First Incident — highest-priority reliability evidence

On 2026-08-27, during a real Petalon round on Vuk's installed iPhone Home Screen PWA, roughly twenty visible operational entries never reached Supabase. Vito discovered the discrepancy from Android roughly 20–30 minutes later while working concurrently.

Server evidence proves the missing work was not accepted and later overwritten. The exact iOS/browser exception is not proven. The incident exposed a broader architectural problem: the old UI could remain interactive while its pre-network durability/write pipeline was unhealthy.

Canonical incident record and permanent rules: [[18_Production_Incidents_and_Never_Again_Rules]].

## Production Reliability R2 — Draft PR #25

R2 is the immediate release gate. Corrected reviewed head currently referenced by the Second Brain: `cfc465fe34f177accb7d605153fd8a1f80effbce`.

R2 introduces:

- explicit shared-write admission instead of silent controller returns;
- bounded pending-store and IndexedDB operations;
- distinct device-safety state (`safe`, `securing`, `durable`, `blocked`);
- hard fail-closed UX when a visible mutation cannot be durably secured;
- blocking of additional operational mutations while the first unsafe mutation is unresolved;
- in-memory emergency recovery export;
- user/location-scoped localStorage + IndexedDB recovery paths;
- privacy-safe client write-stage telemetry via a narrow membership-checked RPC;
- preservation of R1 CAS, conservative conflict and ambiguous-attempt recovery;
- explicit distinction between a normal incoming authoritative Realtime snapshot and genuine unadmitted local divergence.

R2 is **not approved for Production yet**. Unit/build checks are not sufficient after the First Incident.

## Required R2 release verification

Before merge/deploy:

1. affected iPhone Home Screen PWA Preview test;
2. at least ten entry → background/close → reopen cycles;
3. lock/unlock and app switching;
4. 15–20 reversible walking-style operations;
5. concurrent second-device Realtime updates from Vito/another account;
6. proof incoming authoritative updates do not create false STOP/locking;
7. controlled durability-hang test using the Preview-only seam;
8. proof hard STOP blocks the next operational action;
9. proof emergency recovery export contains the exact visible unsafe state.

## Next preventative database milestone — Reliability R3

The First Incident is evidence that the whole-AppData snapshot/revision model should not be considered the final commercial write architecture.

After R2 is proven, design an immutable client operation/outbox and idempotent server-command model:

- one stable UUID `operation_id` per business action;
- durable local operation record retained across retries/reopen;
- append-only protected server operation ledger;
- narrow authenticated commands/RPCs that derive `auth.uid()` and verify active location membership;
- duplicate retry of the same `operation_id` returns the previous result rather than creating another transaction;
- revenue-affecting operations create immutable/voidable financial ledger entries atomically;
- progressively move contention from one whole-location revision to the relevant entity/version so independent workers can operate concurrently.

See [[18_Production_Incidents_and_Never_Again_Rules]].

## Koversada / multi-location requirement after reliability gate

Koversada is the real second location and should use the same application/database deployment.

Initial operating model:

- Koversada Worker A — Koversada `WORKER`, Aquapark-only interface;
- Vuk — access to Petalon and Koversada; primarily operates Petalon and monitors/manages Koversada;
- Mark — access to both locations; monitors/manages both;
- Vito — Petalon only.

Next season Koversada is expected to have two workers operating simultaneously. They should be separate Auth users with identical Koversada Worker capability rather than sharing one account. Multi-user Realtime and concurrent writes are therefore core requirements, not edge cases.

## Immediate order

1. Finish R2 correction review.
2. Pass affected-iPhone/concurrent-device Preview verification.
3. Merge/deploy R2 only after manual PASS.
4. Observe realistic production behavior.
5. Design/implement the R3 operation/idempotency foundation at the appropriate point before commercial maturity and high-concurrency Koversada use.
6. Resume Step 10 only with the First Incident Never-Again Rules treated as release invariants.

KNO remains separate and untouched.
