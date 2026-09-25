import { apiError, jsonResponse } from '@/lib/api/responses';
import { getPool } from '@/lib/db/pool';
import { InputError } from '@/lib/validation/search';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      throw new InputError('Invalid document ID');
    }
    const result = await getPool().query(`
      SELECT json_agg(v ORDER BY version_number DESC) AS items FROM (
        SELECT v.id, d.document_number, v.title, v.abstract,
          v.publication_date, v.effective_on, v.agencies, v.html_url,
          v.version_number, v.captured_at
        FROM maiven.document_versions v JOIN maiven.documents d ON d.id = v.document_id
        WHERE document_id = $1
      ) v`, [id]);
    return result.rows[0].items
      ? jsonResponse({ items: result.rows[0].items })
      : jsonResponse({ error: 'Document not found' }, 404);
  } catch (error) { return apiError(error); }
}
