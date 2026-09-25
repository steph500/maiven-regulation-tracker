from concurrent.futures import ThreadPoolExecutor

import httpx
import psycopg
import pytest

from ingest.__main__ import run_ingest
from ingest.database import persist_batch
from ingest.models import RunStats
from ingest.normalize import normalize_document

pytestmark = pytest.mark.integration


def source_client(records):
    def respond(request):
        start = (int(request.url.params["page"]) - 1) * 20
        return httpx.Response(200, json={"results": records[start : start + 20]})

    return httpx.Client(transport=httpx.MockTransport(respond))


def test_identical_rerun_preserves_rows_and_versions(database_url, raw_document):
    records = [raw_document(f"2026-{index:05}") for index in range(100)]
    with source_client(records) as client:
        first = run_ingest(database_url, client)
        with psycopg.connect(database_url) as connection:
            before = connection.execute(
                "SELECT id, title, content_hash, first_seen_at, updated_at "
                "FROM maiven.documents ORDER BY id"
            ).fetchall()
        second = run_ingest(database_url, client)
    with psycopg.connect(database_url) as connection:
        after = connection.execute(
            "SELECT id, title, content_hash, first_seen_at, updated_at "
            "FROM maiven.documents ORDER BY id"
        ).fetchall()
        assert (
            connection.execute("SELECT count(*) FROM maiven.document_versions").fetchone()[0] == 100
        )
    assert before == after
    assert first.documents_inserted == second.documents_unchanged == 100
    assert second.documents_inserted == second.documents_updated == 0


def test_changed_source_adds_one_version_and_preserves_unseen(database_url, raw_document):
    records = [raw_document(f"2026-{index:05}") for index in range(100)]
    with source_client(records) as client:
        run_ingest(database_url, client)
    records[0] = raw_document("2026-00000", title="Updated water quality rule")
    with source_client(records) as client:
        changed = run_ingest(database_url, client)
        run_ingest(database_url, client)
    with psycopg.connect(database_url) as connection:
        persist_batch(connection, [normalize_document(raw_document("2026-99999"))], RunStats())
    with source_client(records) as client:
        run_ingest(database_url, client)
    with psycopg.connect(database_url) as connection:
        assert connection.execute("SELECT count(*) FROM maiven.documents").fetchone()[0] == 101
        assert (
            connection.execute("SELECT count(*) FROM maiven.document_versions").fetchone()[0] == 102
        )
        titles = connection.execute(
            "SELECT v.title FROM maiven.document_versions v "
            "JOIN maiven.documents d ON d.id=v.document_id "
            "WHERE d.document_number='2026-00000' ORDER BY version_number"
        ).fetchall()
    assert titles == [("Air Quality Rule",), ("Updated water quality rule",)]
    assert changed.documents_updated == 1 and changed.documents_unchanged == 99


def test_failed_fetch_does_not_persist_partial_batch(database_url, raw_document):
    with source_client([raw_document()]) as client:
        with pytest.raises(RuntimeError, match="exhausted"):
            run_ingest(database_url, client)
    with psycopg.connect(database_url) as connection:
        assert connection.execute("SELECT count(*) FROM maiven.documents").fetchone()[0] == 0
        assert connection.execute(
            "SELECT status, error_count FROM maiven.ingest_runs"
        ).fetchone() == ("failed", 1)


def test_concurrent_reruns_do_not_duplicate_versions(database_url, raw_document):
    document = normalize_document(raw_document())

    def persist(_):
        with psycopg.connect(database_url) as connection:
            persist_batch(connection, [document], RunStats())

    with ThreadPoolExecutor(max_workers=2) as executor:
        list(executor.map(persist, range(2)))
    with psycopg.connect(database_url) as connection:
        assert connection.execute("SELECT count(*) FROM maiven.documents").fetchone()[0] == 1
        assert (
            connection.execute("SELECT count(*) FROM maiven.document_versions").fetchone()[0] == 1
        )
