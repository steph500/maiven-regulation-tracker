CREATE SCHEMA IF NOT EXISTS maiven;

CREATE TABLE maiven.documents (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    document_number text NOT NULL UNIQUE CHECK (length(trim(document_number)) > 0),
    title text NOT NULL CHECK (length(trim(title)) > 0),
    abstract text,
    publication_date date NOT NULL,
    effective_on date,
    agencies jsonb NOT NULL DEFAULT '[]' CHECK (jsonb_typeof(agencies) = 'array'),
    html_url text NOT NULL,
    content_hash text NOT NULL,
    search_hash text NOT NULL,
    current_version integer NOT NULL DEFAULT 1 CHECK (current_version > 0),
    first_seen_at timestamptz NOT NULL DEFAULT now(),
    last_seen_at timestamptz NOT NULL DEFAULT now(),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX documents_publication_order
    ON maiven.documents (publication_date DESC, document_number DESC);

CREATE TABLE maiven.document_versions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id uuid NOT NULL REFERENCES maiven.documents(id),
    version_number integer NOT NULL CHECK (version_number > 0),
    title text NOT NULL,
    abstract text,
    publication_date date NOT NULL,
    effective_on date,
    agencies jsonb NOT NULL,
    html_url text NOT NULL,
    content_hash text NOT NULL,
    captured_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (document_id, version_number)
);

CREATE TABLE maiven.ingest_runs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    started_at timestamptz NOT NULL DEFAULT now(),
    completed_at timestamptz,
    status text NOT NULL CHECK (status IN ('running', 'completed', 'failed')),
    pages_fetched integer NOT NULL DEFAULT 0,
    documents_seen integer NOT NULL DEFAULT 0,
    documents_inserted integer NOT NULL DEFAULT 0,
    documents_updated integer NOT NULL DEFAULT 0,
    documents_unchanged integer NOT NULL DEFAULT 0,
    documents_skipped integer NOT NULL DEFAULT 0,
    error_count integer NOT NULL DEFAULT 0
);

-- No anonymous access. Server roles receive explicit policies at deployment.
ALTER TABLE maiven.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE maiven.document_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE maiven.ingest_runs ENABLE ROW LEVEL SECURITY;
