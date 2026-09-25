"""Fetch 100 valid unique EPA Rules without trusting pagination metadata."""

import logging
import time

import httpx

from ingest.models import Document, RunStats
from ingest.normalize import normalize_document

ENDPOINT = "https://www.federalregister.gov/api/v1/documents.json"
FIELDS = [
    "title",
    "document_number",
    "publication_date",
    "effective_on",
    "abstract",
    "agencies",
    "html_url",
]
logger = logging.getLogger(__name__)


def fetch_federal_register_page(client: httpx.Client, page: int) -> list:
    params = [
        ("conditions[type][]", "RULE"),
        ("conditions[agencies][]", "environmental-protection-agency"),
        ("per_page", "20"),
        ("page", str(page)),
        ("order", "newest"),
        *[("fields[]", field) for field in FIELDS],
    ]
    for attempt in range(3):
        try:
            response = client.get(ENDPOINT, params=params, timeout=30)
            response.raise_for_status()
            payload = response.json()
            if not isinstance(payload, dict) or not isinstance(payload.get("results"), list):
                raise ValueError("Federal Register response has no results array")
            return payload["results"]
        except (httpx.TransportError, httpx.HTTPStatusError) as error:
            retryable = not isinstance(error, httpx.HTTPStatusError) or (
                error.response.status_code == 429 or error.response.status_code >= 500
            )
            if not retryable or attempt == 2:
                raise RuntimeError(f"Federal Register page {page} could not be fetched") from error
            logger.warning("Page %s request failed; retry %s/2", page, attempt + 1)
            time.sleep(2**attempt)
    raise AssertionError("Unreachable retry state")


def collect_documents(client: httpx.Client, stats: RunStats) -> list[Document]:
    documents: dict[str, Document] = {}
    no_progress_pages = 0
    for page in range(1, 1001):
        results = fetch_federal_register_page(client, page)
        stats.pages_fetched += 1
        if not results:
            raise RuntimeError(
                f"Source exhausted after {len(documents)} valid unique documents; need 100"
            )
        previous_count = len(documents)
        for raw in results:
            stats.documents_seen += 1
            try:
                document = normalize_document(raw)
            except (ValueError, TypeError, OverflowError) as error:
                stats.documents_skipped += 1
                logger.warning("Skipping malformed record on page %s: %s", page, error)
                continue
            if document.document_number in documents:
                stats.documents_skipped += 1
                continue
            documents[document.document_number] = document
            if len(documents) == 100:
                return list(documents.values())
        no_progress_pages = no_progress_pages + 1 if len(documents) == previous_count else 0
        if no_progress_pages >= 10:
            raise RuntimeError("Source made no progress for 10 pages; cannot collect 100 documents")
    raise RuntimeError("Source exceeded 1000-page safety limit before 100 valid documents")
