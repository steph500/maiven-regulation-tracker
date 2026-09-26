# Acceptance evidence

Audit date: 2026-09-26. The original text extracted from both pages of the supplied Maiven PDF was reread before this audit. The private brief is not redistributed. The PDF is evaluated first; additional requested features are evaluated separately. PASS means an executed check or directly inspected deliverable, not an assumption based only on implementation.

## PDF requirements first

| ID | Requirement | Result | Executed evidence |
| --- | --- | --- | --- |
| R01 | Python ingestion | PASS | `python -m ingest` executed against a fresh Maiven schema and again against the same data; `ingest/__main__.py`. |
| R02 | TypeScript serving and display | PASS | Strict typecheck and production Next.js build passed locally and in GitHub Actions; `app/api/documents/route.ts`, `app/page.tsx`, `components/`. |
| R03 | Recent EPA Rules from Federal Register | PASS | Live ingestion used the public documents endpoint, `RULE`, EPA agency and newest-first source ordering in `ingest/federal_register.py`; 100 real records persisted. |
| R04 | Normalize and store records | PASS | PostgreSQL stores title, document number, actual DATE values, nullable effective date/abstract, agencies and source URL. `tests/python/test_normalize.py` verifies HTML/whitespace/Unicode handling and validation. |
| R05 | Reruns neither duplicate nor lose data | PASS | Production rerun: 100 seen, 0 inserted, 0 updated, 100 unchanged, 0 errors. Counts remained 100 documents/100 unique numbers/100 versions. `test_changed_source_adds_one_version_and_preserves_unseen` also proves older unseen rows survive changed batches. |
| R06 | Ingest 100 documents using pagination | PASS | Fresh production ingest: 5 pages, 100 seen, 100 inserted, 0 skipped/errors. `test_collects_exactly_100_despite_short_duplicate_invalid_pages` verifies the target through irregular pages. |
| R07 | Do not rely on count/total_pages | PASS | The same pagination test supplies misleading metadata, short pages, duplicates and invalid records. Empty/stalled page tests verify bounded failure. |
| R08 | Exact GET /api/documents, newest publication first | PASS | PostgreSQL route tests and production HTTP 200 response; first live result published 2026-09-25. Sort uses publication date then document number, both descending. |
| R09 | Publication date range | PASS | PostgreSQL boundary/combined-range tests plus desktop/mobile inclusive-date browser flow against real data. |
| R10 | Simple case-insensitive text search | PASS | Actual route tests match mixed-case title/abstract queries, document numbers and literal wildcard characters. Browser Enter-submit flow uses the real API. |
| R11 | Batches of 20 and next 20 | PASS | API tests execute offsets 0/20/40, assert 60 distinct IDs, and verify the smaller final batch. Production response reports 20 items, pageSize 20 and nextOffset 20. |
| R12 | Single listing page | PASS | Production build exposes one application route `/`; remaining routes are data endpoints and the framework's not-found handler. History/date controls stay in dialogs/popovers. |
| R13 | Search/filter wired to stored data | PASS | Desktop and mobile browser tests exercise actual PostgreSQL-backed keyword and date APIs; no UI sample records are used. |
| R14 | Load More control | PASS | Browser tests grow the list from 20 to 40 while retaining the first document in place, then verify Reset restores the first batch. |
| R15 | Meaningful text-cleaning tests | PASS | `tests/python/test_normalize.py`: repeated whitespace, unwanted HTML, Unicode, null optional values, invalid dates/URLs/identifiers and stable hashes. |
| R16 | Meaningful rerun tests | PASS | `tests/python/test_rerun.py`: identical rerun, changed version, unseen-data preservation, atomic failed fetch and concurrent writers against PostgreSQL. |
| R17 | README run instructions and requirements | PASS | README includes prerequisites, Docker/PostgreSQL, Python/Node setup, environment variables, migrations, ingestion/rerun and app commands. CI independently installed dependencies and executed checks/build on Linux. Local paths and screenshot links were verified. |
| R18 | README explains what to change with more time | PASS | README's dedicated section covers monitored incremental ingestion, relevance evaluation, measured indexes, cold-start work, cursor browsing and accessibility checks. |
| R19 | Accessible code repository or zip | PASS | Public repository: https://github.com/steph500/maiven-regulation-tracker. GitHub API reports `private: false`; reviewer can read and clone without a separate invitation. No email was sent. |

