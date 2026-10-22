# Security Baseline

Status: Phase 1A  
Date: 2026-10-22

## Non-negotiable rules

- HTTPS is required outside local development.
- No API key, provider secret, private signing key, GitHub token, or Supabase `service_role` key may be committed to Git.
- The second base does not receive AIVAULT's database administrator credentials.
- Runtime service identity and GitHub development identity are separate.
- Production `main` is not modified by automated development work in Phase 1A.
- Paid providers are disabled unless explicitly authorized and configured by the owner.
- Mock/stub responses must be clearly marked and can never be reported as successful real inference/search.

## JWT validation

Gateway must reject a request unless all required checks pass:

- signature is valid against configured trusted signing material/JWKS;
- `iss` exactly matches an allowlisted issuer;
- `aud` contains the configured second-base audience;
- `exp` is in the future with only a small configured clock-skew allowance;
- `sub` is present;
- `jti` is present;
- `scope` contains every endpoint-required scope.

Recommended additional controls: `nbf`, short token lifetime, signing-key rotation, replay controls for sensitive mutations, and revocation/denylist support where required.

Authorization must not depend only on a broad scope. Tenant and document grants must be checked for every knowledge request.

## Scopes

- `search:read`
- `knowledge:read`
- `knowledge:write`
- `reason:execute`
- `models:invoke`
- `jobs:create`
- `jobs:read`
- `jobs:cancel`
- `usage:read`
- `media:generate` (future)
- `admin:deploy` (separate privileged identity; not granted to normal runtime)

## Request safety

- Accept `X-Request-ID`; preserve caller ID and map to internal UUID v7 when necessary.
- Mutation/job endpoints should accept `Idempotency-Key` and reject unsafe duplicate processing.
- Apply request-size limits, schema validation, timeouts, rate limits, and per-tenant quotas.
- Do not log Authorization headers, raw tokens, secrets, or unnecessary copyrighted document text.

## Knowledge isolation

A valid `knowledge:read` scope does not authorize every book. The Gateway must verify tenant/user grant + `book_id`/collection authorization before retrieval. Index writes require `knowledge:write` plus resource authorization.

Private/rights-restricted books must not be committed to this public repository. Test fixtures in Git must be self-authored, public-domain, or otherwise explicitly redistributable.

## Provider security

Provider credentials are server-side secrets only. Model/Search adapters expose normalized status and usage, not raw credentials. Provider errors may be retained in protected logs, while public API responses use normalized error codes.

## Error policy

Normalized codes include `UNAUTHORIZED`, `FORBIDDEN`, `INVALID_REQUEST`, `KNOWLEDGE_NOT_FOUND`, `INSUFFICIENT_EVIDENCE`, `MODEL_UNAVAILABLE`, `PROVIDER_QUOTA_EXCEEDED`, `TIMEOUT`, and `INTERNAL_ERROR`.

Errors must never be converted into fabricated successful answers.

## GitHub separation

Runtime API services have no GitHub write permission. A Development Agent may work only through approved feature/fix branches and PRs. No force push, branch deletion, automatic merge, workflow modification, repository administration, or secrets management is part of Phase 1A.