"""Embed only changed searchable content, using the same model as the web API."""

import json
import os
import subprocess
from pathlib import Path

import psycopg
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[1]


def call_provider(texts: list[str] | None = None):
    command = [os.environ.get("NODE_BINARY", "node"), str(ROOT / "scripts" / "embed.mjs")]
    if texts is None:
        command.append("--metadata")
    result = subprocess.run(
        command,
        input=json.dumps(texts),
        text=True,
        encoding="utf-8",
        capture_output=True,
        check=True,
        timeout=600,
        cwd=ROOT,
    )
    return json.loads(result.stdout)


def refresh_embeddings(database_url: str, provider=call_provider) -> dict:
    metadata = provider()
    with psycopg.connect(database_url, prepare_threshold=None) as connection:
        pending = connection.execute(
            """
            SELECT d.id, d.title, d.abstract, d.search_hash
            FROM maiven.documents d LEFT JOIN maiven.document_embeddings e ON e.document_id = d.id
            WHERE e.document_id IS NULL OR e.content_hash <> d.search_hash
               OR e.embedding_provider <> %s OR e.embedding_model <> %s
            ORDER BY d.document_number
        """,
            (metadata["name"], metadata["model"]),
        ).fetchall()
    updated = 0
    for start in range(0, len(pending), 8):
        batch = pending[start : start + 8]
        vectors = provider([f"{row[1]}\n{row[2] or ''}" for row in batch])
        if len(vectors) != len(batch):
            raise ValueError("Embedding provider returned an unexpected batch length")
        with psycopg.connect(database_url, prepare_threshold=None) as connection:
            for row, vector in zip(batch, vectors, strict=True):
                if len(vector) != metadata["dimensions"]:
                    raise ValueError("Embedding provider returned an unexpected dimension")
                # The lock and hash recheck prevent a stale vector overwriting a newer document.
                current = connection.execute(
                    "SELECT search_hash FROM maiven.documents WHERE id = %s FOR UPDATE", (row[0],)
                ).fetchone()
                if not current or current[0] != row[3]:
                    continue
                connection.execute(
                    """
                    INSERT INTO maiven.document_embeddings
                        (document_id, embedding, embedding_provider, embedding_model, content_hash)
                    VALUES (%s, %s, %s, %s, %s)
                    ON CONFLICT (document_id) DO UPDATE SET
                        embedding = EXCLUDED.embedding,
                        embedding_provider = EXCLUDED.embedding_provider,
                        embedding_model = EXCLUDED.embedding_model,
                        content_hash = EXCLUDED.content_hash,
                        updated_at = now()
                """,
                    (
                        row[0],
                        json.dumps(vector, allow_nan=False),
                        metadata["name"],
                        metadata["model"],
                        row[3],
                    ),
                )
                updated += 1
        print(
            f"Embedded {min(start + 8, len(pending))}/{len(pending)} changed documents", flush=True
        )
    return {"pending": len(pending), "updated": updated}


def main() -> None:
    load_dotenv()
    database_url = os.environ.get("DATABASE_URL")
    if not database_url:
        raise SystemExit("Set DATABASE_URL before generating embeddings")
    try:
        print(json.dumps(refresh_embeddings(database_url)))
    except (psycopg.Error, subprocess.SubprocessError, ValueError):
        raise SystemExit(
            "Embedding refresh failed; verify the database, Node runtime and model download"
        ) from None


if __name__ == "__main__":
    main()
