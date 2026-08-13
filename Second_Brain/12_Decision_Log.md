# Decision Log

Status: `canonical`

- D-001 — `prototype_decision` — Location is the operational tenant boundary; Petalon is location one.
- D-002 — `prototype_decision` — One configurable codebase; no repository clone per customer.
- D-003 — `prototype_decision` — Shared Postgres/Supabase with tenant isolation is the first backend direction.
- D-004 — `prototype_decision` — Transaction ledger becomes financial truth; assignments/sessions represent operational state.
- D-005 — `prototype_decision` — Use separate development and production data environments.
- D-006 — `prototype_decision` — Seasonal licensing is per location and per season.
- D-007 — `prototype_decision` — Limit concurrent active sessions rather than permanently fingerprinting devices.
- D-008 — `prototype_decision` — Offline mutations use operation IDs and version/conflict checks; no silent last-write-wins for money or occupancy.
- D-009 — `prototype_decision` — Payment/fiscal integrations are postponed until the shared operational platform is stable.
- D-010 — `canonical` — Second Brain is project memory/operating manual; repository, tests, migrations and database remain technical truth.

A decision may only be replaced by a new recorded decision explaining what it supersedes and why.
