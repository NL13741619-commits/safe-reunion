# Agent MVP

Status: **implemented local/dry-run components; not deployed**.

Implemented on this branch:

- signed GitHub `issues` webhook receiver (`src/webhook.mjs`);
- GitHub Issue structured-task intake (`src/github-issue.mjs`, `src/intake.mjs`);
- immutable actor ID / repository / approval / cost / path policy (`src/policy.mjs`);
- replay primitives (`src/receiver.mjs`) and dry-run state machine (`src/state.mjs`);
- explicitly non-durable in-memory dry-run queue (`src/queue.mjs`);
- gated OpenAI-compatible coding-model HTTP adapter (`src/model.mjs`);
- fixed allowlisted test executor with `shell:false` (`src/executor.mjs`);
- sanitized GitHub Issue reporter (`src/reporter.mjs`);
- Node built-in test suite under `tests/`.

## Dry-run boundary

Automatic product-code mutation, branch push, PR creation, merge, workflow/secrets modification, paid API use, and production deployment remain disabled. The coding-model adapter is real HTTP integration code, but no provider credential/model has been configured or called in this phase. With no approved model it reports `BLOCKED_MODEL_UNAVAILABLE`; paid use is also blocked unless explicitly configured and approved in a later execution phase.

## Local tests

From `agent/`:

```sh
npm test
```

No dependency install is required; tests use Node 20+ built-ins.

## Local fixture dry-run

```sh
AIVAULT_TRUSTED_ISSUER_IDS=305579832 npm run dry-run -- tests/fixtures/issue-2-dry-run.json
```

## Read a structured task from a GitHub Issue

This requires a least-privilege GitHub token at runtime. The Issue must contain a fenced `aivault-agent-task` JSON block conforming to `../contracts/agent-task.schema.json`.

```sh
GITHUB_TOKEN=... \
AIVAULT_TRUSTED_ISSUER_IDS=... \
AIVAULT_ISSUE_NUMBER=2 \
npm run intake
```

Set `AIVAULT_REPORT_TO_ISSUE=true` only when the token is authorized to post the sanitized dry-run result.

## Signed webhook dry-run receiver

```sh
GITHUB_WEBHOOK_SECRET=... \
AIVAULT_TRUSTED_ISSUER_IDS=... \
GITHUB_REPOSITORY=NL13741619-commits/safe-reunion \
npm run webhook
```

The receiver accepts only signed `issues` events, validates immutable sender/repository identity and the zero-cost dry-run policy, and returns a zero-mutation plan. A public HTTPS runtime and GitHub App/webhook registration are still required for a **real GitHub end-to-end delivery**. They are not deployed by this branch.

See `../docs/agent-architecture.md`, `../docs/agent-protocol.md`, `../contracts/agent-task.schema.json`, and `../tests/agent/README.md`.
