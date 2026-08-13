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
- [ ] Keep the repository/database as technical source of truth and Obsidian as project memory/control manual.

## Roles

### Vuk

Product owner, final decision-maker and approval authority.

### ChatGPT

Architecture, security/product design, research, repository review, Second Brain maintenance and Codex prompt design. It should flag conflicts between documentation and code instead of guessing.

### Codex

Primary implementation agent for the application. Codex should work from explicit architecture/acceptance criteria and must not silently invent platform rules that conflict with the Second Brain.

### Repository

Authoritative for what is implemented.

### Second Brain

Authoritative for accepted architecture, project status, decisions, experiments and future plan, but it does not override verified code/schema evidence.

## Scope boundary for the current chapter

The next implementation chapter is shared persistence, authentication, authorization, realtime collaboration and safe migration from localStorage. Payment-terminal/fiscal integrations remain later work.
