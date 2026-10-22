# AIVAULT Second AI Base — Architecture

Status: Phase 1A contract baseline  
Date: 2026-10-22

## Purpose

`NL13741619-commits/safe-reunion` is the second AI capability base for AIVAULT. The AIVAULT main site remains the product/orchestration center. This repository will expose independently deployable AI APIs without taking control of the main site's Supabase database or production UI.

Phase 1A is documentation and contract work only. Existing root assets (`index.html`, `README.md`, images) remain untouched.

## Trust boundaries

1. **AIVAULT Main Site** authenticates users, determines tenant/document authorization, and issues short-lived service JWTs.
2. **Second-Base Gateway** validates JWT issuer, audience, expiry, token ID, scopes, tenant/document grants, request IDs, and request shape before routing.
3. **Engines** implement Search, RAG, Reasoning, and Model Router behind the Gateway. Engines do not trust caller-supplied authorization without Gateway validation.
4. **Providers/Runtime** are replaceable adapters. A provider is reported `available` only after a real health/capability check.
5. **Audit/Usage** records traceable execution metadata without storing secrets or unnecessary source content.

## Planned request path

AIVAULT Main Site -> HTTPS -> Gateway -> authorization -> Search/RAG -> Evidence Pack -> Model Router -> Reasoning -> citation validation -> response.

Long-running work will later use the Jobs API. Media generation is outside Phase 1A.

## Identity and tracing

- Preferred `request_id`: UUID v7.
- If the main site supplies a different request ID, preserve it as `external_request_id` and generate an internal UUID v7.
- JWT required claims: `iss`, `aud`, `sub`, `exp`, `jti`, `scope`.
- Document/tenant authorization is checked separately from broad scopes.
- No Supabase `service_role` key crosses the boundary.

## Knowledge identifiers

- `book_id`: stable identifier supplied by the main site.
- `document_version`: `sha256:<64 lowercase-or-uppercase hexadecimal characters>`.
- `chunk_id`: stable ID derived from document version, chapter identity, and chunk sequence.
- Citation locations may include `page_label`, zero-based `pdf_page_index`, `epub_locator`, `chapter_id`, and `chapter_title`.
- Unknown locations are `null`; they are never invented.

## Capability states

Every engine/model reports one of: `available`, `degraded`, `unavailable`, `planned`.

An endpoint existing in code does not make its backing capability `available`.

## Phase sequence

- **1A:** architecture, security, API contract, OpenAPI 3.1, integration checklist.
- **1B:** local/CI Gateway skeleton, `/health`, `/v1/capabilities`, `/v1/models`, auth/scope/error tests.
- **1C:** real Search provider adapter.
- **1D:** authorized document ingestion/query, stable citations, RAG.
- **1E:** model router and evidence-grounded reasoning.
- **1F:** end-to-end AIVAULT main-site integration.

## Runtime

No production runtime is selected in Phase 1A. Runtime evaluation must compare HTTPS support, secret management, free allowance, sleep/cold-start behavior, CPU/RAM, persistent storage, network/egress cost, background jobs, observability, and scaling. GitHub Pages/Actions are not treated as production AI compute.