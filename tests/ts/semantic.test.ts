import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { vector } from '@electric-sql/pglite-pgvector';
import { readFile } from 'node:fs/promises';

const { state } = vi.hoisted(() => ({ state: { db: null as unknown as PGlite } }));
vi.mock('@/lib/db/pool', () => ({ getPool: () => state.db }));
vi.mock('@/lib/search/embedding-provider.mjs', () => ({
  getEmbeddingProvider: () => ({ name: 'test', model: 'fixture', embed: async () => [[1, ...Array(383).fill(0)]] }),
}));
import { GET } from '@/app/api/search/route';
import { getSearchStatus } from '@/lib/search/semantic';

async function search(query = 'q=water&mode=semantic') {
  const response = await GET(new Request(`http://localhost/api/search?${query}`));
  return { status: response.status, body: await response.json() };
}

beforeAll(async () => {
  state.db = new PGlite({ extensions: { vector } });
  await state.db.exec(await readFile('db/migrations/001_documents.sql', 'utf8'));
  await state.db.exec(`BEGIN; ${await readFile('db/migrations/002_embeddings.sql', 'utf8')} COMMIT;`);
  for (let n = 1; n <= 45; n++) {
    const embedding = [46 - n, n, ...Array(382).fill(0)];
    const result = await state.db.query<{ id: string }>(`INSERT INTO maiven.documents
      (document_number, title, publication_date, html_url, content_hash, search_hash)
      VALUES ($1, $2, '2026-01-01'::date + $3::integer, 'https://www.federalregister.gov/test', 'h', 'h') RETURNING id`,
    [`fixture-${String(n).padStart(2, '0')}`, n === 45 ? 'Water protection' : 'Air emissions', n]);
    await state.db.query(`INSERT INTO maiven.document_embeddings
      (document_id, embedding, embedding_provider, embedding_model, content_hash)
      VALUES ($1, $2, 'test', 'fixture', 'h')`, [result.rows[0].id, JSON.stringify(embedding)]);
  }
}, 30_000);
afterAll(async () => { await state.db.close(); });

it('ranks semantic results by actual pgvector distance, not newest first', async () => {
  const { status, body } = await search();
  expect(status).toBe(200);
  expect(body.items).toHaveLength(20);
  expect(body.items[0].document_number).toBe('fixture-01');
  expect(body.total).toBe(45);
  expect(body.items[0]).not.toHaveProperty('score');
});
it('hybrid fusion promotes a keyword match even when its semantic rank is low', async () => {
  const { body } = await search('q=water&mode=hybrid');
  expect(body.items[0].document_number).toBe('fixture-45');
});
it('applies inclusive dates before semantic ranking', async () => {
  const { body } = await search('q=water&mode=semantic&from=2026-01-10&to=2026-01-12');
  expect(body.items.map((item: { document_number: string }) => item.document_number)).toEqual(['fixture-09', 'fixture-10', 'fixture-11']);
});
it('paginates relevance results without overlap and returns the final partial page', async () => {
  const first = (await search()).body;
  const second = (await search('q=water&mode=semantic&offset=20')).body;
  const third = (await search('q=water&mode=semantic&offset=40')).body;
  expect(new Set([...first.items, ...second.items, ...third.items].map(item => item.id)).size).toBe(45);
  expect(third).toMatchObject({ hasMore: false, nextOffset: null });
});
it.each(['mode=semantic', 'q=water&mode=keyword', 'q=water&mode=hybrid&offset=-1'])('validates enhancement input: %s', async query => {
  expect((await search(query)).status).toBe(400);
});
it('returns an empty page for a date range without documents', async () => {
  expect((await search('q=water&mode=semantic&from=2030-01-01')).body.items).toEqual([]);
});
it('refuses incomplete or stale embeddings instead of silently losing search candidates', async () => {
  expect(await getSearchStatus()).toEqual({ total: 45, semanticReady: true });
  await state.db.exec("UPDATE maiven.document_embeddings SET content_hash = 'stale'");
  expect((await search()).status).toBe(503);
  expect(await getSearchStatus()).toEqual({ total: 45, semanticReady: false });
});
