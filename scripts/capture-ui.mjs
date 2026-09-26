import { chromium, devices } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

const browser = await chromium.launch();
await mkdir('docs/screenshots', { recursive: true });
for (const [name, options] of [
  ['desktop', { viewport: { width: 1440, height: 1000 } }],
  ['mobile', { ...devices['iPhone 13'] }],
]) {
  const context = await browser.newContext(options);
  const page = await context.newPage();
  await page.goto(process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000');
  await page.getByTestId('document-card').nth(19).waitFor();
  await page.getByText(/\d+ documents indexed/).waitFor();
  await page.screenshot({ path: `docs/screenshots/${name}.jpg`, quality: 85, scale: 'css' });
  await context.close();
}
await browser.close();
