import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const modulePath = process.env.PLAYWRIGHT_MODULE_PATH;
const { chromium } = modulePath ? await import(pathToFileURL(modulePath).href) : await import('playwright');
const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH });
const base = process.env.PORTAL_URL || 'http://127.0.0.1:4177';
const output = process.env.PORTAL_QA_DIR || '/private/tmp/sgm-partner-portal-qa';
mkdirSync(output, { recursive: true });
const errors = [];
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('response', (response) => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });
  await page.goto(base);
  await page.getByRole('heading', { name: 'À voir en quelques secondes' }).waitFor();
  await page.screenshot({ path: `${output}/desktop-overview.png`, fullPage: true });
  await page.getByRole('button', { name: /Déconnexion corrigée/ }).click();
  await page.getByRole('dialog').waitFor();
  const video = page.locator('video');
  await video.evaluate((element) => element.play());
  await page.waitForFunction(() => document.querySelector('video').currentTime > .3);
  const duration = await video.evaluate((element) => element.duration);
  assert(duration > 12 && duration < 14);
  await page.screenshot({ path: `${output}/desktop-flow.png`, fullPage: true });
  await page.getByRole('button', { name: 'Preuve suivante', exact: true }).click();
  await page.getByRole('button', { name: 'Preuve suivante', exact: true }).click();
  await page.locator('.media-stage img').waitFor();
  await page.keyboard.press('Escape');
  await page.locator('dialog').waitFor({ state: 'hidden' });
  assert.equal(await page.locator('dialog').count(), 1);
  assert.equal(await page.getByRole('dialog').isVisible(), false);
  await page.getByRole('searchbox').fill('deconnexion');
  assert.equal(await page.locator('.flow-row').count(), 1);
  await page.getByRole('searchbox').fill('aucun-correspondant');
  await page.getByText('Aucun parcours ne correspond').waitFor();
  await page.getByRole('searchbox').fill('');
  await page.locator('#status').selectOption('blocked');
  assert.equal(await page.locator('.flow-row').count(), 4);
  await page.getByRole('link', { name: 'À résoudre', exact: true }).click();
  await page.getByRole('heading', { name: 'Ce qui reste à résoudre' }).waitFor();
  await page.screenshot({ path: `${output}/desktop-next.png`, fullPage: true });
  for (const width of [390, 320, 768]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto(`${base}/#apercu`);
    await page.getByRole('heading', { name: 'À voir en quelques secondes' }).waitFor();
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Overflow at ${width}px`);
    await page.screenshot({ path: `${output}/overview-${width}.png`, fullPage: true });
    await page.getByRole('button', { name: /Déconnexion corrigée/ }).click();
    await page.getByRole('dialog').waitFor();
    assert(await page.locator('dialog').evaluate((element) => element.scrollWidth <= element.clientWidth), `Dialog overflow at ${width}px`);
    await page.screenshot({ path: `${output}/detail-${width}.png`, fullPage: true });
    await page.keyboard.press('Escape');
  }
  await page.goto(`${base}/#parcours/tracking`);
  await page.getByRole('heading', { name: 'Pas encore de démonstration' }).waitFor();
  assert.equal(await page.locator('video').count(), 0);
  assert.deepEqual(errors, []);
  console.log('Portal browser checks passed: desktop/mobile, filters, deep links, dialogs, short-video playback, media navigation, no overflow or failed assets.');
} finally {
  await browser.close();
}
