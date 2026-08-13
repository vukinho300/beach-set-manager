# Offline Sync and Conflict Resolution

Status: `prototype_decision`

## Goal

Workers should eventually be able to keep working during temporary network loss without silently creating duplicate sales or overwriting conflicting actions.

## Important boundary

The current service worker only caches GET resources. Offline writes are not implemented yet.

Do not build offline mutation sync before the normal online shared database path and server-side concurrency rules are proven.

## Client storage

Use IndexedDB for a durable offline outbox. Do not use localStorage as the future synchronization queue.

Each offline action becomes an immutable operation record with at least:

- `operation_id` — UUID generated once on the client;
- `installation_id` — persistent random device installation identifier;
- `actor_user_id`;
- `location_id`;
- `entity_type` and `entity_id`;
- `operation_type`;
- `payload`;
- `base_version` — version/revision observed before editing;
- `created_at_client`;
- `sync_status`.

## Idempotency

The server stores accepted `operation_id` values with a unique constraint. Retrying the exact same operation must return the original result instead of creating a second transaction.

This solves transport/retry duplicates. It does not by itself decide whether two different devices intended the same business action.

## Optimistic versioning

Mutable operational records should have a server revision/version. Offline operations carry the version the worker saw before making the change.

Server acceptance rule:

- if current server version equals `base_version`, apply the operation and increment the version;
- if the operation ID was already accepted, return the previous result;
- if server version has changed, do not silently overwrite — return a conflict object.

## Same-business-action example

Scenario:

- Vuk offline records Set 40 sale of €12.
- Vito offline independently records the same €12 for Set 40.

These are two different operation IDs, so pure idempotency would not deduplicate them. The business rule must protect the resource.

Recommended model: a numbered-set sale/occupancy command includes the resource and the occupancy epoch/version it was based on. The first accepted operation claims that resource state/version. The second reaches the server with a stale `base_version` and is rejected as a conflict rather than becoming a duplicate sale.

If product testing later proves that truly identical offline commands should be auto-merged, add an explicit deterministic business dedupe key only for that command type. Do not globally dedupe by amount alone.

## Conflicting-price example

- Vuk: Set 40 → €12 from version 7.
- Vito: Set 40 → €16 from version 7.

First operation accepted → Set 40 version becomes 8.
Second operation arrives with base version 7 → server returns conflict.

The client must show both intents and require a worker/manager choice. It must never use last-write-wins for financial or occupancy conflicts.

## Conflict categories

### Safe retry
Same `operation_id`: return prior result.

### Stale harmless operation
For actions that are naturally commutative and explicitly approved as such, server may merge them.

### Business conflict
Different offline intents against the same exclusive state/version: reject and require resolution.

### Financial conflict
Never auto-merge different prices, deletion/void changes, reservation payment changes or transaction corrections.

## Sync sequence

1. User action is validated locally.
2. If online, send immediately using the same operation envelope.
3. If offline, write operation to IndexedDB outbox and update an explicitly marked optimistic local view.
4. On reconnect/app resume, fetch authoritative server state first.
5. Send queued operations oldest-first per dependent entity.
6. Server performs idempotency + authorization + version/conflict checks transactionally.
7. Accepted operations are removed/marked synced locally.
8. Conflicts remain in a visible conflict queue.
9. Realtime/re-query refreshes the authoritative UI.

## Background Sync

Browser Background Sync can be used only as an enhancement because support is not universal. The app must also attempt sync when it opens, regains focus, and receives an `online` event.

## Offline UX

Show a persistent connection state:

- Online
- Offline — N changes waiting
- Syncing
- Conflict requires attention

Financial/operational actions made offline must be visually distinguishable from server-confirmed state until accepted.

## Experiment before implementation

Build a deterministic two-client test harness that simulates Vuk and Vito going offline from the same server revision, issuing commands, and reconnecting in different orders. Record outcomes in [[16_Experiments_and_Evidence]].
