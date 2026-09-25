# Engineering decisions

1. The PDF wins. Distinguish assessment requirements from user-selected technologies and additional features in every acceptance audit.
2. Use PostgreSQL and Next.js because the user explicitly selected them; do not misrepresent them as exclusive requirements of the PDF.
3. Keep Python ingestion and TypeScript serving/display in one simple repository. No orchestration framework or unnecessary service layers.
4. Separate keyword browsing from relevance search. Embedding availability must never change required newest-first pagination or block baseline ingestion.
5. Use document_number as external identity, normalized content hashing for change detection, and transactional version creation to preserve rerun safety.
6. Do not copy illustrative regulatory facts from the mockup. Render only stored source data.
7. Commit and push each reviewed milestone before proceeding. Pending checks remain pending, not PASS.
8. Deliver publicly accessible code without sending the assessment by email or publishing the supplied private brief.
