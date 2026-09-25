# API contract

`GET /api/documents?q=&from=YYYY-MM-DD&to=YYYY-MM-DD&offset=0` returns stored current documents by publication_date descending, with a deterministic identifier tie-breaker. Search is case-insensitive literal text across title, abstract and document_number. Date boundaries are inclusive. Page size is fixed at 20; fewer items are valid only when fewer matches remain.

Response: `{ items, total, offset, pageSize: 20, nextOffset, hasMore }`.

Reject malformed dates, reversed ranges and negative/non-integer offsets with a useful 400 response. Parameterize SQL. Do not expose database error details.

Optional `GET /api/search?mode=semantic|hybrid&q=...` uses relevance ranking, preserving the required endpoint unchanged. Its detailed ranking and readiness behavior will be documented before implementation.
