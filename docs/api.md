# API contract

`GET /api/documents?q=&from=YYYY-MM-DD&to=YYYY-MM-DD&offset=0` returns stored current documents by publication_date descending, with a deterministic identifier tie-breaker. Search is case-insensitive literal text across title, abstract and document_number. Date boundaries are inclusive. Page size is fixed at 20; fewer items are valid only when fewer matches remain.

Response: `{ items, total, offset, pageSize: 20, nextOffset, hasMore }`.

Reject malformed dates, reversed ranges and negative/non-integer offsets with a useful 400 response. Parameterize SQL. Do not expose database error details.

Optional `GET /api/search?mode=semantic|hybrid&q=...` uses relevance ranking, preserving the required endpoint unchanged. A nonempty query is required. Both modes support the same date range and offset parameters. Missing, stale or incompatible embeddings in the filtered candidates return 503 rather than silently omitting documents. Keyword search stays available independently.

Semantic order uses cosine distance over current, model-compatible vectors. Hybrid order uses reciprocal rank fusion: `1/(60 + semantic_rank) + 1/(60 + keyword_rank)` where the second term is zero for documents without a textual match. PostgreSQL English full-text rank provides the enhancement's keyword rank; this never replaces literal case-insensitive matching in the required endpoint. Ties use publication date then document number. With only 100 documents, rank all filtered candidates before applying the same fixed page size.

`GET /api/documents/[id]/versions` returns immutable snapshots newest version first for a same-page history dialog. A malformed UUID returns 400; unknown documents return 404. This is a data endpoint, not a second application page.

`GET /api/status` returns the actual total indexed count and semantic readiness without disclosing credentials. No write endpoints are exposed publicly. All data responses disable shared caching so reruns and searches reflect stored data.

The local provider uses MiniLM-L6-v2 (384 dimensions), pinned revision, q8 weights, mean pooling and normalization. Python invokes the same small Node module used by TypeScript so indexing and queries cannot drift in preprocessing. Model weights download from Hugging Face on first use; subsequent calls use a filesystem cache and warm processes reuse the model. No paid embedding API is required. See [Transformers.js pipelines](https://huggingface.co/docs/transformers.js/api/pipelines). Documents are represented by title plus abstract; long text is truncated by the model tokenizer. Embedding metadata includes model revision and preprocessing. A separate hash of title/abstract avoids re-embedding date-only changes.

Semantic mode orders all date-filtered documents by similarity; it is a discovery aid, not a legal relevance determination. There is no uncalibrated similarity cutoff. The total therefore counts date-filtered candidates, unlike Keyword's literal match count. Hybrid adds full-text relevance through the documented rank fusion above.
