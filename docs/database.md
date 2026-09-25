# Database

Status: design skeleton; schema and ERD follow in the architecture milestone.

PostgreSQL is the user's selected storage. Use an internal UUID and unique Federal Register document_number. Preserve one current row, immutable numbered snapshots, optional embeddings, and ingestion run diagnostics. Transactions must preserve documents and history together. No deletion of documents absent from later source batches.
