import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { GET } from '@/app/api/documents/route';
import { getPool } from '@/lib/db/pool';
import type { DocumentPage } from '@/types/documents';

async function request(query = '') { return GET(new Request(`http://localhost/api/documents?${query}`)); }
async function page(query = ''): Promise<DocumentPage> { return (await request(query)).json(); }

describe('required documents API against PostgreSQL', () => {
  beforeAll(async () => {
    const url = process.env.TEST_DATABASE_URL;
    if (!url) throw new Error('TEST_DATABASE_URL is required; tests must execute against PostgreSQL');
    const parsed = new URL(url);
    if (!parsed.pathname.endsWith('_test') || !['localhost', '127.0.0.1', 'db'].includes(parsed.hostname)) {
      throw new Error('Only a local database ending _test may be reset');
    }
    process.env.DATABASE_URL = url;
    await getPool().query('DROP SCHEMA IF EXISTS maiven CASCADE');
    await getPool().query(await readFile('db/migrations/001_documents.sql', 'utf8'));
    await getPool().query(`INSERT INTO maiven.documents
      (document_number, title, abstract, publication_date, html_url, content_hash, search_hash)
      SELECT 'test-' || lpad(n::text, 3, '0'), 'Air quality ' || n,
        CASE WHEN n % 2 = 0 THEN 'PFAS in WATER' ELSE 'Factory emissions' END,
        '2026-01-01'::date + n - 1, 'https://www.federalregister.gov/documents/test-' || n, 'test', 'test'
      FROM generate_series(1, 65) AS n`);
  });
  afterAll(async () => { await getPool().end(); });

  it('returns newest-first and exactly 20 with useful metadata', async () => {
    const result = await page();
    expect(result.items).toHaveLength(20);
    expect(result.items[0].document_number).toBe('test-065');
    expect(result).toMatchObject({ total: 65, offset: 0, pageSize: 20, nextOffset: 20, hasMore: true });
    const dates = result.items.map(item => item.publication_date);
    expect(dates).toEqual([...dates].sort().reverse());
  });
  it('fetches distinct next batches at offsets 20 and 40', async () => {
    const pages = await Promise.all([page(), page('offset=20'), page('offset=40')]);
    expect(new Set(pages.flatMap(result => result.items.map(item => item.id))).size).toBe(60);
    expect(pages.map(result => result.items.length)).toEqual([20, 20, 20]);
    expect((await page('offset=60'))).toMatchObject({ hasMore: false, nextOffset: null });
  });
  it.each([
    ['from=2026-01-20', 46], ['to=2026-01-20', 20],
    ['from=2026-01-10&to=2026-01-20', 11], ['from=2026-01-20&to=2026-01-20', 1],
  ])('includes date boundaries: %s', async (query, total) => { expect((await page(query)).total).toBe(total); });
  it('matches title and abstract case-insensitively', async () => {
    expect((await page('q=aIR')).total).toBe(65);
    expect((await page('q=water')).total).toBe(32);
    expect((await page('q=WaTeR')).items).toEqual((await page('q=WATER')).items);
  });
  it('combines query and dates and searches document numbers', async () => {
    expect((await page('q=water&from=2026-01-10&to=2026-01-20')).total).toBe(6);
    expect((await page('q=test-010')).total).toBe(1);
  });
  it.each(['q=absent', 'q=%25', 'q=%27%20OR%201%3D1--', 'offset=1000'])('returns empty safely: %s', async query => {
    expect((await page(query)).items).toEqual([]);
  });
  it.each(['from=invalid', 'from=2026-02-30', 'to=20260101', 'from=0000-01-01',
    'from=2026-02-01&to=2026-01-01', 'offset=-1', 'offset=1.5', 'offset=1e2', 'offset=99999999999999999'])('rejects invalid input: %s', async query => {
    const result = await request(query);
    expect(result.status).toBe(400);
    expect((await result.json()).error).toBeTypeOf('string');
  });
});
