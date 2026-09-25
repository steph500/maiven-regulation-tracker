export class InputError extends Error {}

export interface SearchFilters {
  q: string;
  from: string | null;
  to: string | null;
  offset: number;
}

function readDate(params: URLSearchParams, key: string): string | null {
  const value = params.get(key);
  if (!value) return null;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value < '0001-01-01' ||
      Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new InputError(`${key} must be a valid date in YYYY-MM-DD format`);
  }
  return value;
}

export function parseSearchFilters(params: URLSearchParams): SearchFilters {
  const q = (params.get('q') ?? '').trim();
  if (q.length > 500 || q.includes('\0')) throw new InputError('Search must be 500 characters or fewer');
  const from = readDate(params, 'from');
  const to = readDate(params, 'to');
  if (from && to && from > to) throw new InputError('from must be on or before to');
  const rawOffset = params.get('offset') ?? '0';
  const offset = Number(rawOffset);
  if (!/^\d+$/.test(rawOffset) || !Number.isSafeInteger(offset) || offset > 2_147_483_627) {
    throw new InputError('offset must be a non-negative integer within the supported range');
  }
  return { q, from, to, offset };
}

export function literalPattern(query: string): string {
  return `%${query.replace(/[\\%_]/g, '\\$&')}%`;
}
