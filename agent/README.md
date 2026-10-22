# Agent MVP Scaffold

Status: **not deployed; dry-run design scaffold only**.

This directory reserves implementation boundaries for the autonomous coding agent requested by Issue #2. No file in this scaffold claims that a webhook service, coding model, queue, or autonomous branch writer is running.

Planned modules:

- `receiver/` — GitHub App webhook verification and Issue reference extraction.
- `policy/` — trusted issuer/repository/approval/path/cost checks.
- `state/` — task state machine and idempotency/replay store.
- `queue/` — durable queue adapter.
- `github/` — least-privilege GitHub installation-token adapter.
- `model/` — authorized coding-model adapter; missing configuration must block.
- `executor/` — disposable sandbox and fixed allowlisted tests.
- `reporter/` — sanitized Issue/PR status and audit evidence.

## Current execution boundary

Only dry-run parsing/planning is authorized. Automatic product-code mutation, branch push, PR creation, merge, workflow/secrets modification, paid API use, and production deployment remain disabled until separately approved.

See `docs/agent-architecture.md`, `docs/agent-protocol.md`, `contracts/agent-task.schema.json`, and `tests/agent/README.md`.
