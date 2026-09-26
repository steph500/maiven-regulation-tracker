# Requirements and acceptance contract

Source of truth: supplied `Maiven_Takehome_Assessment.pdf`, pages 1–2, read in full on 2026-09-25. This checklist paraphrases the brief. The source PDF is not redistributed in the public repository.

Precedence: PDF requirements > user's explicit constraints > implementation plan > visual reference. An enhancement must be removed if it interferes with a requirement. Executed evidence is recorded in [the acceptance checklist](acceptance-checklist.md). Deployment is audited separately from the PDF requirements.

## REQUIRED — assessment

| ID | Requirement | Planned verification | Status |
|---|---|---|---|
| R01 | Python ingestion | Execute Python CLI | PASS — see acceptance-checklist.md |
| R02 | TypeScript serve and display | Typecheck API and page | PASS — see acceptance-checklist.md |
| R03 | Fetch recent EPA Rules from the public Federal Register documents endpoint | Inspect real request filters and source records | PASS — see acceptance-checklist.md |
| R04 | Normalize and store retrieved documents | Inspect persisted title, document_number, publication_date, effective_on, abstract, agencies, html_url | PASS — see acceptance-checklist.md |
| R05 | Reruns neither duplicate rows nor lose existing data | Execute identical rerun and compare database contents | PASS — see acceptance-checklist.md |
| R06 | Each run ingests 100 documents using pagination | Fresh database ingest yields 100 unique valid documents | PASS — see acceptance-checklist.md |
| R07 | Do not rely on response count or total_pages | Mock misleading metadata, short pages and duplicates | PASS — see acceptance-checklist.md |
| R08 | GET /api/documents returns stored documents, newest publication first | Execute route against seeded database | PASS — see acceptance-checklist.md |
| R09 | Filter by publication_date range | Execute boundary and combined range tests | PASS — see acceptance-checklist.md |
| R10 | Simple case-insensitive text search | Execute mixed-case text queries | PASS — see acceptance-checklist.md |
| R11 | Return 20 documents at a time with a way to fetch the next 20 | Execute offset 0, 20, 40 checks; final page may contain fewer | PASS — see acceptance-checklist.md |
| R12 | Single page listing documents | Inspect route structure and browser | PASS — see acceptance-checklist.md |
| R13 | Filters and search wired to stored data through the API | Execute browser flow with real API | PASS — see acceptance-checklist.md |
| R14 | Load more control | Verify next batch appends | PASS — see acceptance-checklist.md |
| R15 | Meaningful text-cleaning tests | Execute deterministic Python tests | PASS — see acceptance-checklist.md |
| R16 | Meaningful ingestion rerun tests | Execute PostgreSQL integration tests | PASS — see acceptance-checklist.md |
| R17 | README explains running the project and its requirements | Follow documented setup | PASS — see acceptance-checklist.md |
| R18 | README explains what to do differently with more time | Review README section | PASS — see acceptance-checklist.md |
| R19 | Deliver code as repository or zip; reviewer can access repository | Verify public repository accessibility | PASS — see acceptance-checklist.md |

The PDF recommends Next.js and PostgreSQL but explicitly permits structured-file storage. Python and TypeScript are requested. Its suggested time budget is 2–3 hours, and it encourages AI assistance with explainable decisions. We will record actual verification, without claiming production completeness from code inspection. The PDF's submission contact details are not authorization to send messages; the user explicitly prohibited email submission.

## REQUIRED — user-selected implementation and workflow

- [x] PostgreSQL storage; Next.js App Router and strict TypeScript.
- [x] Public GitHub repository; no secrets committed.
- [x] This checklist and all six design documents exist before application logic.
- [x] Review diff, changed paths and relevant checks at each milestone, then make and push a focused conventional commit before the next milestone.
- [x] Unique document_number; internal UUID primary key; migrations.
- [x] Ingest exactly 100 valid unique source documents despite malformed/repeated/short pages; fail clearly on premature exhaustion; bounded retry/backoff and timeout.
- [x] Conservative deterministic whitespace/HTML cleaning, valid Unicode, nullable empty optional fields, real dates and validated URLs; never invent identifiers.
- [x] Required endpoint supports q/from/to/offset, inclusive dates, title/abstract search, fixed page size 20, useful metadata, parameterized SQL and useful 400 errors.
- [x] Single-page accessible responsive UI follows supplied reference, displays only real stored data, and supports Enter, reset, loading/empty/error states and guarded append pagination.
- [x] Compact date-range control; Keyword/Semantic/Hybrid selector; baseline newest-first remains obvious.
- [x] Expanded Python, API and browser tests; CI lint/typecheck/tests/build.
- [x] README includes setup, environment, schema, API, architecture, decisions, tradeoffs, limitations, screenshot, deployment, and interview explanations.
- [x] Final audit rereads PDF and records executed evidence for every requirement before evaluating enhancements.

## ENHANCEMENTS — subordinate to the required contract

| Addition | Compatibility condition before implementation | Verification |
|---|---|---|
| Content hashes and version history | Keep one current row per external identifier; atomic history updates; unchanged reruns add no versions and never delete unrelated data | Identical/changed/concurrent rerun tests |
| pgvector semantic search | Optional separate /api/search; embedding failure cannot break required ingest or keyword API | Baseline tests with no embedding credentials; semantic integration checks |
| Hybrid search | Separate relevance ordering with documented simple rank fusion | Hybrid test; required route remains date-ordered |
| History dialog | No second application page; actual snapshots only | Browser history dialog test |
| Botanical visual polish | Local decorative assets; no fabricated dates, classifications, versions or records | Accessibility and responsive visual review |
| Public deployment | Required functionality verified first; production credentials kept out of Git | Real 100-document ingest, rerun, API and browser smoke checks |
| Manual ingest workflow | No automatic schedule; explicit dispatch and secure secrets | Workflow validation |

## Milestone order

0. Requirements and design-document skeletons.
1. Architecture, six Mermaid diagrams, schema/API/UI decisions.
2. Project structure and tooling.
3. Database migrations and verification.
4. Python ingestion and mandatory cleaning/rerun tests.
5. Required API and its tests.
6. Separate semantic/hybrid enhancement.
7. Single-page UI and browser verification.
8. Broader test coverage.
9. CI in its own commit.
10. Complete README.
11. Deploy and verify real production data and semantic operation.
12. Final PDF-first acceptance audit and delivery.
