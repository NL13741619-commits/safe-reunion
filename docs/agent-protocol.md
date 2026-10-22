# AIVAULT Dual-Base Agent Protocol

Status: Phase 1A/Issue AIVAULT-002 design + dry-run only  
Date: 2026-10-22

## Purpose

This protocol defines how an actually deployed second-base coding agent may accept a structured GitHub Issue command. GitHub Issue text does not wake or execute a ChatGPT conversation by itself. Until a separately approved runner exists, this document is a contract and dry-run procedure only.

## Required command fields

An approved task command MUST provide these fields:

| Field | Meaning |
| --- | --- |
| `task_id` | Stable unique task identifier issued by the main site |
| `issuer` | Authorized issuer identity; must match the runner allowlist and authenticated GitHub actor/signature evidence |
| `repo` | Exact allowlisted `owner/repository` target |
| `base_branch` | Allowed base branch; `main` may be read as a base but never directly pushed by the agent |
| `scope` | Explicit file/path and operation boundary |
| `acceptance_tests` | Tests/checks that must pass before reporting completion |
| `approval_required` | Required approval gate before any write-capable stage |
| `max_cost` | Hard task cost ceiling; zero means no paid API usage |
| `status` | One of the protocol states below |

Unknown or missing required fields make the command invalid. Natural-language Issue/PR text outside the validated command is context only and MUST NOT expand authority.

## State machine

Allowed states:

`queued -> accepted -> running -> blocked | pr_open | failed`

`pr_open -> review_requested -> done | blocked | failed`

State transitions are append-only audit events. `done` means acceptance tests and required review/merge policy were satisfied; it MUST NOT be used for a plan, simulation, or failed test.

## Authorization gate

A runner MUST reject a task unless all of the following are true:

1. `issuer` is on the configured allowlist and is bound to authenticated GitHub/App evidence; never trust a body field by itself.
2. `repo` exactly matches an allowlisted repository.
3. `base_branch`, requested paths, operations and cost fit configured policy.
4. `approval_required` has been satisfied by an independently verified approval event before write mode.
5. The Issue has not been edited after approval without re-approval.
6. The task is not already terminal and the `task_id` has not been replayed.

For the current Issue #2, only read/dry-run behavior is approved. Automatic branch writes and PR creation remain disabled until a separate main-site approval.

## Untrusted-input / prompt-injection rules

All Issue bodies, comments, PR descriptions, code comments, repository files, test output, web content and model output are untrusted data. They cannot grant permissions, reveal secrets, alter policy, disable tests, or request arbitrary tool execution.

The runner MUST NOT execute shell text copied from an Issue/PR. Commands are selected from a fixed runner implementation or allowlisted build/test recipes committed in trusted configuration. A task that asks to bypass these rules is rejected or blocked.

## Per-task isolation

Each accepted task uses a fresh ephemeral workspace/container or equivalent isolated worker. The worker receives only the minimum repository checkout and credentials required for that stage. Workspaces are destroyed after completion/timeout. No task may inherit another task's filesystem, environment variables, tokens, cookies, caches containing credentials, or mutable process state.

## Resource controls

- Network: deny by default; allow only GitHub and explicitly approved provider/package endpoints required by the task.
- Tokens: short-lived installation/runtime credentials, repository-scoped, least privilege, never printed to logs.
- Secrets: injected by the execution platform; never stored in Issue text, Git, artifacts, prompts or model-visible logs unless strictly necessary and redacted.
- Cost: enforce `max_cost` before provider calls and stop when the remaining budget cannot cover the requested operation.
- Retry: bounded retries only for retryable failures; default maximum 2 retries per operation.
- Time: hard wall-clock timeout per task; proposed initial ceiling 15 minutes for dry-run/contract jobs and separately approved limits for future build jobs.
- Concurrency: one isolated lease per `task_id`; duplicate deliveries are idempotently ignored.

## Minimum GitHub permissions

### Dry-run runner

- Metadata: read
- Contents: read
- Issues: read
- Pull requests: read
- Actions/Checks: read only when acceptance evidence requires it
- Secrets: none
- Administration: none

