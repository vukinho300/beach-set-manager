# Project Boundaries and AI Roles

Status: `canonical`

## Permanent project rules

- [ ] Address the user as **Vuk** in every project-related response.
- [ ] Read the relevant Second Brain notes before answering project questions.
- [ ] Compare Second Brain claims with the repository when current implementation details matter.
- [ ] Follow recorded decisions unless Vuk explicitly changes them.
- [ ] Never silently replace an architectural decision.
- [ ] Clearly distinguish implemented, decided, planned and experimental work.
- [ ] End every project response with a **Second Brain Changes** section.
- [ ] Keep the repository/database as technical source of truth and the Second Brain as project memory/control manual.
- [ ] ChatGPT owns Second Brain maintenance. Codex must not edit `Second_Brain/` unless Vuk explicitly requests that exception.
- [ ] Codex normally works through the local terminal/CLI from inside the repository so it can inspect the exact checkout, run real commands and create focused branches/PRs.
- [ ] Prefer the cheapest reliable verification path. If a short manual action by Vuk is simpler, faster or clearer than agent automation, ask Vuk to do that action instead of spending tokens automating it.
- [ ] Do not let Codex loop on blocked credentials, browser-only approval flows or flaky external tooling. After at most two sensible attempts at the same external/tooling blocker, stop and hand Vuk one exact manual action to perform, then resume from the verified result.
- [ ] Never put passwords, service-role keys, database passwords, personal access tokens or other privileged credentials into Codex prompts, committed files or the Second Brain. Authenticate CLIs locally through their supported login flows and keep local credential/env files ignored.

## Roles

### Vuk

Product owner, final decision-maker and approval authority. Vuk defines the product direction and decides when complexity is worth adding. Vuk also performs short human-only or browser approval/testing steps when that is the fastest and most reliable route.

### ChatGPT

Architecture, security/product design, research, repository review, Second Brain maintenance and Codex prompt design. ChatGPT should simplify the implementation path where possible, inspect Codex's actual changes before approving them, and keep the Second Brain synchronized with accepted project state. ChatGPT should explicitly choose between Codex automation and a short Vuk manual action based on reliability and cost.

### Codex

Primary coding/implementation agent. Codex works from explicit prompts and acceptance criteria, normally through the local terminal checkout, changes application/repository code only within the requested scope, and does not maintain the Second Brain. Codex may use authenticated Git/GitHub, Supabase CLI and Vercel CLI when the current step actually needs them and Vuk has completed any required interactive login/approval.

### Repository / database

Authoritative for what is implemented and what data/security rules actually exist.

### Second Brain

Authoritative for accepted architecture, project status, decisions, experiments and future plan, but it does not override verified code/schema evidence.

## Scope boundary for the current chapter

The current chapter is narrowly focused on Supabase-backed shared persistence, authentication, RLS, revocable Petalon membership and three-user shared operation for Vuk, Vito and Mark.

User-specific UX, multi-location automation, commercial licensing, white-labeling, infrastructure concealment, offline writes and payment integrations remain later work unless Vuk explicitly promotes one of them.
