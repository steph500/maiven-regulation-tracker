import { test, expect } from '@playwright/test';
import type { DocumentPage } from '../../types/documents';

test('real data: browse, append, keyword, inclusive dates, reset and source link', async ({ page, request }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  const baseline: DocumentPage = await (await request.get('/api/documents')).json();
  expect(baseline.items).toHaveLength(20);
  await page.goto('/');
  const cards = page.getByTestId('document-card');
  await expect(cards).toHaveCount(20);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Track EPA Rules');
  const firstTitle = await cards.first().getByRole('heading').textContent();
  await page.getByRole('button', { name: 'Load 20 more', exact: true }).click();
  await expect(cards).toHaveCount(40);
  await expect(cards.first().getByRole('heading')).toHaveText(firstTitle!);
  await page.getByRole('button', { name: 'Reset', exact: true }).click();
  await expect(cards).toHaveCount(20);
  await page.getByRole('searchbox').fill(baseline.items[0].document_number.toLowerCase());
  await page.getByRole('searchbox').press('Enter');
  await expect(cards).toHaveCount(1);
  await expect(cards.first().getByRole('link')).toHaveAttribute('href', baseline.items[0].html_url);
  await expect(cards.first().getByRole('link')).toHaveAttribute('target', '_blank');
  await page.getByRole('button', { name: 'Reset', exact: true }).click();
  await expect(cards).toHaveCount(20);
  const date = baseline.items[0].publication_date;
  const expected: DocumentPage = await (await request.get(`/api/documents?from=${date}&to=${date}`)).json();
  await page.getByRole('button', { name: /^Date range:/ }).click();
  await page.getByLabel('Published from').fill(date);
  await page.getByLabel('Published to').fill(date);
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await expect(page.getByRole('heading', { level: 2 })).toHaveText(`${expected.total} regulation${expected.total === 1 ? '' : 's'}`);
  await expect(cards).toHaveCount(expected.items.length);
  await page.getByRole('button', { name: 'Reset', exact: true }).click();
  await expect(cards).toHaveCount(20);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});

test('real semantic and hybrid search use the separate API', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('document-card')).toHaveCount(20);
  for (const mode of ['Semantic', 'Hybrid']) {
    await page.getByRole('radio', { name: mode, exact: true }).check();
    await page.getByRole('searchbox').fill('pesticide residues on food');
    const responsePromise = page.waitForResponse(response => response.url().includes(`/api/search?`) && response.status() === 200);
    await page.getByRole('button', { name: 'Search', exact: true }).click();
    const result: DocumentPage = await (await responsePromise).json();
    await expect(page.getByTestId('document-card')).toHaveCount(20);
    await expect(page.getByText(`${mode} match`, { exact: true })).toHaveCount(20);
    await expect(page.getByTestId('document-card').first().getByRole('heading')).toHaveText(result.items[0].title);
  }
});

test('empty and error states are useful and recover through reset', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('document-card')).toHaveCount(20);
  await page.getByRole('searchbox').fill('no-such-rule-493860128');
  await page.getByRole('searchbox').press('Enter');
  await expect(page.getByRole('heading', { name: 'No regulations found' })).toBeVisible();
  await page.route('**/api/documents?*', route => route.fulfill({ status: 503, json: { error: 'Test connection failure' } }));
  await page.getByRole('button', { name: 'Reset', exact: true }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'Test connection failure' })).toBeVisible();
  await page.unroute('**/api/documents?*');
  await page.getByRole('button', { name: 'Try again', exact: true }).click();
  await expect(page.getByTestId('document-card')).toHaveCount(20);
});

test('history stays in a keyboard-accessible dialog using an explicit test fixture', async ({ page }) => {
  const document = { id: '11111111-1111-4111-8111-111111111111', title: 'Test-only revised rule',
    abstract: 'Updated test abstract', document_number: 'fixture-history', publication_date: '2026-01-01',
    effective_on: null, agencies: [], html_url: 'https://www.federalregister.gov/', current_version: 2 };
  await page.route('**/api/documents?*', route => route.fulfill({ json: { items: [document], total: 1, offset: 0, pageSize: 20, hasMore: false, nextOffset: null } }));
  await page.route('**/api/documents/*/versions', route => route.fulfill({ json: { items: [
    { ...document, id: 'v2', version_number: 2, captured_at: '2026-02-02' },
    { ...document, id: 'v1', version_number: 1, title: 'Original test rule', captured_at: '2026-01-01' },
  ] } }));
  await page.goto('/');
  const trigger = page.getByRole('button', { name: /View history/ });
  await trigger.click();
  await expect(page.getByRole('dialog', { name: 'Document history' })).toBeVisible();
  await expect(page.getByText('Original test rule', { exact: true })).toBeVisible();
  expect(new URL(page.url()).pathname).toBe('/');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(trigger).toBeFocused();
});
