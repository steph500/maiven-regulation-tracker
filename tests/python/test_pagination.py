import httpx
import pytest

from ingest.federal_register import collect_documents, fetch_federal_register_page
from ingest.models import RunStats


def test_collects_exactly_100_despite_short_duplicate_invalid_pages(raw_document):
    records = [raw_document(f"2026-{index:05}") for index in range(115)]
    pages = [
        records[:9],
        records[4:20] + [{"title": "Missing identity"}],
        records[20:40],
        records[40:60],
        records[60:80],
        records[80:100],
        records[100:],
    ]
    requested = []

    def respond(request):
        page = int(request.url.params["page"])
        requested.append(page)
        assert request.url.params["conditions[type][]"] == "RULE"
        assert request.url.params["conditions[agencies][]"] == "environmental-protection-agency"
        return httpx.Response(200, json={"results": pages[page - 1], "count": 1, "total_pages": 1})

    with httpx.Client(transport=httpx.MockTransport(respond)) as client:
        stats = RunStats()
        documents = collect_documents(client, stats)
    assert len(documents) == len({item.document_number for item in documents}) == 100
    assert requested == [1, 2, 3, 4, 5, 6]
    assert stats.documents_skipped == 6


def test_empty_page_fails_clearly():
    with httpx.Client(
        transport=httpx.MockTransport(lambda _: httpx.Response(200, json={"results": []}))
    ) as client:
        with pytest.raises(RuntimeError, match="Source exhausted"):
            collect_documents(client, RunStats())


def test_stalled_pages_are_bounded(raw_document):
    with httpx.Client(
        transport=httpx.MockTransport(
            lambda _: httpx.Response(200, json={"results": [raw_document()]})
        )
    ) as client:
        with pytest.raises(RuntimeError, match="no progress"):
            collect_documents(client, RunStats())


def test_transient_http_failure_retries(monkeypatch, raw_document):
    attempts = []
    monkeypatch.setattr("ingest.federal_register.time.sleep", lambda _: None)

    def respond(request):
        attempts.append(request)
        return (
            httpx.Response(503)
            if len(attempts) < 3
            else httpx.Response(200, json={"results": [raw_document()]})
        )

    with httpx.Client(transport=httpx.MockTransport(respond)) as client:
        assert len(fetch_federal_register_page(client, 1)) == 1
    assert len(attempts) == 3


def test_permanent_http_failure_does_not_retry():
    with httpx.Client(transport=httpx.MockTransport(lambda _: httpx.Response(400))) as client:
        with pytest.raises(RuntimeError, match="page 1"):
            fetch_federal_register_page(client, 1)
