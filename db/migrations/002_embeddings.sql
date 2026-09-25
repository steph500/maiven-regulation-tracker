CREATE EXTENSION IF NOT EXISTS vector;
SET LOCAL search_path TO maiven, public, extensions;

CREATE TABLE maiven.document_embeddings (
    document_id uuid PRIMARY KEY REFERENCES maiven.documents(id),
    embedding vector(384) NOT NULL,
    embedding_provider text NOT NULL,
    embedding_model text NOT NULL,
    content_hash text NOT NULL,
    updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE maiven.document_embeddings ENABLE ROW LEVEL SECURITY;
