# Architecture

Python fetches, validates and normalizes recent EPA Rules into PostgreSQL. Next.js serves current records through the required TypeScript API and displays them on one React page. Required browsing has no embedding-service dependency. Optional semantic/hybrid queries use a separate endpoint and pgvector. See [requirements](requirements.md).

## Components

```mermaid
flowchart TD
  FR[Federal Register API] --> PY[Python sequential pagination]
  PY --> N[Validation and normalization]
  N --> H[Deterministic content hashing]
  H --> DB[(PostgreSQL current documents and history)]
  DB --> API[Next.js GET /api/documents]
  API --> UI[Single React page]
  DB --> JOB[Optional Python embedding job]
  JOB --> EP[Embedding provider]
  EP --> V[(pgvector embeddings)]
  UI --> SEARCH[Separate GET /api/search]
  SEARCH --> EP
  SEARCH --> V
  SEARCH --> DB
```

## Ingest sequence

```mermaid
sequenceDiagram
  participant CLI as Python ingest
  participant FR as Federal Register
  participant DB as PostgreSQL
  CLI->>DB: Record started run
  loop Sequential pages until 100 valid unique documents
    CLI->>FR: EPA RULE, newest, page N
    FR-->>CLI: Results (ignore count and total_pages)
    CLI->>CLI: Validate, clean, skip malformed and duplicates
  end
  CLI->>DB: Begin transaction and serialize writers
  loop 100 normalized documents
    CLI->>DB: Upsert document_number, compare content hash
    alt New or changed content
      CLI->>DB: Store numbered snapshot and current row
    else Same content
      CLI->>DB: Update last_seen_at only
    end
  end
  CLI->>DB: Complete run counters and commit
```

Fetch all 100 before modifying documents. A failed fetch leaves existing documents untouched. Store the entire batch atomically; failed writes roll back the batch. A transaction-scoped advisory lock serializes ingestion writers so concurrent runs cannot create competing versions. Run diagnostics use a separate committed start/failure record.

## Required keyword sequence

```mermaid
sequenceDiagram
  participant UI as Single page
  participant API as /api/documents
  participant DB as PostgreSQL
  UI->>API: q, from, to, offset
  API->>API: Validate dates, range and offset
  API->>DB: Parameterized literal ILIKE, inclusive dates
  DB-->>API: Matching count and newest 20
  API-->>UI: Items and nextOffset metadata
  UI->>UI: Replace on search, append on Load More
```

## Optional relevance search sequence

```mermaid
sequenceDiagram
  participant UI as Single page
  participant API as /api/search
  participant EP as Embedding provider
  participant DB as PostgreSQL and pgvector
  UI->>API: mode, q, dates, offset
  API->>EP: Embed query with configured model
  EP-->>API: Query vector
  API->>DB: Current compatible embeddings, inclusive dates
  DB-->>API: Cosine rank and optional keyword rank
  API->>API: Semantic rank or reciprocal rank fusion
  API-->>UI: 20 results and pagination metadata
```

Stale embeddings are excluded using the hash of searchable content. Missing credentials or incomplete embeddings return a useful readiness error from the enhancement only. No implicit fallback changes the meaning of a search mode.

## Deployment

```mermaid
flowchart LR
  B[Browser] --> W[Vercel Next.js web and API]
  W --> P[(Managed PostgreSQL with pgvector)]
  W --> E[Configured embedding provider]
  I[Local or manual CI Python ingest] --> F[Federal Register API]
  I --> P
  J[Explicit Python embedding job] --> P
  J --> E
  G[Public GitHub source and CI] --> W
```

Only server processes receive database credentials. Ingestion and embeddings are explicit commands, outside request handling. PostgreSQL access uses standard drivers and SQL migrations, preserving provider portability.
