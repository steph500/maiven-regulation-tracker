import { InputError } from '@/lib/validation/search';

export function jsonResponse(data: unknown, status = 200): Response {
  return Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
}

export function apiError(error: unknown): Response {
  if (error instanceof InputError) return jsonResponse({ error: error.message }, 400);
  console.error('Document API request failed');
  return jsonResponse({ error: 'Documents could not be loaded. Please try again shortly.' }, 503);
}
