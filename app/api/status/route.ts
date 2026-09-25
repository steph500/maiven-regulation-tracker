import { apiError, jsonResponse } from '@/lib/api/responses';
import { getSearchStatus } from '@/lib/search/semantic';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET() {
  try { return jsonResponse(await getSearchStatus()); }
  catch (error) { return apiError(error); }
}
