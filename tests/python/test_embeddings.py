import psycopg

from ingest.database import persist_batch
from ingest.embeddings import refresh_embeddings
from ingest.models import RunStats
from ingest.normalize import normalize_document


def test_embedding_reruns_and_searchable_changes(database_url, raw_document):
    # Vector ranking is tested with real pgvector in tests/ts/semantic.test.ts.
    # Text storage here isolates the Python selection and transactional upsert contract.
    with psycopg.connect(database_url) as connection:
        connection.execute("""CREATE TABLE maiven.document_embeddings (
            document_id uuid PRIMARY KEY REFERENCES maiven.documents(id), embedding text,
            embedding_provider text, embedding_model text, content_hash text,
            updated_at timestamptz DEFAULT now())""")
        persist_batch(connection, [normalize_document(raw_document())], RunStats())
    calls = []

    def provider(texts=None):
        if texts is None:
            return {"name": "fixture", "model": "fixture", "dimensions": 2}
        calls.extend(texts)
        return [[1, 0] for _ in texts]

    assert refresh_embeddings(database_url, provider) == {"pending": 1, "updated": 1}
    assert refresh_embeddings(database_url, provider) == {"pending": 0, "updated": 0}
    with psycopg.connect(database_url) as connection:
        persist_batch(
            connection, [normalize_document(raw_document(effective_on="2027-01-01"))], RunStats()
        )
    assert refresh_embeddings(database_url, provider)["updated"] == 0
    with psycopg.connect(database_url) as connection:
        persist_batch(
            connection, [normalize_document(raw_document(title="Water protection"))], RunStats()
        )
    assert refresh_embeddings(database_url, provider)["updated"] == 1
    assert len(calls) == 2
