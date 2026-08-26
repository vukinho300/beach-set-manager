# Offline Sync and Conflict Resolution

Status: `prototype_decision`

## Goal

Workers must not silently lose a submitted Beach or Aquapark change during temporary mobile-network loss, app suspension or reopen. Supabase remains authoritative; local durability exists only to preserve unconfirmed work until it is either accepted or deliberately resolved.

## Production evidence — 2026-08-26

Real phone use at Petalon proved the earlier fully-online assumption insufficient:

- normal realtime refreshes visibly replaced the app with the shared-data loading screen and reset scroll/work position;
- Vuk observed entries disappear after connection failures;
- Vito independently reported Aquapark entries disappearing after refresh/unavailable events;
- the operational consequence is severe because workers may no longer remember wristband/set numbers after physically moving on.

This evidence moved durable pending-write protection from deferred work into the current required production architecture.

## Production Reliability R1 — PR #17, independently reviewed pending merge

R1 adds a deliberately narrow durability layer around the existing whole-AppData revision model.

### What R1 implements

- Supabase remains the server-confirmed source of truth.
- Retryable save failures keep the optimistic local state visible instead of immediately destroying the operational UI.
- The latest unconfirmed AppData snapshot is persisted in IndexedDB before it can be treated as safely retryable.
- Pending recovery records are scoped by authenticated `userId + locationId`.
- Records preserve the server base revision/state, desired local state, timestamps and last attempted revision/state where applicable.
- Retries use bounded backoff and also resume on browser `online`, focus and visibility/resume events.
- Accepted server saves clear the pending record only after acceptance/recognition.
- If the response was lost but the server already contains the exact attempted state, recovery recognizes that fact rather than duplicating the mutation.
- If the server changed incompatibly, pending local work remains preserved and the controller enters a conservative conflict state.
- A very narrow Beach-set rebase is allowed only for **unattempted** pending snapshots where non-set fields are unchanged and every locally changed set is either unchanged on the server or already equal to the desired value.
- Any valid prior attempted-save metadata creates an ambiguity barrier unless the server explicitly proves that attempted state was accepted. This prevents stale recovery data from resurrecting a later legitimate Beach state.
- Account switch/sign-out cannot expose or submit another user's pending work.
- RLS revocation remains authoritative; IndexedDB is not an authorization bypass.

### What R1 does NOT implement

R1 is **not** the full future offline command/outbox architecture described below:

- no immutable per-business-operation command log;
- no server-side operation-id idempotency table;
- no per-entity normalized versions;
- no arbitrary multi-user offline auto-merge;
- no service-worker Background Sync requirement;
- no local operational database replacing Supabase.

It is a pragmatic durability buffer for the current JSONB/AppData model, introduced because real production usage proved silent loss was unacceptable.

## UI continuity and background convergence

R1 also separates initial/blocking load from background authoritative refresh:

- cold startup still verifies Auth and authoritative shared access before editable use;
- after a valid snapshot exists, realtime/reconnect refresh runs in the background and keeps the operational app mounted;
- authoritative server snapshots are applied in place;
- only an exact server snapshot echo is suppressed from the local-save path;
- an interleaved worker mutation is always forwarded to the shared controller and pending durability path;
- active tab and per-tab scroll position are stored separately under UI-only localStorage state;
- UI continuity localStorage contains no operational AppData.

## Current conflict categories

### Safe accepted/ambiguous retry
If the server proves it already contains the exact desired/attempted state, treat the operation as accepted and clear/recover safely without duplicate submission.

### Narrow compatible Beach recovery
Only for an **unattempted** pending AppData snapshot. Non-set fields must equal the base. Each changed set must be unchanged on the server or already identical to the desired set state. Anything else is a conflict.

### Business/financial conflict
Do not force overwrite. Preserve pending work and require deliberate recovery. Aquapark, reservations, sales, transactions and other non-set changes are not broadly auto-rebased.

## Future full offline command architecture

If sustained real-world use proves that workers must continue for long periods while fully offline or that whole-AppData conflict frequency becomes unacceptable, evolve beyond the R1 snapshot buffer.

The future model should use IndexedDB with immutable operation records including at least:

- `operation_id` — UUID generated once on the client;
- `installation_id` — persistent random device installation identifier;
- `actor_user_id`;
- `location_id`;
- `entity_type` and `entity_id`;
- `operation_type`;
- `payload`;
- `base_version`;
- `created_at_client`;
- `sync_status`.

The server should store accepted `operation_id` values with a unique constraint so retrying the exact same operation returns the prior result rather than creating a duplicate.

Per-entity optimistic versions should then protect exclusive occupancy/financial changes. Different offline intents against the same resource/version must conflict rather than use last-write-wins.

## Background Sync

Browser Background Sync may be used only as an enhancement because support is not universal. Current R1 correctly relies on normal app lifecycle recovery (`online`, focus, visibility/resume) and does not require service-worker mutation sync.

## Offline UX

Current/near-term UI states should clearly distinguish:

- server-confirmed saved state;
- saving;
- pending / not saved yet but preserved on this device;
- connection stale while confirmed state remains visible;
- conflict requiring attention.

Never claim an IndexedDB-pending mutation is server-confirmed before Supabase accepts it.
