# Phase 1A Contract Acceptance Matrix

This is a contract-level test specification. Runtime execution begins in Phase 1B.

| ID | Scenario | Endpoint example | Expected HTTP | Expected code |
|---|---|---|---:|---|
| AUTH-01 | Missing bearer token | POST /v1/reason | 401 | UNAUTHORIZED |
| AUTH-02 | Expired or invalid JWT | POST /v1/reason | 401 | UNAUTHORIZED |
| AUTH-03 | Missing reason:execute | POST /v1/reason | 403 | FORBIDDEN |
| AUTH-04 | Missing models:invoke | POST /v1/reason | 403 | FORBIDDEN |
| AUTH-05 | knowledge[] supplied but missing knowledge:read | POST /v1/reason | 403 | FORBIDDEN |
| AUTH-06 | Valid knowledge:read but no grant for requested book | POST /v1/knowledge/query | 403 | FORBIDDEN |
| AUTH-07 | allow_web_search=true but missing search:read | POST /v1/reason | 403 | FORBIDDEN |
| RAG-01 | Retrieval completes with no adequate evidence | POST /v1/knowledge/query | 200 | evidence_status=insufficient |
| RAG-02 | Evidence-grounded answer cannot be supported | POST /v1/reason | 422 | INSUFFICIENT_EVIDENCE |
| RES-01 | Unknown book/resource | POST /v1/knowledge/query | 404 | KNOWLEDGE_NOT_FOUND |
| JOB-01 | Unknown job id | GET /v1/jobs/{id} | 404 | JOB_NOT_FOUND |
| UP-01 | Provider quota exhausted | POST /v1/reason | 429 | PROVIDER_QUOTA_EXCEEDED |
| UP-02 | Authorized model unavailable | POST /v1/reason | 503 | MODEL_UNAVAILABLE |
| UP-03 | Required service unavailable | POST /v1/search | 503 | SERVICE_UNAVAILABLE |
| UP-04 | Upstream timeout | POST /v1/reason | 504 | TIMEOUT |
| SYS-01 | Unexpected internal failure | protected endpoint | 500 | INTERNAL_ERROR |

Security assertions:
- Scopes do not imply access to every document.
- Resource grants are trusted main-site authorization data bound to tenant and subject.
- ChatResponse does not claim evidence grounding.
- Insufficient evidence never produces fabricated citations.
- Secrets and provider raw errors are excluded from public responses.
