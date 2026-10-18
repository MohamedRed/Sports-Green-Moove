import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { content } from '../partner-portal/content.mjs';

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
  await page.getByRole('heading', { name: 'Vidéos', exact: true }).waitFor();
  await page.screenshot({ path: `${output}/desktop-overview.png`, fullPage: true });
  assert(await page.locator('.tour-card .flow-preview').first().evaluate((frame) => {
    const image = frame.querySelector('img').getBoundingClientRect();
    const box = frame.getBoundingClientRect();
    return image.top >= box.top && image.bottom <= box.bottom;
  }), 'Preview must contain the full screenshot');
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
  assert.equal(await page.locator('.flow-row').count(), content.flows.filter((flow) => flow.status === 'blocked').length);
  await page.getByRole('link', { name: 'À faire', exact: true }).click();
  await page.getByRole('heading', { name: 'À faire', exact: true }).waitFor();
  await page.screenshot({ path: `${output}/desktop-next.png`, fullPage: true });
  for (const width of [390, 320, 768]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto(`${base}/#apercu`);
    await page.getByRole('heading', { name: 'Vidéos', exact: true }).waitFor();
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Overflow at ${width}px`);
    await page.screenshot({ path: `${output}/overview-${width}.png`, fullPage: true });
    await page.getByRole('button', { name: /Déconnexion corrigée/ }).click();
    await page.getByRole('dialog').waitFor();
    assert(await page.locator('dialog').evaluate((element) => element.scrollWidth <= element.clientWidth), `Dialog overflow at ${width}px`);
    await page.screenshot({ path: `${output}/detail-${width}.png`, fullPage: true });
    await page.keyboard.press('Escape');
  }
  await page.goto(`${base}/#parcours/booking`);
  const booking = content.flows.find((flow) => flow.id === 'booking');
  const checkedAt = new Intl.DateTimeFormat('fr-BE', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(booking.checkedAt));
  await page.getByText(`Essai local du ${checkedAt}`, { exact: true }).waitFor();
  await page.getByRole('img', { name: booking.images[0].alt, exact: true }).waitFor();
  assert.equal(await page.locator('video').count(), 0);
  assert.equal(await page.locator('.media-navigation').count(), 1);
  await page.screenshot({ path: `${output}/local-booking.png`, fullPage: true });
  for (let image = 0; image < booking.images.length; image++)
    await page.getByRole('button', { name: 'Preuve suivante', exact: true }).click();
  assert.equal(await page.locator('.local-results li').count(), booking.local.checks.length);
  await page.goto(`${base}/#apercu`);
  assert.equal(await page.locator('.tour-card').count(), content.featuredTours.length);
  await page.locator('.tour-card[data-flow="publication"]').click();
  await page.getByText('Étape 1 sur 4', { exact: true }).waitFor();
  await page.getByRole('link', { name: 'Suivant', exact: true }).click();
  await page.getByRole('heading', { name: 'Recueillir les deux accords', exact: true }).waitFor();
  assert.equal(new URL(page.url()).hash, '#parcours/publication/visite/2');
  await page.goBack();
  await page.getByText('Étape 1 sur 4', { exact: true }).waitFor();
  await page.goto(`${base}/#parcours/messages/visite/3`);
  await page.getByRole('heading', { name: 'Échanger avec le conducteur', exact: true }).waitFor();
  await page.getByRole('link', { name: 'Toutes les preuves', exact: true }).click();
  await page.locator('.tour-progress').waitFor({ state: 'detached' });
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto(`${base}/#parcours/clubs/visite/1`);
    await page.getByText('Étape 1 sur 3', { exact: true }).waitFor();
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    assert(await page.locator('dialog').evaluate((element) => element.scrollWidth <= element.clientWidth));
    await page.screenshot({ path: `${output}/tour-${width}.png`, fullPage: true });
  }
  for (const flow of content.flows.filter((item) => item.tour)) {
    await page.goto(`${base}/#parcours/${flow.id}/visite/${flow.tour.length}`);
    await page.getByRole('link', { name: 'Voir toutes les preuves', exact: true }).waitFor();
    if (flow.tour.at(-1).image) {
      assert(await page.locator('.media-stage img').evaluate((img) => img.complete && img.naturalWidth > 0));
    }
  }
  await page.goto(`${base}/#parcours/signout/visite/1`);
  await page.locator('video').evaluate((element) => element.play());
  await page.waitForFunction(() => document.querySelector('video').currentTime > .3);
  await page.getByRole('link', { name: 'Suivant', exact: true }).click();
  await page.getByText('Étape 2 sur 2', { exact: true }).waitFor();
  await page.goto(`${base}/#parcours/tracking`);
  await page.getByRole('heading', { name: 'Pas encore de vidéo' }).waitFor();
  assert.equal(await page.locator('video').count(), 0);
  assert.deepEqual(errors, []);
  console.log('Portal browser checks passed: desktop/mobile, filters, deep links, dialogs, short-video playback, media navigation, no overflow or failed assets.');
} finally {
  await browser.close();
}
