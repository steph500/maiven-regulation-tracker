import { ArrowUpRight, Sparkles } from "lucide-react";
import { HistoryDialog } from "./history-dialog";
import { formatDate } from "@/lib/format-date";
import type { RegulationDocument, SearchMode } from "@/types/documents";

export function DocumentCard({
  document,
  mode,
}: {
  document: RegulationDocument;
  mode: SearchMode;
}) {
  return (
    <article className="document-card" data-testid="document-card">
      <div className="document-copy">
        <h3>{document.title}</h3>
        <p className="abstract">
          {document.abstract ||
            "No abstract was supplied for this rule. Read the full document in the Federal Register."}
        </p>
        <div className="document-labels">
          {document.agencies
            .filter((agency) => agency.name)
            .map((agency, index) => (
              <span className="agency" key={index}>
                {agency.name}
              </span>
            ))}
          {mode !== "keyword" ? (
            <span className="match">
              <Sparkles size={13} aria-hidden="true" />
              {mode === "semantic" ? "Semantic" : "Hybrid"} match
            </span>
          ) : null}
        </div>
      </div>
      <div className="document-aside">
        <p className="metadata">
          <span>Published {formatDate(document.publication_date)}</span>
          {document.effective_on ? (
            <span>Effective {formatDate(document.effective_on)}</span>
          ) : null}
          <span>FR Doc {document.document_number}</span>
        </p>
        <div className="document-actions">
          <a
            className="primary source-link"
            href={document.html_url}
            target="_blank"
            rel="noopener noreferrer"
          >
            <ArrowUpRight size={18} aria-hidden="true" />
            Open Federal Register
            <span className="sr-only">
              : {document.document_number} (opens in a new tab)
            </span>
          </a>
          {document.current_version > 1 ? (
            <HistoryDialog document={document} />
          ) : null}
        </div>
      </div>
    </article>
  );
}
