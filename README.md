# Regulation Tracker

[![CI](https://github.com/steph500/maiven-regulation-tracker/actions/workflows/ci.yml/badge.svg)](https://github.com/steph500/maiven-regulation-tracker/actions/workflows/ci.yml)

A small end-to-end regulatory pipeline: Python ingests 100 recent EPA Rules from the US Federal Register, PostgreSQL preserves normalized records, and a single Next.js page makes them searchable.

**Live application:** [maiven-regulation-tracker.vercel.app](https://maiven-regulation-tracker.vercel.app). Seeded with 100 real documents and compatible embeddings; keyword, semantic and hybrid search are verified in production. The screenshot below is captured from the public deployment.

![Regulation Tracker desktop view](docs/screenshots/desktop.jpg)

[Mobile screenshot](docs/screenshots/mobile.jpg) · [Acceptance checklist](docs/acceptance-checklist.md) · [Requirements](docs/requirements.md) · [Architecture and sequence diagrams](docs/architecture.md) · [Schema and ERD](docs/database.md) · [API contract](docs/api.md) · [Engineering decisions](docs/decisions.md)

## Assessment scope

The supplied assessment brief takes precedence over every enhancement.

| Required assessment features | Additional features |
| --- | --- |
| Python ingestion of 100 recent EPA Rules, handling pagination | Transactional change history with immutable snapshots |
| Normalization and safe reruns without duplicates or data loss | Separate semantic and hybrid search using pgvector |
| TypeScript `GET /api/documents`, newest publication first | Locally executed embeddings; no paid embedding API |
| Inclusive publication dates and simple case-insensitive text search | Accessible date popover and same-page history dialog |
| Fixed batches of 20 and next-page access | Responsive botanical design based on the supplied reference |
| One page, real API filters, and append-style Load More | Broader integration/browser tests and GitHub Actions |
| Meaningful cleaning/rerun tests and run documentation | Restricted production database roles in an existing project |

Next.js and PostgreSQL were recommendations in the brief and explicit technology choices for this implementation. Keyword browsing does not require embeddings. Semantic ranking never changes the required endpoint's ordering.

## Architecture and stack

```text
Federal Register → Python fetch/normalize/hash → PostgreSQL → Next.js API → one React page
                            ↓                      ↑
                  optional local embeddings ──→ pgvector ← semantic/hybrid API
```

Python handles ingestion, validation and transactional persistence. TypeScript handles read-only APIs and display. SQL stays in small, named modules; there is no separate application server, ORM or orchestration framework. The [architecture document](docs/architecture.md) contains the component, ingest, keyword, semantic and deployment diagrams; the [database document](docs/database.md) contains the sixth diagram, the ERD.

- Python 3.11+ with httpx, Beautiful Soup, psycopg and pytest.
- Node.js 24, pnpm 11.25.0, Next.js 16.3.6, React 19.3 and strict TypeScript 7.0.2.
- PostgreSQL 18 with optional pgvector; ordinary SQL connections keep storage portable.
- Radix accessible dialog/popover primitives, Lucide icons and local CSS/SVG assets.
- Vitest database tests, Playwright desktop/mobile tests, Ruff and ESLint.

## Local setup

Install Git, Node.js 24, Python 3.11+ and Docker with Compose. Commands below run from the repository root. Internet access is needed for dependencies, Federal Register ingestion and the first optional model download.

```bash
git clone https://github.com/steph500/maiven-regulation-tracker.git
cd maiven-regulation-tracker
npm install --global pnpm@11.25.0
pnpm install --frozen-lockfile
python -m venv .venv
```

Activate Python on macOS/Linux with `source .venv/bin/activate`; on PowerShell use `.\.venv\Scripts\Activate.ps1`. If PowerShell activation is restricted, use `.\.venv\Scripts\python.exe` in place of `python` without changing execution policy.

```bash
python -m pip install -e '.[dev]'
cp .env.example .env
docker compose up -d --wait
python -m ingest.migrate
python -m ingest
python -m ingest
pnpm dev
```

In PowerShell, `Copy-Item .env.example .env` is the equivalent copy command. Open [localhost:3000](http://localhost:3000). Docker exposes PostgreSQL only on loopback; the example password is for local development. An existing local PostgreSQL instance also works: create a database and set `DATABASE_URL` accordingly.

The second ingest demonstrates rerun safety. If the source has not changed, it reports 100 unchanged documents and creates no extra current rows or versions. Each successful run collects exactly 100 unique valid source records; the retained database can grow above 100 over time because records absent from a later batch are never deleted.

To enable the extra search modes:

```bash
python -m ingest.migrate --vectors
python -m ingest.embeddings
```

The Docker image includes pgvector. Other PostgreSQL installations need the extension installed before applying the optional migration. Python invokes the same Node embedding module used by the query API, so Node dependencies must be installed before generating embeddings. A second embedding run skips unchanged, compatible vectors.

For a local production build:

```bash
pnpm lint
pnpm typecheck
pnpm build
pnpm start
```

### Environment variables

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Server/Python PostgreSQL connection string; required. Use a read-only login for the deployed web app and a separate writer for ingestion. |
| `TEST_DATABASE_URL` | Disposable local database whose name ends in `_test`; required for the full database test suites. |
| `EMBEDDING_PROVIDER` | `local` enables the MiniLM provider. No embedding API secret is required. |
| `EMBEDDING_CACHE_DIR` | Optional model cache directory; defaults to `maiven-models` inside the OS temporary directory. |
| `NODE_BINARY` | Optional Node executable path for Python's embedding subprocess. |
| `PLAYWRIGHT_BASE_URL` | Optional running app URL for browser tests/screenshots; defaults to `http://localhost:3000`. |

Python loads `.env`; Next.js uses its normal environment-file precedence. Test commands below explicitly export the test URL. Never use `NEXT_PUBLIC_` for database credentials. Environment files and build artifacts are ignored by Git.

## Ingestion, identity and history

`python -m ingest` requests `conditions[type][]=RULE` and `conditions[agencies][]=environmental-protection-agency` from the public [Federal Register documents API](https://www.federalregister.gov/api/v1/documents.json), ordered newest first. It requests title, document number, publication/effective dates, abstract, agencies and source URL.

Sequential pages continue until there are 100 valid unique document numbers. Response `count` and `total_pages` are ignored. Short pages, repeated documents and malformed records do not prematurely end collection. Empty pages before the target cause a clear failure. Timeouts, bounded retries/backoff and progress limits prevent indefinite requests.

Normalization strips unwanted HTML, collapses whitespace, preserves Unicode, converts empty optional text to null, and validates dates, URLs and required identifiers. Invalid records are logged and skipped; identifiers are never invented.

Each current document has an internal UUID and unique external `document_number`. A deterministic hash covers normalized source fields. One transaction, protected by a Maiven-specific advisory lock, updates current rows and immutable history together:

1. New document: insert current row and version 1.
2. Identical hash: update `last_seen_at`; keep the existing version and content timestamps.
3. Changed hash: preserve the prior snapshot, append one version, and update the current row.

There are no delete-on-rerun operations. Failed batches roll back their document changes and leave a failed run log. An independent title/abstract hash invalidates only embeddings whose searchable content changed.

### Schema

| Table in `maiven` | Responsibility |
| --- | --- |
| `documents` | Current normalized records; UUID primary key, unique document number and content/search hashes |
| `document_versions` | Full source snapshots; unique `(document_id, version_number)` |
| `document_embeddings` | Optional 384-dimensional vector, content hash and provider/model metadata |
| `ingest_runs` | Completion status and seen/inserted/updated/unchanged/skipped/error counters |
| `schema_migrations` | Immutable migration checksums |

Primary/unique keys and a publication-date/document-number index support identity and deterministic browsing. At 100 records, simple substring and exact vector scans are sufficient; speculative approximate-vector or trigram indexes would add complexity without measured benefit.

## API and search

### Required endpoint

```http
GET /api/documents?q=water&from=2026-01-01&to=2026-12-31&offset=0
```

All parameters are optional. `q` is literal, case-insensitive substring search across title, abstract and document number, including literal `%` and `_` characters. `from` and `to` are inclusive publication dates. Results always use `publication_date DESC, document_number DESC` and a fixed maximum of 20 rows. Offset 20 fetches the next 20; the final batch may be smaller.

```json
{
  "items": [],
  "total": 0,
  "offset": 0,
  "pageSize": 20,
  "nextOffset": null,
  "hasMore": false
}
```

This is an illustrative empty response, not seeded data. Malformed dates, reversed ranges and negative/non-integer offsets return useful 400 errors. Queries are parameterized; unexpected server/database errors are sanitized.

### Extra endpoints

```http
GET /api/search?mode=semantic&q=pesticide%20residues%20on%20food&offset=0
GET /api/search?mode=hybrid&q=water%20pollution&from=2026-01-01
GET /api/documents/{uuid}/versions
GET /api/status
```

Semantic mode embeds the query and orders date-filtered candidates by cosine distance. Hybrid combines that rank with PostgreSQL English full-text rank using reciprocal rank fusion: `1/(60 + semantic_rank) + 1/(60 + keyword_rank)`. A document without a full-text match contributes only the semantic term. Both modes preserve fixed batches of 20 and inclusive date filters. Their total counts all date-filtered candidates, because there is no arbitrary similarity cutoff.

The provider is pinned to `Xenova/all-MiniLM-L6-v2` revision `751bff37182d3f1213fa05d7196b954e230abad9`, q8 weights, mean pooling and normalized 384-dimensional vectors. Model files download from Hugging Face once per cache; query/document inference runs locally in Node. No document text is sent to an embedding API. Missing or stale embeddings return an explicit 503 for the extra search modes; keyword browsing stays independent.

The history endpoint returns actual captured snapshots, newest version first. The UI displays history only when a record has more than one captured version. `/api/status` reports the real document count and compatible embedding coverage.

## Testing

Create a separate disposable database; integration tests deliberately reset only a local database ending in `_test`:

```bash
docker compose exec db createdb -U maiven maiven_test
export TEST_DATABASE_URL=postgresql://maiven:maiven@127.0.0.1:5432/maiven_test
python -m pytest -q
python -m ruff check .
python -m ruff format --check .
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

On PowerShell, replace `export` with `$env:TEST_DATABASE_URL='postgresql://maiven:maiven@127.0.0.1:5432/maiven_test'`. Run the database suites sequentially because each owns the disposable schema. Python integration tests skip when no test URL is supplied; the TypeScript database suite fails explicitly. The CI workflow always supplies one, so the full suites run.

For browser tests, run a seeded application with embeddings enabled in another terminal, then:

```bash
pnpm exec playwright install chromium
pnpm test:e2e
node scripts/capture-ui.mjs
```

On Linux, `pnpm exec playwright install --with-deps chromium` installs required browser system libraries. E2E tests use real API calls for browsing, search, dates, pagination and semantic/hybrid modes. Error/empty/history cases use explicit browser-only fixtures; these never enter production storage. Screenshots are captured from a running app after its real count and first 20 records load.

Verified: **29 Python tests, 33 TypeScript tests and 8 browser tests**. All eight browser tests also passed against the public production deployment. Python covers cleaning, malformed data, misleading pagination metadata, atomic failure, concurrent reruns, history and embedding invalidation. TypeScript executes required route queries against PostgreSQL and semantic SQL against PGlite with its pgvector extension. Browser tests run desktop and mobile journeys.

[GitHub Actions](.github/workflows/ci.yml) runs Python lint/format/tests, TypeScript lint/typecheck/tests and a production build on pushes and pull requests, with a fresh PostgreSQL service and no production secrets. The live-source browser suite runs separately so CI does not depend on Federal Register availability or downloading a model. There are no scheduled ingestion jobs.

## Deployment

The web application is deployed on Vercel and connected to this repository for future pushes. The database uses the existing Haulio Supabase project, isolated in `maiven`; no extra database project was created. Existing applications and schemas are untouched. The web login has SELECT access only to Maiven documents/history/embeddings. The ingestion login has narrowly scoped read/insert/update grants and row-level policies, with no delete access. Neither can access unrelated application tables.

1. Import this repository as a Next.js project and select Node.js 24.
2. Install with pnpm 11.25.0 and build with `pnpm build`.
3. Store the reader `DATABASE_URL` and `EMBEDDING_PROVIDER=local` in encrypted server-side deployment settings.
4. Apply migrations through a database administrator separately. Run `python -m ingest`, then `python -m ingest.embeddings`, using the ingestion login from a trusted environment.
5. Verify `/api/status`, all three search modes, date boundaries and append pagination on the public deployment before declaring it ready.

For Supabase's transaction pooler, use its provided pooled connection host with verified TLS. The public CA at `db/certs/supabase-ca.crt` is included in API bundles; the URL can use `sslmode=verify-full&sslrootcert=db/certs/supabase-ca.crt`. Do not disable certificate checks. The Python ingestion connection disables prepared statements for pooler compatibility; each web process caps its pool at three connections.

No embedding-service secret is needed. Model download and native ONNX execution require outbound HTTPS, a writable temporary directory and a compatible Node runtime. The deployed native CPU runtime and public search modes were verified: the first semantic request took about 3.5 seconds and the next hybrid request about 0.6 seconds in one smoke run. These measurements are observations, not a latency guarantee. The deployment explicitly traces the native library through its canonical pnpm path and skips unused GPU downloads.

## Assumptions, tradeoffs and limitations

- A run samples 100 recent valid unique EPA Rules; this is not a complete archive. Real source updates between runs can legitimately add documents or versions.
- History begins when this application observes a document. It is not a reconstruction of every Federal Register amendment, and a new document number remains a separate document.
- Search uses titles and abstracts, not full regulatory text. The embedding tokenizer truncates long inputs. Semantic results are a discovery aid and have not been evaluated against a labeled relevance benchmark.
- Offset pagination has deterministic tie-breaking but does not pin a multi-request database snapshot. Concurrent ingestion can shift later offsets; a larger service should offer a separate cursor-based browsing interface while preserving the assessment API.
- Local embeddings avoid API keys and per-request embedding fees, but consume server CPU/memory and add cold-start model-download latency. Temporary caches may be evicted.
- The brief asked for a small exercise; versioning and semantic search deliberately remain separable additions. Custom CSS keeps the visual design small without introducing a large UI framework.
- There is no scheduler, write API, account system or operational alerting. Source changes appear only after an explicit ingestion run. The optional manual production-ingest workflow is not configured.
- Hosting uses the existing account's normal resources; sharing a database project does not mean computation is free. See the [acceptance checklist](docs/acceptance-checklist.md) for executed production evidence.

## What I would do differently with more time

Start with an agreed operational freshness target and a labeled search evaluation set. Add monitored incremental ingestion with bounded historical backfill, source-change provenance and alerts for stale data or failed runs. Measure query plans and vector recall before introducing trigram/HNSW indexes. Benchmark cold starts and package size on the deployment platform; prewarm/cache or move embedding inference to a small persistent service if traffic warrants it. Add cursor browsing as an additional API, structured request metrics, rate limits, dependency/security checks and broader keyboard/screen-reader testing. Keep the original assessment endpoint and cleaning/rerun guarantees covered throughout.

## Technical discussion notes

- **Why two identities?** UUIDs are stable internal references; the unique source document number makes upserts correct even when titles change.
- **Why hashes and transactions?** Normalization makes change detection deterministic. A transaction and advisory lock keep current state and immutable versions consistent under reruns and concurrent writers.
- **Why two search APIs?** The required literal/newest-first contract stays easy to verify. Optional relevance ranking can evolve independently.
- **Why separate search hashes?** A publication-date correction deserves history, but does not require recomputing an unchanged title/abstract vector.
- **Why exact scans?** For roughly 100 documents, correctness and clarity matter more than unmeasured indexing complexity.
- **Why a shared embedding module?** Index and query vectors use exactly the same model revision and preprocessing.
- **Why test real SQL?** Database constraints, escaping, ordering and transactional behavior cannot be established by mocking a repository method.
- **How was AI used?** Requirements, design, code and checks were developed in reviewed, focused commits. The [decision log](docs/decisions.md), executable tests and acceptance evidence are intended to make each choice explainable.
