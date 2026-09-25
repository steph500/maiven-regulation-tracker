import os
from urllib.parse import urlsplit

import psycopg
import pytest

from ingest.migrate import migrate


@pytest.fixture
def raw_document():
    def make(number="2026-00001", **changes):
        return {
            "document_number": number,
            "title": "Air Quality Rule",
            "abstract": "Limits emissions from factories.",
            "publication_date": "2026-09-01",
            "effective_on": "2026-10-01",
            "agencies": [{"name": "Environmental Protection Agency"}],
            "html_url": f"https://www.federalregister.gov/documents/{number}",
            **changes,
        }

    return make


@pytest.fixture
def database_url():
    url = os.environ.get("TEST_DATABASE_URL")
    if not url:
        pytest.skip("TEST_DATABASE_URL is required for PostgreSQL integration tests")
    parsed = urlsplit(url)
    if not parsed.path.endswith("_test") or parsed.hostname not in {"localhost", "127.0.0.1", "db"}:
        pytest.fail("Integration cleanup only permits local databases with names ending _test")
    with psycopg.connect(url) as connection:
        connection.execute("DROP SCHEMA IF EXISTS maiven CASCADE")
    migrate(url)
    return url
