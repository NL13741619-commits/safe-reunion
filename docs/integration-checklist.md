# AIVAULT Main Site ↔ Second Base Integration Checklist

## Phase 1A contract gate

- [x] Development branch isolated from `main`.
- [x] Existing root application assets left unchanged.
- [x] Architecture trust boundaries documented.
- [x] JWT required claims documented.
- [x] Scope model documented.
- [x] Document/tenant authorization separated from scopes.
- [x] Citation location fields defined with nullable unknowns.
- [x] Normalized error codes defined.
- [x] OpenAPI 3.1 contract added.
- [ ] Main-site team reviews and accepts contract differences.

## Inputs required from main site before real RAG integration

- [ ] Confirm actual `book_id` format or provide adapter examples.
- [ ] Confirm current document version representation.
- [ ] Confirm PDF/EPUB location metadata available from bookshelf.
- [ ] Confirm tenant/user/document grant claim or exchange format.
- [ ] Confirm Dark Star consumer response mapping.
- [ ] Confirm existing request/trace ID format.
- [ ] Provide one legally redistributable/public/self-authored integration document.
- [ ] Mark expected-evidence outcome for each legal test question.

## Phase 1B Gateway verification

- [ ] `GET /health` runs locally and in CI.
- [ ] Missing bearer token -> 401 on protected endpoints.
- [ ] Invalid signature/issuer/audience/expiry -> 401.
- [ ] Missing required scope -> 403.
- [ ] Valid scope but unauthorized document -> 403.
- [ ] Invalid request body -> 400 with normalized error envelope.
- [ ] `/v1/capabilities` reports unimplemented engines as `planned`/`unavailable`.
- [ ] `/v1/models` never reports an unverified model as `available`.

## Search/RAG/Reasoning acceptance gate

- [ ] Search returns real provider results with source URLs and retrieval time.
- [ ] RAG retrieves text that can be manually located in the authorized source.
- [ ] Citation `page_label`/`pdf_page_index`/`epub_locator` values are source-derived or `null`.
- [ ] Evidence-grounded reasoning uses the retrieved evidence pack.
- [ ] Insufficient evidence produces an explicit non-fabricated result.
- [ ] Provider quota, timeout, and unavailable-model failures remain truthful errors.
- [ ] Execution can be traced from request ID to engine/provider/evidence/result.

## Security/deployment gate

- [ ] No secrets are present in Git history or frontend code.
- [ ] Production runtime supports server-side secret management.
- [ ] HTTPS is enforced outside local development.
- [ ] Runtime identity has no GitHub write privileges.
- [ ] Paid providers remain disabled until explicitly approved.
- [ ] Rights-restricted ebooks are not stored in the public repository.

## First legal test set

1. Why were provisions of the German Aviation Security Act found unconstitutional?
2. What is the meaning of human dignity protection under Article 1 of the German Basic Law?
3. What stages comprise the German proportionality principle?
4. How can food-safety measures affect fundamental rights?
5. How do the precautionary principle and danger prevention differ?
6. How are administrative discretion and indeterminate legal concepts distinguished?
7. What similarities/differences exist between Taiwan and Germany in reviewing restrictions on fundamental rights?
8. What is the relationship between the principle of statutory reservation and the requirement of clear legislative authorization?

Before RAG acceptance testing, each question must be labelled by the test-document owner as `evidence_expected: sufficient` or `evidence_expected: insufficient`.