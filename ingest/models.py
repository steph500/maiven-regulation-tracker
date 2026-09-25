"""Small data contracts shared by normalization, fetching and persistence."""

from dataclasses import asdict, dataclass
from datetime import date
from typing import Any


@dataclass(frozen=True)
class Document:
    document_number: str
    title: str
    abstract: str | None
    publication_date: date
    effective_on: date | None
    agencies: list[dict[str, Any]]
    html_url: str
    content_hash: str
    search_hash: str

    def payload(self) -> dict[str, Any]:
        return asdict(self)


@dataclass
class RunStats:
    pages_fetched: int = 0
    documents_seen: int = 0
    documents_inserted: int = 0
    documents_updated: int = 0
    documents_unchanged: int = 0
    documents_skipped: int = 0
    error_count: int = 0
