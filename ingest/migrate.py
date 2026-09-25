"""Apply immutable SQL migrations; vector support is an explicit optional step."""

import argparse
import hashlib
import os
from pathlib import Path

import psycopg
from dotenv import load_dotenv

MIGRATIONS = Path(__file__).resolve().parents[1] / "db" / "migrations"


def migrate(database_url: str, *, vectors: bool = False) -> None:
    with psycopg.connect(database_url) as connection:
        connection.execute("SELECT pg_advisory_xact_lock(78201931)")
        connection.execute("CREATE SCHEMA IF NOT EXISTS maiven")
        connection.execute("""
            CREATE TABLE IF NOT EXISTS maiven.schema_migrations (
                name text PRIMARY KEY, checksum text NOT NULL,
                applied_at timestamptz NOT NULL DEFAULT now()
            )
        """)
        connection.execute("ALTER TABLE maiven.schema_migrations ENABLE ROW LEVEL SECURITY")
        for path in sorted(MIGRATIONS.glob("*.sql")):
            if path.name == "002_embeddings.sql" and not vectors:
                continue
            source = path.read_text(encoding="utf-8")
            checksum = hashlib.sha256(source.encode()).hexdigest()
            existing = connection.execute(
                "SELECT checksum FROM maiven.schema_migrations WHERE name = %s", (path.name,)
            ).fetchone()
            if existing:
                if existing[0] != checksum:
                    raise ValueError(f"Previously applied migration was changed: {path.name}")
                continue
            connection.execute(source)
            connection.execute(
                "INSERT INTO maiven.schema_migrations (name, checksum) VALUES (%s, %s)",
                (path.name, checksum),
            )
            print(f"Applied {path.name}")


def main() -> None:
    load_dotenv()
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--vectors", action="store_true", help="Also install optional pgvector schema"
    )
    args = parser.parse_args()
    database_url = os.environ.get("DATABASE_URL")
    if not database_url:
        parser.error("Set DATABASE_URL before running migrations")
    migrate(database_url, vectors=args.vectors)


if __name__ == "__main__":
    main()
