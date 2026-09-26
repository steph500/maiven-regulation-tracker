"use client";
import * as Dialog from "@radix-ui/react-dialog";
import { useEffect, useState } from "react";
import { History, X } from "lucide-react";
import { formatDate } from "@/lib/format-date";
import type { DocumentVersion, RegulationDocument } from "@/types/documents";

function HistoryContent({ document }: { document: RegulationDocument }) {
  const [versions, setVersions] = useState<DocumentVersion[] | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/documents/${document.id}/versions`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok)
          throw new Error(
            "History could not be loaded. Close this dialog and try again.",
          );
        return response.json();
      })
      .then((data) => setVersions(data.items))
      .catch((error) => {
        if (!controller.signal.aborted) setError(error.message);
      });
    return () => controller.abort();
  }, [document.id]);
  return (
    <>
      <Dialog.Title className="dialog-title">Document history</Dialog.Title>
      <Dialog.Description className="dialog-description">
        {document.title}. These are changes observed during ingestion, not the
        full Federal Register revision history.
      </Dialog.Description>
      {error ? (
        <p role="alert">{error}</p>
      ) : !versions ? (
        <p role="status">Loading history…</p>
      ) : (
        <ol className="version-list">
          {versions.map((version) => (
            <li key={version.id}>
              <div className="version-heading">
                <strong>Version {version.version_number}</strong>
                <span>Observed {formatDate(version.captured_at)}</span>
              </div>
              <h3>{version.title}</h3>
              <p>{version.abstract || "No abstract supplied."}</p>
              <p className="metadata">
                Published {formatDate(version.publication_date)}
                {version.effective_on
                  ? ` · Effective ${formatDate(version.effective_on)}`
                  : ""}{" "}
                · FR Doc {version.document_number}
              </p>
            </li>
          ))}
        </ol>
      )}
      <Dialog.Close
        className="icon-button dialog-close"
        aria-label="Close history"
      >
        <X size={21} />
      </Dialog.Close>
    </>
  );
}

export function HistoryDialog({ document }: { document: RegulationDocument }) {
  return (
    <Dialog.Root>
      <Dialog.Trigger className="history-button">
        <History size={17} aria-hidden="true" />
        View history
        <span className="sr-only"> for {document.document_number}</span>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className="history-dialog">
          <HistoryContent document={document} />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
