# Experiments and Evidence

Status: `experiment`

No shared-backend experiment has been run yet.

Planned evidence sequence:

- E-001 — Two authenticated devices load and update the same Petalon Beach/Bed state.
- E-002 — Two users attempt to change the same numbered set concurrently; only one exclusive claim succeeds.
- E-003 — Retrying the same operation ID does not duplicate a transaction.
- E-004 — Two offline clients submit the same Set 40 intent from the same base version; verify safe conflict/dedupe behavior.
- E-005 — Offline Set 40 €12 versus €16 creates an explicit conflict and never silent overwrite.
- E-006 — Queued offline operations reconnect in different orders without corrupting transaction/resource state.
- E-007 — Tenant isolation test proves a user from Location A cannot read or mutate Location B.
- E-008 — Concurrent session-seat claims do not exceed the licensed limit.
- E-009 — Preview/development deployment cannot reach production data.
- E-010 — Seasonal backup can be restored into a clean environment before winter shutdown is trusted.

Each experiment must record setup, initial state, steps, expected result, actual result, evidence, conclusion and architecture impact.
