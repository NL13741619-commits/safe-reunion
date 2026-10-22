# AIVAULT Second-Base Autonomous Coding Agent Architecture

Status: MVP design / dry-run only  
Issue: AIVAULT-002  
Date: 2026-10-22

## Decision

Preferred production-capable design: **GitHub App webhook + external controlled ephemeral worker**.

GitHub Issues are the command transport, not the execution runtime. GitHub Pages is never treated as a backend. A webhook receiver verifies GitHub delivery authenticity, loads the referenced Issue through the GitHub App installation identity, validates the structured task against `contracts/agent-task.schema.json`, and places an accepted task in an isolated queue. An ephemeral worker then performs planning/testing and, only after a separate execution-mode approval, may create an isolated branch and PR.

The MVP in this branch is **dry-run only**. It may parse an approved task and emit a plan/status. It does not autonomously modify product code, push branches, create PRs, deploy, change secrets, or call paid model APIs.

## Components

1. **Webhook receiver** — verifies delivery signature/event/repository and extracts the Issue identifier. No Issue text is executed.
2. **Task validator** — JSON Schema validation plus issuer/repository/base/path/cost/approval policy checks.
3. **Authorization policy** — allowlisted issuer IDs and repository installation identity; authorization is based on trusted GitHub identity/installation metadata, not a username copied into Issue text.
4. **Replay guard** — stores GitHub delivery ID + `task_id`; duplicates are idempotently rejected/acknowledged.
5. **State machine** — queued → accepted → running → blocked/pr_open/review_requested/done/failed. Dry-run stops before mutation.
6. **Task queue** — production recommendation is a durable queue owned by the external runtime. Dry-run can use an in-memory adapter only when clearly labelled non-durable.
7. **Coding Model adapter** — must call a configured, authorized real model or return `BLOCKED_MODEL_UNAVAILABLE`. No fake patch generation.
8. **GitHub adapter** — installation-token client with repository-scoped permissions. Runtime API identity is separate from development identity.
9. **Test executor** — fixed allowlisted commands/configuration; task text cannot inject arbitrary shell.
10. **PR builder** — disabled in dry-run. Execution mode may create feature branches/PRs only after owner approval.
11. **Audit/status reporter** — records state transitions, sanitized evidence, costs and failure reason; never logs tokens/secrets.

## Threat model and controls

| Threat | Required control |
|---|---|
| Forged Issue issuer | Resolve immutable GitHub actor ID and installation/repository metadata; allowlist trusted issuer IDs. |
| Webhook spoofing | Verify GitHub webhook HMAC signature and delivery metadata before enqueue. |
| Replay attack | Unique delivery ID + unique `task_id`, durable idempotency record, reject conflicting duplicates. |
| Prompt injection in Issue/PR | Treat all natural-language content as untrusted data; never convert it directly to shell, workflow, secret, or policy instructions. |
| Path traversal / overreach | Normalize paths and require every write to be within `allowed_paths`; deny `.github/workflows`, secrets/config and `main` unless separately approved. |
| Arbitrary command execution | Fixed test command allowlist; no task-provided shell. Run in disposable sandbox with resource/time limits. |
| Secret exfiltration | No secrets in model prompt; least-privilege short-lived tokens; redact logs; egress allowlist. |
| Cost abuse | `max_cost` hard ceiling; paid model disabled unless both task policy and owner configuration allow it. |
| Infinite retry | Bounded retries with backoff; terminal failed/blocked state. |
| Cross-task contamination | One ephemeral workspace/container per task; destroy after completion. |
| Supply-chain abuse | Pin runner dependencies/actions by version/digest where practical; no arbitrary dependency install from Issue text. |

## Minimum GitHub permissions

Recommended GitHub App installation permissions for execution mode:

- Metadata: read
- Contents: read/write (feature branches only, enforced by policy)
- Pull requests: read/write
- Issues: read/write (task/status comments)
- Checks: read
- Actions: read

Not granted to the agent: Administration, Secrets/Variables management, Workflows write, branch protection changes, repository deletion. Automatic merge is prohibited.

Dry-run can use a stricter identity: Metadata read, Contents read, Issues read/write only as required for status reporting, Actions/Checks read for evidence. No contents write is required for a truly deployed dry-run runner.

## Runtime options

### A. GitHub App + external ephemeral worker — recommended

Trigger: GitHub webhook.  
Runtime: small HTTPS webhook service plus queue and ephemeral container/job worker.  
Advantages: precise installation permissions, durable replay protection, network isolation, predictable task sandboxing, independent scaling.  
Cost: GitHub App itself has no required per-request hosting fee, but external compute/storage/network and the coding model can incur provider charges. Exact cost is **TBD until a hosting/model provider is selected and current quotas are verified**.

### B. Restricted GitHub Actions + authorized coding service

Trigger: approved Issue workflow/event or manual dispatch.  
Advantages: less external infrastructure for early tests.  
Risks: workflow permissions/secrets and untrusted text require strict separation; Actions minutes/runner limits apply; modifying workflow files is a privileged change.  
Cost: depends on repository/account Actions allowance and any external model API. Must be checked before deployment.

Decision: use A for the real autonomous runner. Use B only for non-secret contract/test automation or a deliberately approved prototype.

## Coding model requirement

No model is selected or configured by this commit. Before execution mode, owner must explicitly choose one of:

- an already-authorized external coding-model API, with server-side credentials and hard cost limit; or
- a self-hosted model reachable only from the worker environment.

If no authorized model is configured, the agent must enter `blocked` with reason `BLOCKED_MODEL_UNAVAILABLE`; it must not invent a patch.

## Dry-run for Issue #2

Expected dry-run pipeline:

1. Receive/identify Issue #2.
2. Verify repository and trusted issuer identity.
3. Parse a structured task payload; reject prose that does not satisfy the schema as executable instructions.
4. Validate approval mode is `dry-run` and cost does not exceed policy.
5. Produce a sanitized execution plan listing allowed paths, acceptance tests and blocked mutation steps.
6. Report `accepted`/`running`, then `done` for plan generation or `blocked` for missing prerequisites.
7. Do not modify application code or production systems.

The current ChatGPT-assisted GitHub work is not the deployed webhook runner and must not be presented as end-to-end autonomous triggering.

## Human approvals still required

- hosting/runtime provider and budget;
- GitHub App creation/installation and exact permissions;
- webhook secret storage;
- coding model/provider and API budget;
- switch from dry-run to execution mode;
- any workflow-file change beyond the already reviewed contract CI;
- production deployment;
- merge to `main`.
