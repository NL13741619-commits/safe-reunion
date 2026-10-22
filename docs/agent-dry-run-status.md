# AIVAULT-002 Dry-Run Implementation Status

Date: 2026-10-22

## Implemented in PR #3

The branch now contains runnable Node 20+ components for a **zero-mutation dry-run agent**:

- signed GitHub Issues webhook receiver;
- structured Issue task extraction;
- immutable sender/repository checks;
- runtime task-shape + policy validation;
- replay/idempotency primitives;
- task state machine;
- non-durable dry-run queue and worker;
- fixed allowlisted test executor (`shell:false`);
- GitHub API adapter and sanitized Issue reporter;
- gated OpenAI-compatible coding-model adapter;
- approval-gated PR builder that currently refuses mutation;
- unit tests for the above boundaries.

## What has not happened

There is **no deployed public webhook runtime yet**, therefore no claim is made that GitHub itself has delivered a real webhook to this code. The current branch also has no authorized coding-model credential, so no real model call has occurred. No paid API was called. No autonomous product-code modification or PR creation has been enabled.

## Required to perform the real GitHub end-to-end dry-run

1. User/main-site selects and authorizes a server/worker runtime with public HTTPS.
2. Create/install a least-privilege GitHub App or repository webhook and store its webhook secret server-side.
3. Configure the immutable trusted issuer ID allowlist.
4. Publish a schema-valid fenced `aivault-agent-task` block in an approved Issue.
5. Deliver the Issue event to the deployed `/github/webhook` endpoint.
6. Capture delivery ID, signature verification result, state log, zero-mutation result and measured cost (expected zero for this stage).

## Required before real AI coding

Separately approve a real coding model/provider and budget. The adapter can call an OpenAI-compatible chat-completions endpoint once credentials/configuration are provided in the server environment, but dry-run policy currently prohibits paid API use and execution-mode mutation. If no authorized model is configured, the truthful status remains `BLOCKED_MODEL_UNAVAILABLE`.

## Required before automatic code/PR mutation

Explicitly approve execution mode after dry-run review. Then implement/enable a write-capable GitHub installation token, sandboxed workspace patch application, path enforcement at write time, real test execution, feature-branch commit/push and PR creation. Automatic merge, direct `main`, secrets/workflow mutation and production deployment remain prohibited.
