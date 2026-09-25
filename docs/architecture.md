# Architecture

Status: design skeleton; detailed diagrams follow in the architecture milestone.

Python fetches, validates and normalizes recent EPA Rules into PostgreSQL. Next.js serves current records through the required TypeScript API and displays them on one React page. Required browsing has no embedding-service dependency. Optional semantic/hybrid queries use a separate endpoint and pgvector. See [requirements](requirements.md).
