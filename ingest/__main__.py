"""Run with python -m ingest. All 100 documents commit together."""

import json
import logging
import os
from dataclasses import asdict

import httpx
import psycopg
from dotenv import load_dotenv

from ingest.database import finish_run, persist_batch
from ingest.federal_register import collect_documents
from ingest.models import RunStats


def run_ingest(database_url: str, client: httpx.Client) -> RunStats:
    stats = RunStats()
    with psycopg.connect(database_url, autocommit=True, connect_timeout=15) as connection:
        run_id = connection.execute(
            "INSERT INTO maiven.ingest_runs (status) VALUES ('running') RETURNING id"
        ).fetchone()[0]
        try:
            documents = collect_documents(client, stats)
            with connection.transaction():
                persist_batch(connection, documents, stats)
                finish_run(connection, run_id, stats, "completed")
        except Exception:
            stats.error_count += 1
            stats.documents_inserted = stats.documents_updated = stats.documents_unchanged = 0
            finish_run(connection, run_id, stats, "failed")
            raise
    return stats


def main() -> None:
    load_dotenv()
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    database_url = os.environ.get("DATABASE_URL")
    if not database_url:
        raise SystemExit("Set DATABASE_URL and run python -m ingest.migrate first")
    try:
        with httpx.Client(headers={"User-Agent": "MaivenRegulationTracker/1.0"}) as client:
            stats = run_ingest(database_url, client)
    except psycopg.Error:
        raise SystemExit(
            "Database operation failed; verify DATABASE_URL, migrations and access"
        ) from None
    except (RuntimeError, ValueError) as error:
        raise SystemExit(str(error)) from None
    print(json.dumps(asdict(stats), indent=2))


if __name__ == "__main__":
    main()
