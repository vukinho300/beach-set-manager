# Risk Register

Status: `canonical`
Last reviewed: 2026-08-27

## Critical — silent operational data loss

**Evidence:** First Incident, 2026-08-27. Roughly twenty visible iPhone PWA entries never reached Supabase during a real round.

Required mitigation before broader/commercial production:

- explicit mutation admission;
- bounded local durability operations;
- fail-closed operational UI when durability is unsafe;
- independent recovery path(s);
- privacy-safe client pipeline telemetry;
- immutable server history;
- realistic affected-device lifecycle and concurrent-worker release testing;
- progression toward immutable operation IDs and idempotent server commands.

Reference: [[18_Production_Incidents_and_Never_Again_Rules]].

## Critical — simultaneous multi-user write contention

Petalon already has concurrent users. Koversada will be monitored by Vuk/Mark while a worker operates it, and is expected to have multiple worker devices next season.

Current whole-`AppData` location revision CAS prevents silent overwrite but can create contention between independent business actions. Long-term mitigation is per-operation idempotency plus per-entity/versioned write boundaries rather than one whole-location replacement document.

## High — false safety reactions to legitimate Realtime

Incoming authoritative updates must not be classified as unsent local mutations. A normal remote save must not lock another worker or cause false STOP behavior. Interleaved local work must still be preserved and admitted safely.

## High — cross-location data exposure

RLS membership remains the security boundary. Vito must not see Koversada; Koversada workers must not see Petalon. Vuk/Mark can access both according to active memberships.

## High — ambiguous/retried financial operations

A lost response must not duplicate a payment/transaction on retry. Future operation IDs must be unique/idempotent and financial corrections should use explicit reversal/void records rather than hard deletion.

## High — browser/PWA lifecycle failure

Frequent Home Screen PWA close/reopen, background/foreground and phone lock/unlock are normal work. Any architecture relying on one long-lived browser handle/session must be tested against this lifecycle.

## High — development/production mixing

Preview/fault-injection paths must never be enabled accidentally in Production. KNO remains unrelated and must never be linked/touched.

## High — privileged credential exposure

No browser service-role key, database password or Auth-admin secret. Privileged actions require narrow server/RPC boundaries with RLS/membership validation.

## Medium — backup/recovery limits

Server revision history and future operation history protect accepted data. Database backup/PITR should be evaluated before commercial rollout. Neither can recover a mutation that never reached durable device/server storage.

## Medium — large App.tsx/App.css regression surface

The monolithic UI increases the chance that reliability, Realtime and local UI-state behavior become coupled. Refactor only where evidence justifies it, but reliability boundaries should increasingly live in dedicated tested services.

Every critical/high risk must have a tested mitigation before commercial production.
