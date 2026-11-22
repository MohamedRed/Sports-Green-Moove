import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve, isAbsolute } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';

const output = process.argv[2];
assert(isAbsolute(output || ''), 'Absolute evidence output directory required');
const { chromium } = process.env.PLAYWRIGHT_MODULE_PATH
  ? await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE_PATH).href) : await import('playwright');
const server = await createServer({ configFile: false, root: resolve(import.meta.dirname, '../..'), plugins: [react()],
  server: { host: '127.0.0.1', port: 4196, strictPort: true } });
const steps = [], screenshots = [], external = [], errors = [];
const check = async (id, action) => { await action(); steps.push({ id, status: 'passed' }); };
let browser;
mkdirSync(output, { recursive: true });
try {
  await server.listen();
  browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await context.route('**/*', async route => {
    if (new URL(route.request().url()).origin !== 'http://127.0.0.1:4196') {
      external.push(new URL(route.request().url()).origin); await route.abort();
    } else await route.continue();
  });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  const url = 'http://127.0.0.1:4196/tests/fixtures/reward-payout-component.html';
  let original;
  await check('one-explicit-submit-disables-double-send', async () => {
    await page.goto(url);
    await page.getByRole('button', { name: 'Verser', exact: true }).click();
    assert(await page.getByRole('button', { name: /Vérifier le versement/ }).isDisabled());
    await page.getByRole('button', { name: /Vérifier le versement/ }).evaluate(element => element.click());
    const calls = await page.evaluate(() => window.payoutFixture.calls);
    assert.equal(calls.length, 1); original = calls[0];
    assert.equal(original.amountCents, 750);
  });
  await check('lost-confirmation-survives-reload-with-frozen-amount-and-identity', async () => {
    await page.evaluate(() => window.payoutFixture.reject());
    await page.getByRole('status').getByText('Versement non confirmé.', { exact: false }).waitFor();
    await page.goto(url + '?amount=1500');
    await page.getByRole('button', { name: /Vérifier le versement de 7,50/ }).waitFor();
    await page.getByRole('button', { name: /Vérifier le versement/ }).click();
    assert.deepEqual(await page.evaluate(() => window.payoutFixture.calls), [original]);
    await page.evaluate(() => window.payoutFixture.reject());
    await page.getByRole('status').getByText('Versement non confirmé.', { exact: false }).waitFor();
  });
  await check('pending-control-fits-desktop-and-small-mobile', async () => {
    for (const width of [1440, 768, 390, 320]) {
      await page.setViewportSize({ width, height: 1000 });
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Page overflow at ${width}`);
      if (width < 600) assert(await page.locator('.table-scroll').evaluate(element => element.scrollWidth <= element.clientWidth), `Table overflow at ${width}`);
      const button = page.getByRole('button', { name: /Vérifier le versement/ });
      await button.scrollIntoViewIfNeeded();
      assert(await button.evaluate(element => element.scrollWidth <= element.clientWidth), `Button overflow at ${width}`);
      const file = `payout-pending-${width}.png`; await page.screenshot({ path: resolve(output, file) }); screenshots.push(file);
    }
  });
  await check('confirmation-clears-only-the-matching-pending-request', async () => {
    await page.getByRole('button', { name: /Vérifier le versement/ }).click();
    await page.evaluate(() => window.payoutFixture.resolve());
    await page.getByRole('status').getByText('Versement confirmé', { exact: true }).waitFor();
    assert.equal(await page.evaluate(() => sessionStorage.length), 0);
  });
  await check('corrupt-journal-blocks-new-transfer-without-a-fallback', async () => {
    await page.evaluate(() => sessionStorage.setItem('sgm:reward-payout:v1:["component:admin","driver-1"]', 'invalid-json'));
    await page.reload();
    await page.getByText('Le versement enregistré est inaccessible.', { exact: false }).waitFor();
    assert(await page.getByRole('button', { name: 'Verser', exact: true }).isDisabled());
    assert.deepEqual(await page.evaluate(() => window.payoutFixture.calls), []);
  });
  assert.deepEqual(external, []); assert.deepEqual(errors, []);
  writeFileSync(resolve(output, 'results.json'), JSON.stringify({ testedAt: new Date().toISOString(),
    scope: 'local-management-component-simulated-gateway-not-payout-or-phone', steps, screenshots,
    viewports: [1440, 768, 390, 320], externalRequests: 0, realTransfers: false, nativeOrPhysicalPhone: false }, null, 2) + '\n');
  console.log(JSON.stringify({ passed: steps.length, screenshots: screenshots.length, realTransfers: false }));
} finally { await browser?.close(); await server.close(); }
