# Engineering decisions

1. The PDF wins. Distinguish assessment requirements from user-selected technologies and additional features in every acceptance audit.
2. Use PostgreSQL and Next.js because the user explicitly selected them; do not misrepresent them as exclusive requirements of the PDF.
3. Keep Python ingestion and TypeScript serving/display in one simple repository. No orchestration framework or unnecessary service layers.
4. Separate keyword browsing from relevance search. Embedding availability must never change required newest-first pagination or block baseline ingestion.
5. Use document_number as external identity, normalized content hashing for change detection, and transactional version creation to preserve rerun safety.
6. Do not copy illustrative regulatory facts from the mockup. Render only stored source data.
7. Commit and push each reviewed milestone before proceeding. Pending checks remain pending, not PASS.
8. Deliver publicly accessible code without sending the assessment by email or publishing the supplied private brief.
9. Use current stable Next.js 16.3.6, React 19.3 and TypeScript 7.0.2. ESLint's React plugin still requires legacy rule APIs, so use the official @eslint/compat adapter. The TypeScript 6 API alias supports lint tooling while the TypeScript 7 compiler runs the typecheck, following Microsoft's documented transition setup.
10. Production shares the user's existing Haulio Supabase project, as explicitly requested to avoid another project's billing. Isolate assessment tables in a dedicated maiven schema and preserve all unrelated tables and applications.

11. Vercel needs the native ONNX backend and its Linux CPU shared library explicitly traced. Include the library through pnpm's canonical package path to avoid duplicate files under symlinked directories; skip unused GPU downloads. Verify actual semantic requests after deployment, not only the build result.
