import { apiError, jsonResponse } from '@/lib/api/responses';
import { parseSearchFilters, InputError } from '@/lib/validation/search';
import { searchDocumentsByMeaning, SemanticUnavailable } from '@/lib/search/semantic';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const filters = parseSearchFilters(params);
    const mode = params.get('mode');
    if (!filters.q) throw new InputError('Enter a search description');
    if (mode !== 'semantic' && mode !== 'hybrid') throw new InputError('mode must be semantic or hybrid');
    return jsonResponse(await searchDocumentsByMeaning(filters, mode));
  } catch (error) {
    if (error instanceof SemanticUnavailable) {
      return jsonResponse({ error: 'Semantic indexing is being updated. Keyword search is available.' }, 503);
    }
    return apiError(error);
  }
}
