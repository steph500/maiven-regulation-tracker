import { getPool } from '@/lib/db/pool';
import { documentPage, DOCUMENT_COLUMNS } from './documents';
import { getEmbeddingProvider } from './embedding-provider.mjs';
import type { SearchFilters } from '@/lib/validation/search';
import type { RegulationDocument } from '@/types/documents';

export class SemanticUnavailable extends Error {}

export async function getSearchStatus() {
  const pool = getPool();
  const { rows } = await pool.query('SELECT count(*)::integer AS total FROM maiven.documents');
  try {
    const provider = getEmbeddingProvider();
    const coverage = await pool.query(`SELECT count(*)::integer AS ready
      FROM maiven.documents d JOIN maiven.document_embeddings e ON e.document_id = d.id
      WHERE e.content_hash = d.search_hash AND e.embedding_provider = $1 AND e.embedding_model = $2`,
    [provider.name, provider.model]);
    return { total: rows[0].total, semanticReady: rows[0].total > 0 && coverage.rows[0].ready === rows[0].total };
  } catch {
    return { total: rows[0].total, semanticReady: false };
  }
}

export const SEMANTIC_SQL = `
  WITH candidates AS (
    SELECT d.*, e.embedding, to_tsvector('english', d.title || ' ' || coalesce(d.abstract, '')) AS words
    FROM maiven.documents d LEFT JOIN maiven.document_embeddings e
      ON e.document_id = d.id AND e.content_hash = d.search_hash
      AND e.embedding_provider = $5 AND e.embedding_model = $6
    WHERE ($2::date IS NULL OR publication_date >= $2)
      AND ($3::date IS NULL OR publication_date <= $3)
  ), ranked AS (
    SELECT *, row_number() OVER (ORDER BY embedding <=> $1::vector, publication_date DESC, document_number DESC) AS semantic_rank,
      words @@ websearch_to_tsquery('english', $7) AS keyword_match,
      row_number() OVER (ORDER BY ts_rank_cd(words, websearch_to_tsquery('english', $7)) DESC,
        publication_date DESC, document_number DESC) AS keyword_rank
    FROM candidates WHERE embedding IS NOT NULL
  ), scored AS (
    SELECT *, 1.0 / (60 + semantic_rank) +
      CASE WHEN $8::boolean AND keyword_match THEN 1.0 / (60 + keyword_rank) ELSE 0 END AS score
    FROM ranked
  ), page AS (
    SELECT ${DOCUMENT_COLUMNS}, score FROM scored
    ORDER BY score DESC, publication_date DESC, document_number DESC LIMIT 20 OFFSET $4
  )
  SELECT (SELECT count(*)::integer FROM candidates) AS total,
    (SELECT count(*)::integer FROM candidates WHERE embedding IS NULL) AS missing,
    COALESCE((SELECT json_agg(to_jsonb(page) - 'score' ORDER BY score DESC, publication_date DESC, document_number DESC)
      FROM page), '[]'::json) AS items`;

export async function searchDocumentsByMeaning(filters: SearchFilters, mode: 'semantic' | 'hybrid') {
  const provider = getEmbeddingProvider();
  const [vector] = await provider.embed([filters.q]);
  const result = await getPool().query<{ items: RegulationDocument[]; total: number; missing: number }>(
    SEMANTIC_SQL, [JSON.stringify(vector), filters.from, filters.to, filters.offset,
      provider.name, provider.model, filters.q, mode === 'hybrid']);
  if (result.rows[0].missing > 0) throw new SemanticUnavailable();
  return documentPage(result.rows[0].items, result.rows[0].total, filters.offset);
}
