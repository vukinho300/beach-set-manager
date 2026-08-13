# Second Brain Operating System

Status: `canonical`

## Source-of-truth hierarchy

1. Running code and tests.
2. Database schema and migrations once introduced.
3. Production data/audit evidence.
4. Canonical Second Brain notes and Decision Log.
5. Experiments and temporary design notes.
6. Old conversations/archive.

## Note lifecycle

Use: `canonical`, `draft`, `experiment`, `superseded`, `archive`.

## Design maturity

Use: `hypothesis`, `prototype_decision`, `experiment_supported`, `production_approved`.

## Session rule

For every project response: call the user Vuk, read relevant Second Brain notes first, compare with repository evidence when implementation matters, preserve recorded decisions, and finish with **Second Brain Changes** listing exact documentation updates or saying none are needed.

Do not create duplicate canonical notes when an existing note can be updated.
