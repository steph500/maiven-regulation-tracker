import { apiError, jsonResponse } from '@/lib/api/responses';
import { searchDocuments } from '@/lib/search/documents';
import { parseSearchFilters } from '@/lib/validation/search';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<Response> {
  try {
    const filters = parseSearchFilters(new URL(request.url).searchParams);
    return jsonResponse(await searchDocuments(filters));
  } catch (error) {
    return apiError(error);
  }
}
