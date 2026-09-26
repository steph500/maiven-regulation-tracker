"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowDownWideNarrow,
  ChevronDown,
  Layers2,
  Leaf,
  RotateCcw,
  Search,
  Sparkles,
} from "lucide-react";
import { DateRange } from "./date-range";
import { DocumentCard } from "@/components/documents/document-card";
import type { DocumentPage, SearchMode } from "@/types/documents";

interface Filters {
  q: string;
  from: string;
  to: string;
  mode: SearchMode;
}
const DEFAULT_FILTERS: Filters = { q: "", from: "", to: "", mode: "keyword" };
const PLACEHOLDERS: Record<SearchMode, string> = {
  keyword: "Search titles, abstracts or document numbers...",
  semantic: "Describe the regulation you are looking for...",
  hybrid: "Search by words or describe what you need...",
};

async function fetchDocuments(
  filters: Filters,
  offset: number,
  signal: AbortSignal,
): Promise<DocumentPage> {
  const params = new URLSearchParams({ q: filters.q, offset: String(offset) });
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  if (filters.mode !== "keyword") params.set("mode", filters.mode);
  const response = await fetch(
    `${filters.mode === "keyword" ? "/api/documents" : "/api/search"}?${params}`,
    { signal },
  );
  const result = await response.json();
  if (!response.ok)
    throw new Error(
      result.error || "Search could not be completed. Please try again.",
    );
  return result;
}

