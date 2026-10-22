# API Contract — Phase 1A

Canonical machine-readable contract: `contracts/openapi.yaml`.

## Transport

Production/staging calls use HTTPS and JSON. Base path is `/v1` except `GET /health`.

Required protected-request headers:

- `Authorization: Bearer <short-lived JWT>`
- `Content-Type: application/json` for JSON bodies
- `X-Request-ID` recommended; UUID v7 preferred
- `Idempotency-Key` required by future non-idempotent job creation where retry duplication is possible

## JWT

Required claims: `iss`, `aud`, `sub`, `exp`, `jti`, `scope`.

Scopes are endpoint permissions, not document permissions. Knowledge endpoints additionally verify tenant/document grants.

## Endpoint baseline

| Method | Path | Scope | Phase 1A status |
|---|---|---|---|
| GET | `/health` | public | contract only |
| GET | `/v1/capabilities` | authenticated | contract only |
| GET | `/v1/models` | authenticated | contract only |
| POST | `/v1/search` | `search:read` | contract only |
| POST | `/v1/knowledge/query` | `knowledge:read` | contract only |
| POST | `/v1/reason` | `reason:execute` + knowledge/model scopes as needed | contract only |
| POST | `/v1/chat/completions` | `models:invoke` | contract only |
| POST | `/v1/jobs` | `jobs:create` | contract only |
| GET | `/v1/jobs/{id}` | `jobs:read` | contract only |

No Phase 1A endpoint is represented as a deployed production service.

## Citation contract

A citation contains stable source identity and only known locations:

```json
{
  "source_id": "book-001",
  "document_version": "sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
  "title": "Authorized test document",
  "chapter_id": "ch-2",
  "chapter_title": "Chapter 2",
  "page_label": "42",
  "pdf_page_index": 47,
  "epub_locator": null,
  "chunk_id": "chunk-example",
  "source_text": "Actual retrieved authorized text",
  "score": 0.87
}
```

`score` is retrieval relevance, not legal correctness. Unknown location fields are `null`.

## Reasoning response

Logical fields accepted by the main site: `request_id`, `status`, `answer`, `citations`, `evidence_status`, `engine`, `model`, `provider`, `usage`, `error`.

`evidence_status` distinguishes sufficient/insufficient/unverified evidence. An insufficient-evidence response must not invent citations.

## Errors

Standard envelope:

```json
{
  "request_id": "019...",
  "status": "failed",
  "error": {
    "code": "MODEL_UNAVAILABLE",
    "message": "No authorized model is currently available",
    "retryable": true,
    "retry_after_seconds": 60,
    "provider": null
  }
}
```

HTTP mapping baseline:

- `UNAUTHORIZED` -> 401
- `FORBIDDEN` -> 403
- `INVALID_REQUEST` -> 400
- `KNOWLEDGE_NOT_FOUND` -> 404
- `INSUFFICIENT_EVIDENCE` -> 422 when the requested operation cannot be completed from evidence
- `PROVIDER_QUOTA_EXCEEDED` -> 429
- `MODEL_UNAVAILABLE` -> 503
- `TIMEOUT` -> 504
- `INTERNAL_ERROR` -> 500

When appropriate, 429/503 responses should include `Retry-After`.

## Capability truthfulness

`/v1/capabilities` and `/v1/models` may return `planned`, `unavailable`, `degraded`, or `available`. `available` requires an implemented and verified backing capability. Stubs are never `available`.