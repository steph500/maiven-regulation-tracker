# API contract

`GET /api/documents?q=&from=YYYY-MM-DD&to=YYYY-MM-DD&offset=0` returns stored current documents by publication_date descending, with a deterministic identifier tie-breaker. Search is case-insensitive literal text across title, abstract and document_number. Date boundaries are inclusive. Page size is fixed at 20; fewer items are valid only when fewer matches remain.

Response: `{ items, total, offset, pageSize: 20, nextOffset, hasMore }`.

Reject malformed dates, reversed ranges and negative/non-integer offsets with a useful 400 response. Parameterize SQL. Do not expose database error details.

Optional `GET /api/search?mode=semantic|hybrid&q=...` uses relevance ranking, preserving the required endpoint unchanged. Its detailed ranking and readiness behavior will be documented before implementation.

Semantic order uses cosine distance over current, model-compatible vectors. Hybrid order uses reciprocal rank fusion: `1/(60 + semantic_rank) + 1/(60 + keyword_rank)` where the second term is zero for documents without a textual match. PostgreSQL English full-text rank provides the enhancement's keyword rank; this never replaces literal case-insensitive matching in the required endpoint. Ties use publication date then document number. With only 100 documents, rank all filtered candidates before applying the same fixed page size.

`GET /api/documents/[id]/versions` returns immutable snapshots newest version first for a same-page history dialog. A malformed UUID returns 400; unknown documents return 404. This is a data endpoint, not a second application page.

`GET /api/status` returns the actual total indexed count and semantic readiness without disclosing credentials. No write endpoints are exposed publicly. All data responses disable shared caching so reruns and searches reflect stored data.
