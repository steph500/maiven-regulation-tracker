"""Atomic upserts and immutable history, keyed by external document_number."""

from dataclasses import asdict

import psycopg
from psycopg.types.json import Jsonb

from ingest.models import Document, RunStats


def upsert_document(connection: psycopg.Connection, document: Document) -> str:
    existing = connection.execute(
        "SELECT id, content_hash FROM maiven.documents WHERE document_number = %s FOR UPDATE",
        (document.document_number,),
    ).fetchone()
    if existing and existing[1] == document.content_hash:
        connection.execute(
            "UPDATE maiven.documents SET last_seen_at = now() WHERE id = %s", (existing[0],)
        )
        return "unchanged"
    values = document.payload()
    values["agencies"] = Jsonb(values["agencies"])
    row = connection.execute(
        """
        INSERT INTO maiven.documents (
            document_number, title, abstract, publication_date, effective_on, agencies,
            html_url, content_hash, search_hash
        ) VALUES (
            %(document_number)s, %(title)s, %(abstract)s, %(publication_date)s,
            %(effective_on)s, %(agencies)s, %(html_url)s, %(content_hash)s, %(search_hash)s
        )
        ON CONFLICT (document_number) DO UPDATE SET
            title = EXCLUDED.title, abstract = EXCLUDED.abstract,
            publication_date = EXCLUDED.publication_date, effective_on = EXCLUDED.effective_on,
            agencies = EXCLUDED.agencies, html_url = EXCLUDED.html_url,
            content_hash = EXCLUDED.content_hash, search_hash = EXCLUDED.search_hash,
            current_version = maiven.documents.current_version + 1,
            last_seen_at = now(), updated_at = now()
        RETURNING id, current_version
    """,
        values,
    ).fetchone()
    assert row is not None
    connection.execute(
        """
        INSERT INTO maiven.document_versions (
            document_id, version_number, title, abstract, publication_date,
            effective_on, agencies, html_url, content_hash
        ) SELECT id, current_version, title, abstract, publication_date,
                 effective_on, agencies, html_url, content_hash
          FROM maiven.documents WHERE id = %s
    """,
        (row[0],),
    )
    return "updated" if existing else "inserted"


def persist_batch(
    connection: psycopg.Connection, documents: list[Document], stats: RunStats
) -> None:
    # Serialize only Maiven ingestion writers; unrelated applications are not locked.
    connection.execute("SELECT pg_advisory_xact_lock(78201932)")
    outcomes = {"inserted": 0, "updated": 0, "unchanged": 0}
    for document in documents:
        outcomes[upsert_document(connection, document)] += 1
    stats.documents_inserted = outcomes["inserted"]
    stats.documents_updated = outcomes["updated"]
    stats.documents_unchanged = outcomes["unchanged"]


def finish_run(connection: psycopg.Connection, run_id, stats: RunStats, status: str) -> None:
    values = {**asdict(stats), "id": run_id, "status": status}
    connection.execute(
        """
        UPDATE maiven.ingest_runs SET completed_at = now(), status = %(status)s,
            pages_fetched = %(pages_fetched)s, documents_seen = %(documents_seen)s,
            documents_inserted = %(documents_inserted)s, documents_updated = %(documents_updated)s,
            documents_unchanged = %(documents_unchanged)s,
            documents_skipped = %(documents_skipped)s,
            error_count = %(error_count)s WHERE id = %(id)s
    """,
        values,
    )
