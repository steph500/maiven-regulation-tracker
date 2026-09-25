import { getPool } from '@/lib/db/pool';
import { literalPattern, type SearchFilters } from '@/lib/validation/search';
import type { DocumentPage, RegulationDocument } from '@/types/documents';

export const PAGE_SIZE = 20;
export const DOCUMENT_COLUMNS = `id, document_number, title, abstract,
  publication_date, effective_on, agencies, html_url, current_version`;

export function documentPage(items: RegulationDocument[], total: number, offset: number): DocumentPage {
  const hasMore = offset + items.length < total;
  return { items, total, offset, pageSize: PAGE_SIZE, hasMore,
    nextOffset: hasMore ? offset + PAGE_SIZE : null };
}

export async function searchDocuments(filters: SearchFilters): Promise<DocumentPage> {
  // One SQL statement gives the count and page the same database snapshot.
  const result = await getPool().query<{ items: RegulationDocument[]; total: number }>(String.raw`
    WITH matching AS (
      SELECT ${DOCUMENT_COLUMNS} FROM maiven.documents
      WHERE ($1::text IS NULL OR title ILIKE $1 ESCAPE '\'
        OR abstract ILIKE $1 ESCAPE '\' OR document_number ILIKE $1 ESCAPE '\')
        AND ($2::date IS NULL OR publication_date >= $2)
        AND ($3::date IS NULL OR publication_date <= $3)
    ), page AS (
      SELECT * FROM matching ORDER BY publication_date DESC, document_number DESC
      LIMIT 20 OFFSET $4
    )
    SELECT (SELECT count(*)::integer FROM matching) AS total,
      COALESCE((SELECT json_agg(page ORDER BY publication_date DESC, document_number DESC)
                FROM page), '[]'::json) AS items
  `, [filters.q ? literalPattern(filters.q) : null, filters.from, filters.to, filters.offset]);
  return documentPage(result.rows[0].items, result.rows[0].total, filters.offset);
}