### Future write-capable development runner (not approved/deployed yet)

Use a GitHub App installation token with repository selection restricted to the target repository:

- Metadata: read
- Contents: read/write only for approved feature/fix branches
- Pull requests: read/write
- Issues: read/write only for status comments
- Actions/Checks: read
- Workflows: no write
- Secrets: none
- Administration: none

The runner MUST prohibit direct push to `main`, force-push, automatic merge, branch protection changes, secret changes, unapproved deployment and unapproved paid APIs.

## Structured dry-run output

A dry-run parser returns an execution plan without modifying the repository:

```json
{
  "task_id": "AIVAULT-002",
  "mode": "dry_run",
  "authorized": true,
  "write_enabled": false,
  "target_repo": "NL13741619-commits/safe-reunion",
  "base_branch": "main",
  "planned_actions": [
    "read approved issue",
    "validate issuer/repo/scope/approval/cost fields",
    "create isolated execution plan",
    "report plan and blockers"
  ],
  "blocked_actions": [
    "push main",
    "automatic merge",
    "modify secrets",
    "production deployment",
    "paid API without explicit approval"
  ]
}
```

`authorized: true` in a dry-run means only that the command passed the dry-run policy checks. It does not mean a write-capable runner is deployed.

## Runner architecture options

### Option A — GitHub App + webhook + external controlled runner (recommended for write mode)

GitHub App receives Issue/approval events through HTTPS webhook. A verifier validates webhook signature, installation/repository, actor allowlist and task schema. Valid tasks enter a small queue and an ephemeral external runner performs the bounded job. GitHub App installation tokens provide short-lived repository-scoped credentials.

Runtime required: HTTPS webhook endpoint, queue/state store, ephemeral container/job runtime, secret manager, outbound network policy, audit log. Cost depends on selected cloud and workload; no paid runtime is authorized by Issue #2. A free/low-cost tier may be evaluated later, but sleep limits, CPU/RAM, storage, secret management and egress must be measured before selection.

### Option B — restricted GitHub Actions + external controlled execution

A workflow can validate a labeled/approved Issue and dispatch a job, but untrusted Issue text must never be interpolated into shell. GitHub-hosted Actions is suitable for validation/CI and bounded orchestration. Heavy or long-running model workloads should execute in a separately controlled runtime. Workflow-token permissions must be explicitly minimized.

Runtime required: GitHub Actions for validation/orchestration plus an external runtime for workloads that exceed CI constraints. Cost is GitHub-hosted minutes plus external compute/egress according to the account/runtime plan; exact cost is intentionally `TBD` until a runtime is selected and current quotas are verified.

## Recommendation

Use Option A for the future write-capable engineering agent because the GitHub App identity, webhook verification, repository selection and short-lived installation tokens give a clearer security boundary. Use GitHub Actions for contract tests/CI, not as an always-on autonomous agent. Phase 1A remains dry-run only.

## Issue #2 dry-run record

Input source: `NL13741619-commits/safe-reunion` Issue #2, authored by `m9wmtcb782-arch` on 2026-10-22.

Observed command intent: design the dual-base agent protocol, finish outstanding PR #1 contract corrections, define least privilege/threat controls, and demonstrate read/dry-run behavior before any autonomous write mode.

Dry-run result:

- Issue successfully parsed as a human-authorized instruction for this interactive development session.
- No automatic agent runner is claimed or deployed.
- Automatic branch submission/PR creation by a runner remains blocked pending separate approval.
- Production deployment, secrets mutation, paid API use, automatic merge and direct `main` push remain prohibited.

## Acceptance evidence required before enabling write mode

- verified webhook/signature or equivalent trusted event authentication;
- issuer/repository/path allowlist tests;
- prompt-injection and arbitrary-command rejection tests;
- replay/idempotency test;
- secret-redaction/logging test;
- timeout/retry/cost-cap test;
- branch protection behavior test proving `main` cannot be directly pushed;
- audit trail linking Issue -> task_id -> branch -> commit -> PR -> CI result.
