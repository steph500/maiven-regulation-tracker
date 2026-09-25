"""Conservative, deterministic normalization of Federal Register metadata."""

import hashlib
import json
import re
from datetime import date
from typing import Any
from urllib.parse import urlsplit

from bs4 import BeautifulSoup

from ingest.models import Document


def clean_text(value: Any) -> str | None:
    if value is None:
        return None
    if not isinstance(value, str):
        raise ValueError("Text must be a string or null")
    soup = BeautifulSoup(value, "html.parser")
    for element in soup(["script", "style", "noscript"]):
        element.decompose()
    return " ".join(soup.get_text(" ").replace("\x00", "").split()) or None


def parse_date(value: Any, *, required: bool = False) -> date | None:
    if value is None or value == "":
        if required:
            raise ValueError("publication_date is required")
        return None
    if not isinstance(value, str) or not re.fullmatch(r"\d{4}-\d{2}-\d{2}", value):
        raise ValueError("Date must use YYYY-MM-DD")
    return date.fromisoformat(value)


def calculate_content_hash(fields: dict[str, Any]) -> str:
    canonical = json.dumps(fields, sort_keys=True, ensure_ascii=False, separators=(",", ":"))
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def normalize_agencies(value: Any) -> list[dict[str, Any]]:
    if value is None:
        return []
    if not isinstance(value, list) or any(not isinstance(item, dict) for item in value):
        raise ValueError("agencies must be an array of objects")
    agencies = []
    for item in value:
        # Preserve source metadata while normalizing displayable names.
        agency = dict(item)
        if "name" in agency:
            agency["name"] = clean_text(agency["name"])
        agencies.append(agency)
    return sorted(agencies, key=lambda item: json.dumps(item, sort_keys=True))


def normalize_document(raw: Any) -> Document:
    if not isinstance(raw, dict):
        raise ValueError("Document must be an object")
    document_number = clean_text(raw.get("document_number"))
    if not document_number:
        raise ValueError("Missing document_number; record skipped")
    title = clean_text(raw.get("title"))
    if not title:
        raise ValueError("title is required")
    publication_date = parse_date(raw.get("publication_date"), required=True)
    assert publication_date is not None
    effective_on = parse_date(raw.get("effective_on"))
    html_url = raw.get("html_url")
    if not isinstance(html_url, str):
        raise ValueError("html_url is required")
    html_url = html_url.strip()
    parsed = urlsplit(html_url)
    if (
        parsed.scheme != "https"
        or parsed.hostname not in {"www.federalregister.gov", "federalregister.gov"}
        or parsed.username
        or parsed.password
        or parsed.port not in (None, 443)
        or any(character.isspace() for character in html_url)
    ):
        raise ValueError("html_url must be a valid HTTPS Federal Register URL")
    fields = {
        "document_number": document_number,
        "title": title,
        "abstract": clean_text(raw.get("abstract")),
        "publication_date": publication_date.isoformat(),
        "effective_on": effective_on.isoformat() if effective_on else None,
        "agencies": normalize_agencies(raw.get("agencies")),
        "html_url": html_url,
    }
    return Document(
        **{**fields, "publication_date": publication_date, "effective_on": effective_on},
        content_hash=calculate_content_hash(fields),
        search_hash=calculate_content_hash({"title": title, "abstract": fields["abstract"]}),
    )
