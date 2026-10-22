# API Contract — Phase 1A

Canonical machine-readable contract: `contracts/openapi.yaml` (OpenAPI 3.1).

## Transport and identity
Protected requests use HTTPS + JSON and `Authorization: Bearer <short-lived JWT>`. Required JWT claims are `iss`, `aud`, `sub`, `exp`, `jti`, `scope`. `scope` is a space-delimited OAuth-style string. UUID v7 is preferred for request IDs; caller IDs are preserved/mapped when different.

## Authorization model
Scopes authorize operations; they never authorize every document. Trusted resource grants are supplied/verified from the AIVAULT main-site authorization source and bound to tenant + subject. A missing/invalid token is 401. A valid identity missing a required scope or document grant is 403.

Endpoint rules:
- `/v1/search`: `search:read`.
- `/v1/knowledge/query`: `knowledge:read` plus grants for every requested `book_id`.
- `/v1/reason`: always `reason:execute` + `models:invoke`; additionally `knowledge:read` when `knowledge[]` is used and `search:read` when `allow_web_search=true`; referenced books require document grants.
- `/v1/chat/completions`: `models:invoke`; this is general chat, not evidence-grounded legal reasoning.
- `/v1/jobs`: `jobs:create`; `/v1/jobs/{id}`: `jobs:read`.

## Chat vs evidence reasoning
`ChatResponse` is intentionally separate from `ReasonResponse`. Chat does not expose `citations` or `evidence_status` and must not imply evidence grounding. `/v1/reason` is the evidence-grounded path and only returns HTTP 200 when sufficient evidence supports completion.

## Retrieval vs reasoning when evidence is weak
`/v1/knowledge/query` is a retrieval operation. A successfully executed retrieval may return HTTP 200 with `evidence_status=insufficient` and zero/weak citations. `/v1/reason` is an evidence-grounded decision operation; if evidence is insufficient to answer, it returns HTTP 422 with `INSUFFICIENT_EVIDENCE` and must not fabricate an answer or citation.

## Citation contract
Citation fields include `source_id`, `document_version`, `chapter_id`, `chapter_title`, `page_label`, `pdf_page_index`, `epub_locator`, `chunk_id`, `source_text`, and retrieval `score`. Unknown locations are `null`. `score` is retrieval relevance, not legal correctness.

## Errors
Standard envelope: `request_id`, `status=failed`, and `error { code, message, retryable, retry_after_seconds, provider }`.

HTTP mapping:
- 400 `INVALID_REQUEST`
- 401 `UNAUTHORIZED`
- 403 `FORBIDDEN`
- 404 `KNOWLEDGE_NOT_FOUND` or `JOB_NOT_FOUND`
- 422 `INSUFFICIENT_EVIDENCE` for evidence-grounded reasoning refusal
- 429 `PROVIDER_QUOTA_EXCEEDED`
- 500 `INTERNAL_ERROR`
- 503 `MODEL_UNAVAILABLE` or `SERVICE_UNAVAILABLE`
- 504 `TIMEOUT`

429 responses expose `Retry-After` when known. Provider raw errors remain in protected logs, not public response bodies.

## Contract test matrix
| Case | Expected |
|---|---|
| no bearer token | 401 UNAUTHORIZED |
| expired/invalid JWT | 401 UNAUTHORIZED |
| valid JWT missing endpoint scope | 403 FORBIDDEN |
| valid scope but missing document grant | 403 FORBIDDEN |
| knowledge retrieval runs but finds weak/no evidence | 200 + evidence_status=insufficient |
| evidence-grounded reasoning lacks evidence | 422 INSUFFICIENT_EVIDENCE |
| unknown knowledge resource | 404 KNOWLEDGE_NOT_FOUND |
| unknown job | 404 JOB_NOT_FOUND |
| provider quota exhausted | 429 PROVIDER_QUOTA_EXCEEDED |
| model unavailable | 503 MODEL_UNAVAILABLE |
| upstream timeout | 504 TIMEOUT |
| unexpected server failure | 500 INTERNAL_ERROR |

## Capability truthfulness
Capability/model states are `planned`, `unavailable`, `degraded`, or `available`. `available` requires an implemented and verified backing service. Stubs are never reported as available.

## Reproducible validation
CI validates the contract with Redocly CLI. Equivalent local command:

```bash
npx --yes @redocly/cli@1.34.5 lint contracts/openapi.yaml
```

The version is pinned in CI. Phase 1A validation proves contract syntax/quality only; it does not prove a Runtime, Search, RAG, or model provider is operational.
