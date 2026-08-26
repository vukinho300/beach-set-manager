# Decision Log

Status: `canonical`

- D-001 — `prototype_decision` — Location is the operational tenant boundary; Petalon is location one.
- D-002 — `prototype_decision` — One configurable codebase; no repository clone per customer. Revisit deployment topology only when a second real location requires it.
- D-003 — `prototype_decision` — Shared Postgres/Supabase with tenant isolation is the first backend direction.
- D-004 — `prototype_decision` — Transaction ledger becomes financial truth; assignments/sessions represent operational state. This normalization is not required before Shared Petalon v1.
- D-005 — `prototype_decision` — Use separate development and production data environments when production preparation begins.
- D-006 — `deferred` — Seasonal licensing per location/season remains a possible commercial model but is not part of Shared Petalon v1.
- D-007 — `superseded` — The earlier concurrent active-session/device-seat plan is superseded by D-013; do not implement device/session limits in Shared Petalon v1.
- D-008 — `superseded` — Earlier offline-mutation deferral was superseded by Production Reliability R1 after real phone use proved durable pending-write recovery necessary. The current implementation uses user/location-scoped IndexedDB whole-AppData recovery, not yet the full immutable operation/outbox architecture.
- D-009 — `prototype_decision` — Payment/fiscal integrations are postponed until the shared operational application is stable.
- D-010 — `canonical` — Second Brain is project memory/operating manual; repository, tests, migrations and database remain technical truth.
- D-011 — `prototype_decision` — The product domain is production-branding infrastructure, not a backend prerequisite.
- D-012 — `prototype_decision` — Prefer independent registrar/DNS ownership when production branding is implemented; do not add a paid Supabase custom API domain without a concrete need.
- D-013 — `canonical` — Shared Petalon v1 prioritizes one secure shared Petalon database for Vuk, Vito and Mark. No device-count/session-seat enforcement is required.
- D-014 — `canonical` — Active `location_memberships` enforced by RLS are the immediate application-data access and revocation boundary. Frontend code possession does not grant backend access.
- D-015 — `prototype_decision` — The first shared-state migration uses a minimal versioned `location_state` JSONB record per location rather than normalizing the entire existing `AppData` model up front.
- D-016 — `superseded` — The initial same-UI three-user phase is superseded by D-024 after Shared Petalon v1 and R1 proved stable enough for role differentiation.
- D-017 — `canonical` — Multi-location provisioning/deployment automation is deferred until a second real location exists.
- D-018 — `canonical` — Customer-facing ownership/infrastructure concealment remains important before broader external rollout but is deferred until the shared product works.
- D-019 — `canonical` — ChatGPT maintains the Second Brain; Codex is the coding agent and must not edit `Second_Brain/` unless Vuk explicitly requests an exception.
- D-020 — `canonical` — Codex normally runs through the local terminal checkout. Repository-file access comes from the local clone; external provider access is granted only through the relevant local authenticated CLI when a step actually needs it.
- D-021 — `canonical` — Prefer the simplest reliable verification path. If a short manual action by Vuk is faster, simpler or clearer than agent automation, hand that action to Vuk instead of spending tokens automating it.
- D-022 — `canonical` — Codex must not loop indefinitely on credential/browser/provider blockers. After at most two sensible attempts at the same external-tool blocker, stop and request one exact manual action from Vuk, then resume from a verified state.
- D-023 — `canonical` — Privileged credentials are never placed in Codex prompts, committed files or the Second Brain. Supabase/Vercel/GitHub access should use supported local authentication flows and ignored local credential/environment storage.
- D-024 — `canonical` — Petalon uses three distinct membership roles: Vuk=`PLATFORM_OWNER`/Platform Admin, Mark=`LOCATION_ADMIN`/Location Owner, Vito=`WORKER`. Mark is the Petalon owner/manager; Vuk is the software/platform administrator. All three retain normal operations, while location-management/destructive shared UI is available to Vuk and Mark but not Vito.
- D-025 — `canonical` — Role identity must come from the current authenticated user's RLS-readable Petalon `location_memberships` row. Do not infer authorization from email, name, `user_metadata` or a frontend person/UUID map.
- D-026 — `canonical` — Current role-aware Import/Full Reset visibility is a product/UI capability boundary, not complete semantic action-level DB authorization. Because active users need broad revision-safe updates to the shared `location_state` JSONB row, truly confidential owner data or server-enforced owner-only commands require a separate RLS-protected trusted boundary.
- D-027 — `prototype_decision` — The next owner-focused product area is a Mark Location Owner Dashboard built on `LOCATION_ADMIN`. Define its business questions first; do not build a generic admin console or confuse hidden Worker UI with confidential owner data.
- D-028 — `canonical` — A paid Set's persisted historical price/revenue is not the next payment intent. Each Set editor opens with a fresh payment draft; clearing the editor draft must never erase historical transaction/revenue/report data.

A decision may only be replaced by a new recorded decision explaining what it supersedes and why.