The brief's time budget and suggested stack are context, not invented extra requirements. This expanded implementation follows the user's additional scope while keeping the original contract independently testable.

## Executed verification

| Check | Result |
| --- | --- |
| Python tests including real PostgreSQL reruns | 29 passed |
| TypeScript route/search tests | 33 passed: 24 PostgreSQL route/history cases and 9 semantic/validation cases using actual pgvector SQL in PGlite |
| Desktop/mobile Playwright suite | 8 passed against both the local production build and the public Vercel deployment |
| Python Ruff lint and format | Passed in GitHub Actions |
| TypeScript ESLint and strict typecheck | Passed locally and in GitHub Actions |
| Next.js production build | Passed locally and on Vercel |
| GitHub CI | [Successful final application-code milestone](https://github.com/steph500/maiven-regulation-tracker/actions/runs/36216783210) |
| Native runtime packaging | Build trace checked for ONNX native binding, Linux CPU shared library and public database CA |

The tests use mocked source HTTP for deterministic ingestion, a disposable local PostgreSQL schema for persistence/route tests, and actual pgvector SQL for relevance ordering. Browser fixtures are limited to otherwise unavailable history and error/empty scenarios; they never populate production storage.

## Production data evidence

Read-only verification on 2026-09-26 found:

```text
documents                  100
distinct document_number   100
document_versions          100
document_embeddings        100

initial run: pages=5 seen=100 inserted=100 updated=0 unchanged=0 skipped=0 errors=0
rerun:       pages=5 seen=100 inserted=0   updated=0 unchanged=100 skipped=0 errors=0
```

Both runs completed. The database is the existing Haulio project, with only the new `maiven` schema and approved restricted logins. Grant inspection found neither Maiven login could access unrelated application tables; neither has superuser or RLS-bypass privileges. The reader is used by the web deployment, and the writer is retained for explicit ingestion.

## Additional requested features

| Feature | Result | Evidence |
| --- | --- | --- |
| UUID internal identity and unique source identifier | PASS | PostgreSQL constraints, migration and rerun tests. |
| Immutable version history | PASS | Changed-content/concurrent-rerun tests; actual history route tests; keyboard-accessible dialog browser test. |
| Separate semantic and hybrid APIs | PASS | Public semantic and hybrid requests return HTTP 200 with 20 results; all 8 browser tests pass on the live site. Dedicated ranking/date/pagination/stale-vector tests also passed. Required `/api/documents` remains independent. |
| Model compatibility and efficient regeneration | PASS | Shared pinned model/preprocessing metadata and `test_embedding_reruns_and_searchable_changes`; production rerun generated no unnecessary embeddings. |
| Reference-based responsive single-page design | PASS | Desktop/mobile screenshots in `docs/screenshots/`; 8 browser tests, visible focus, labeled controls, dialog Escape/focus behavior and no horizontal overflow. Real source agencies replace invented topic tags. |
| Accessible loading, empty and failure behavior | PASS | Browser error/empty recovery tests and actual data flows; stale requests aborted and pending append guarded. |
| Public deployment | PASS | https://maiven-regulation-tracker.vercel.app is public. All three search modes, 20/20/20 distinct pages, newest-first ordering, case-insensitive WATER/water search, inclusive dates, invalid-input 400s and actual history were exercised successfully. Native embedding runtime verified on Vercel. |
| Six understandable Mermaid diagrams | PASS | Five in `docs/architecture.md`, ERD in `docs/database.md`. |
| Focused public milestone commits | PASS | Requirements, design, scaffold, schema, ingestion, required API, relevance search, UI, tests, CI and README each have separate commits in public history. |
| Complete reviewer README | PASS | Setup, API, schema, decisions, limitations, more-time work, screenshots and technical discussion notes. Includes the verified public URL and live desktop/mobile screenshots. |
| Optional manual production ingestion workflow | Not included | Explicit CLI ingestion is documented; no automatic schedule or production GitHub secret is required. |

The corrected production deployment `dpl_D79kmNCd64rgXYLhBTsNTqnRk84U` is READY. The first semantic smoke request returned 20 records in about 3.5 seconds, led by “Cypermethrin; Pesticide Tolerance(s)” for “pesticide residues on food.” Hybrid also returned 20 records. All 8 production browser tests passed in 43 seconds. These checks were performed after correcting native runtime packaging, not inferred from the provider READY status.