export function Tracker() {
  const [draft, setDraft] = useState(DEFAULT_FILTERS);
  const [applied, setApplied] = useState(DEFAULT_FILTERS);
  const [page, setPage] = useState<DocumentPage | null>(null);
  const [status, setStatus] = useState<{
    total: number;
    semanticReady: boolean;
  } | null>(null);
  const [pending, setPending] = useState<"search" | "more" | null>("search");
  const [error, setError] = useState("");
  const request = useRef<AbortController | null>(null);
  const loadMorePending = useRef(false);
  const dirty = JSON.stringify(draft) !== JSON.stringify(applied);

  const load = useCallback(async (filters: Filters, offset = 0) => {
    if (offset && loadMorePending.current) return;
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    loadMorePending.current = offset > 0;
    setPending(offset ? "more" : "search");
    setError("");
    try {
      const result = await fetchDocuments(filters, offset, controller.signal);
      if (controller.signal.aborted) return;
      setPage((previous) => ({
        ...result,
        items:
          offset && previous
            ? [...previous.items, ...result.items]
            : result.items,
      }));
      setApplied(filters);
    } catch (failure) {
      if (!controller.signal.aborted)
        setError(
          failure instanceof Error
            ? failure.message
            : "Connection lost. Please try again.",
        );
    } finally {
      if (!controller.signal.aborted) {
        setPending(null);
        loadMorePending.current = false;
      }
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    request.current = controller;
    fetchDocuments(DEFAULT_FILTERS, 0, controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) setPage(result);
      })
      .catch((failure) => {
        if (!controller.signal.aborted) setError(failure.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setPending(null);
      });
    fetch("/api/status", { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : null))
      .then(setStatus)
      .catch(() => {});
    return () => {
      request.current?.abort();
      controller.abort();
    };
  }, []);

  function reset() {
    setDraft(DEFAULT_FILTERS);
    void load(DEFAULT_FILTERS);
  }

  return (
    <>
      <header className="site-header">
        <div className="header-inner">
          <Link href="/" className="brand">
            <Leaf aria-hidden="true" size={28} />
            <span>Regulation Tracker</span>
          </Link>
          <span className="index-status">
            <span className={status ? "status-dot" : "status-dot waiting"} />
            {status
              ? `${status.total} documents indexed`
              : "Connecting to the register"}
          </span>
        </div>
      </header>
      <main id="main-content" className="page-shell">
        <section className="hero" aria-labelledby="page-title">
          <p className="eyebrow">U.S. Environmental Protection Agency</p>
          <h1 id="page-title">
            Track <span>EPA Rules</span>
          </h1>
          <p className="hero-description">
            Search and review EPA regulations from the U.S. Federal Register.
            <br className="desktop-break" /> Find rules, track changes, and stay
            informed.
          </p>
        </section>
        <form
          className="search-panel"
          aria-label="Search regulations"
          onSubmit={(event) => {
            event.preventDefault();
            void load(draft);
          }}
        >
          <div className="search-top">
            <fieldset className="mode-control">
              <legend className="sr-only">Search mode</legend>
              {(["keyword", "semantic", "hybrid"] as const).map((mode) => {
                const Icon =
                  mode === "keyword"
                    ? Search
                    : mode === "semantic"
                      ? Sparkles
                      : Layers2;
                return (
                  <label
                    className={draft.mode === mode ? "mode active" : "mode"}
                    key={mode}
                  >
                    <input
                      type="radio"
                      name="search-mode"
                      value={mode}
                      checked={draft.mode === mode}
                      onChange={() => setDraft({ ...draft, mode })}
                    />
                    <Icon size={16} aria-hidden="true" />
                    {mode[0].toUpperCase() + mode.slice(1)}
                  </label>
                );
              })}
            </fieldset>
            <span className="search-hint">
              {draft.mode === "keyword"
                ? "Find the words that matter."
                : draft.mode === "semantic"
                  ? "Describe an idea. Discover related rules."
                  : "Find matches by words and meaning."}
            </span>
          </div>
          <div className="search-controls">
            <label className="query-control">
              <Search size={21} aria-hidden="true" />
              <span className="sr-only">Search regulations</span>
              <input
                type="search"
                maxLength={500}
                value={draft.q}
                placeholder={PLACEHOLDERS[draft.mode]}
                required={draft.mode !== "keyword"}
                onChange={(event) =>
                  setDraft({ ...draft, q: event.target.value })
                }
              />
            </label>
            <DateRange
              from={draft.from}
              to={draft.to}
              onChange={(from, to) => setDraft({ ...draft, from, to })}
            />
            <span className="control sort-label">
              <ArrowDownWideNarrow size={18} aria-hidden="true" />
              {draft.mode === "keyword" ? "Newest first" : "Relevance"}
            </span>
            <button
              className="primary search-button"
              disabled={pending === "search"}
            >
              <Search size={20} aria-hidden="true" />
              {pending === "search" ? "Searching…" : "Search"}
            </button>
            <button
              type="button"
              className="control reset-button"
              onClick={reset}
            >
              <RotateCcw size={18} aria-hidden="true" />
              Reset
            </button>
          </div>
          {draft.mode !== "keyword" && status && !status.semanticReady ? (
            <p className="inline-notice">
              Semantic indexing is being updated. Keyword search is available.
            </p>
          ) : null}
        </form>
        <section
          className="results"
          aria-labelledby="results-title"
          aria-busy={pending !== null}
        >
          <div className="results-heading">
            <h2 id="results-title">
              {page
                ? `${page.total} regulation${page.total === 1 ? "" : "s"}`
                : "Regulations"}
            </h2>
            <span>
              {applied.mode === "keyword"
                ? "Most recently published first"
                : "Ordered by relevance"}
            </span>
          </div>
          <div role="status" className="sr-only">
            {pending
              ? "Loading regulations"
              : page
                ? `Showing ${page.items.length} of ${page.total} documents`
                : ""}
          </div>
          {error ? (
            <div className="error-state" role="alert">
              <strong>We couldn’t complete that search.</strong>
              <p>{error}</p>
              <button
                className="control"
                type="button"
                onClick={() => void load(draft)}
              >
                Try again
              </button>
            </div>
          ) : null}
          {pending === "search" ? (
            <div className="skeleton-list" aria-hidden="true">
              {[0, 1, 2, 3].map((n) => (
                <div className="skeleton-card" key={n}>
                  <div />
                  <div />
                  <div />
                </div>
              ))}
            </div>
          ) : page?.items.length ? (
            <div className="document-list">
              {page.items.map((document) => (
                <DocumentCard
                  key={document.id}
                  document={document}
                  mode={applied.mode}
                />
              ))}
            </div>
          ) : !error ? (
            <div className="empty-state">
              <Search size={30} aria-hidden="true" />
              <h3>No regulations found</h3>
              <p>Try another phrase or widen the publication date range.</p>
              <button type="button" className="control" onClick={reset}>
                Clear search and filters
              </button>
            </div>
          ) : null}
          {page && pending !== "search" ? (
            <div className="pagination">
              {page.hasMore ? (
                <button
                  className="load-more"
                  type="button"
                  disabled={pending !== null || dirty}
                  onClick={() => void load(applied, page.nextOffset!)}
                >
                  {pending === "more" ? "Loading…" : "Load 20 more"}
                  <ChevronDown size={18} aria-hidden="true" />
                </button>
              ) : null}
              <p>
                Showing {page.items.length} of {page.total} documents
              </p>
              {dirty ? (
                <p className="draft-note">Search to apply your changes.</p>
              ) : null}
            </div>
          ) : null}
        </section>
        <footer className="site-footer">
          <span>
            <Leaf size={15} aria-hidden="true" />
            Clarity in a changing landscape.
          </span>
          <p>Source: U.S. Federal Register · EPA rules</p>
        </footer>
      </main>
    </>
  );
}
