import pytest

from ingest.normalize import clean_text, normalize_document


@pytest.mark.parametrize(
    ("source", "expected"),
    [
        ("  Clean\n\t air   rules  ", "Clean air rules"),
        (None, None),
        ("  \n ", None),
        ("<p>Clean <b>air</b> &amp; water</p><script>unsafe()</script>", "Clean air & water"),
        ("  Émissions — 水 qualité  ", "Émissions — 水 qualité"),
        ("<style>body{}</style><p>One</p><p>Two</p>", "One Two"),
    ],
)
def test_clean_text(source, expected):
    assert clean_text(source) == expected


@pytest.mark.parametrize(
    "changes",
    [
        {"document_number": None},
        {"document_number": " "},
        {"title": ""},
        {"publication_date": "2026-02-30"},
        {"publication_date": "20260901"},
        {"publication_date": None},
        {"effective_on": "bad"},
        {"html_url": "javascript:alert(1)"},
        {"html_url": "https://evil.test/a"},
        {"html_url": "https://www.federalregister.gov@evil.test/a"},
        {"agencies": "EPA"},
    ],
)
def test_rejects_malformed_documents(raw_document, changes):
    with pytest.raises(ValueError):
        normalize_document(raw_document(**changes))


def test_normalization_hash_is_stable(raw_document):
    first = normalize_document(raw_document())
    equivalent = normalize_document(raw_document(title=" Air  Quality\nRule "))
    changed = normalize_document(raw_document(title="Water Quality Rule"))
    date_only = normalize_document(raw_document(effective_on="2026-11-01"))
    assert first.content_hash == equivalent.content_hash
    assert first.content_hash != changed.content_hash
    assert first.search_hash != changed.search_hash
    assert first.content_hash != date_only.content_hash
    assert first.search_hash == date_only.search_hash


def test_empty_optional_fields_are_null(raw_document):
    document = normalize_document(raw_document(abstract="  ", effective_on=None))
    assert document.abstract is None and document.effective_on is None
    assert document.publication_date.isoformat() == "2026-09-01"
