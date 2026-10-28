import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { content } from '../partner-portal/content.mjs';
import { partitionUpdates } from '../partner-portal/src/render.js';
import { verifyRemoteRideStopGallery } from './partner-portal-remote-stop.browser.mjs';
import { verifyVehicleCoordinateChecks } from './partner-portal-vehicle-map.browser.mjs';
import { verifyChildContactGallery, verifyEmergencyProfileTour } from './partner-portal-child-contact.browser.mjs';
import { verifySessionRecoveryTours } from './partner-portal-session-restoration.browser.mjs';
import { verifySupportFollowupTour } from './partner-portal-support-followup.browser.mjs';
import { verifySupportSubmissionTour } from './partner-portal-support-submission.browser.mjs';

const modulePath = process.env.PLAYWRIGHT_MODULE_PATH;
const { chromium } = modulePath ? await import(pathToFileURL(modulePath).href) : await import('playwright');
const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH });
const base = process.env.PORTAL_URL || 'http://127.0.0.1:4177';
const output = process.env.PORTAL_QA_DIR || '/private/tmp/sgm-partner-portal-qa';
mkdirSync(output, { recursive: true });
const errors = [];
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const waitForImage = async () => {
    await page.waitForFunction(() => {
      const image = document.querySelector('.media-stage img');
      return image?.complete && image.naturalWidth > 0;
    });
  };
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('response', (response) => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });
  await page.goto(base);
  await page.getByRole('heading', { name: 'Dernières nouvelles', exact: true }).waitFor();
  const skipLink = page.locator('.skip-link');
  assert.equal(await skipLink.evaluate((element) => getComputedStyle(element).clipPath), 'inset(50%)');
  await page.keyboard.press('Tab');
  assert(await skipLink.evaluate((element) => element === document.activeElement));
  assert.equal(await skipLink.evaluate((element) => getComputedStyle(element).clipPath), 'none');
  assert(await skipLink.evaluate((element) => element.getBoundingClientRect().top >= 0));
  await page.keyboard.press('Tab');
  assert.equal(await skipLink.evaluate((element) => getComputedStyle(element).clipPath), 'inset(50%)');
  await page.screenshot({ path: `${output}/desktop-overview.png`, fullPage: true });
  assert.equal(await page.locator('#view-apercu [data-flow], #view-apercu .flow-preview').count(), 0);
  assert.equal(await page.locator('#recent-title + .update').count(), 1);
  const { recent, previous } = partitionUpdates(content.updates);
  const currentNews = page.locator('[aria-labelledby="recent-title"] > .update h3');
  assert.deepEqual(await currentNews.allTextContents(), recent.map((entry) => entry.title));
  const history = page.locator('.previous-updates');
  assert.equal(await history.getAttribute('open'), null);
  await history.locator('summary').click();
  assert.deepEqual(await history.locator('.update h3').allTextContents(), previous.map((entry) => entry.title));
  await history.locator('summary').click();
  await page.getByRole('link', { name: 'Parcours', exact: true }).click();
  await page.getByRole('heading', { name: 'Parcours', exact: true }).waitFor();
  assert.equal(await page.locator('.flow-row').count(), content.flows.length);
  assert(await page.locator('.flow-row .flow-preview').first().evaluate((frame) => {
    const image = frame.querySelector('img').getBoundingClientRect();
    const box = frame.getBoundingClientRect();
    return image.top >= box.top && image.bottom <= box.bottom;
  }), 'Preview must contain the full screenshot');
  await page.screenshot({ path: `${output}/desktop-catalogue.png`, fullPage: true });
  await page.locator('.flow-row[data-flow="signout"]').click();
  await page.getByRole('dialog').waitFor();
  const video = page.locator('video');
  await video.evaluate((element) => element.play());
  await page.waitForFunction(() => document.querySelector('video').currentTime > .3);
  const duration = await video.evaluate((element) => element.duration);
  assert(duration > 12 && duration < 14);
  await page.screenshot({ path: `${output}/desktop-flow.png`, fullPage: true });
  await page.getByRole('link', { name: 'Toutes les preuves', exact: true }).click();
  await page.locator('.media-navigation').waitFor();
  await page.getByRole('button', { name: 'Preuve suivante', exact: true }).click();
  await page.getByRole('button', { name: 'Preuve suivante', exact: true }).click();
  await page.locator('.media-stage img').waitFor();
  await page.keyboard.press('Escape');
  await page.locator('dialog').waitFor({ state: 'hidden' });
  assert.equal(await page.locator('dialog').count(), 1);
  assert.equal(await page.getByRole('dialog').isVisible(), false);
  await page.getByRole('searchbox').fill('deconnexion');
  const normalize = (value) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('fr');
  const matchingIds = content.flows.filter((flow) => normalize(`${flow.title} ${flow.summary}`).includes('deconnexion')).map((flow) => flow.id).sort();
  assert.deepEqual(await page.locator('.flow-row').evaluateAll((rows) => rows.map((row) => row.dataset.flow).sort()), matchingIds);
  await page.getByRole('searchbox').fill('aucun-correspondant');
  await page.getByText('Aucun parcours ne correspond').waitFor();
  await page.getByRole('searchbox').fill('');
  await page.locator('#status').selectOption('blocked');
  assert.equal(await page.locator('.flow-row').count(), content.flows.filter((flow) => flow.status === 'blocked').length);
  await page.locator('#status').selectOption('all');
  await page.getByRole('link', { name: 'À faire', exact: true }).click();
  await page.getByRole('heading', { name: 'À faire', exact: true }).waitFor();
  await page.screenshot({ path: `${output}/desktop-next.png`, fullPage: true });
  for (const width of [390, 320, 768]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto(`${base}/#apercu`);
    await page.getByRole('heading', { name: 'Dernières nouvelles', exact: true }).waitFor();
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Overflow at ${width}px`);
    await page.screenshot({ path: `${output}/overview-${width}.png`, fullPage: true });
    await page.getByRole('link', { name: 'Parcours', exact: true }).click();
    await page.getByRole('heading', { name: 'Parcours', exact: true }).waitFor();
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Catalogue overflow at ${width}px`);
    await page.screenshot({ path: `${output}/catalogue-${width}.png`, fullPage: true });
    await page.locator('.flow-row[data-flow="signout"]').click();
    await page.getByRole('dialog').waitFor();
    assert(await page.locator('dialog').evaluate((element) => element.scrollWidth <= element.clientWidth), `Dialog overflow at ${width}px`);
    await page.screenshot({ path: `${output}/detail-${width}.png`, fullPage: true });
    await page.keyboard.press('Escape');
  }
  await page.goto(`${base}/#parcours/booking`);
  const booking = content.flows.find((flow) => flow.id === 'booking');
  const checkedAt = new Intl.DateTimeFormat('fr-BE', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(booking.checkedAt));
  const currentPhone = booking.latestEvidence === 'phone' || (booking.latestEvidence !== 'local' && booking.phone &&
    (booking.phone.checkedAt ?? booking.checkedAt) === booking.checkedAt);
  await page.getByText(`${currentPhone ? 'Essai sur téléphone' : 'Essai local'} du ${checkedAt}`, { exact: true }).waitFor();
  await page.getByRole('img', { name: booking.images[0].alt, exact: true }).waitFor();
  assert.equal(await page.locator('video').count(), 0);
  assert.equal(await page.locator('.media-navigation').count(), 1);
  await page.screenshot({ path: `${output}/local-booking.png`, fullPage: true });
  for (let image = 0; image < booking.images.length; image++)
    await page.getByRole('button', { name: 'Preuve suivante', exact: true }).click();
  assert.equal(await page.locator('.local-results li').count(), booking.local.checks.length);
  await page.goto(`${base}/#parcours`);
  assert.equal(await page.locator('.flow-row[data-tour]').count(), content.flows.filter((flow) => flow.tour).length);
  await page.locator('.flow-row[data-flow="publication"]').click();
  const publication = content.flows.find(flow => flow.id === 'publication');
  await page.getByText(`Étape 1 sur ${publication.tour.length}`, { exact: true }).waitFor();
  await page.getByRole('link', { name: 'Suivant', exact: true }).click();
  await page.getByRole('heading', { name: publication.tour[1].title, exact: true }).waitFor();
  await waitForImage();
  assert.equal(await page.locator('.media-stage img').getAttribute('alt'),
    publication.images.find(image => image.file === publication.tour[1].image).alt);
  assert.equal(new URL(page.url()).hash, '#parcours/publication/visite/2');
  await page.goBack();
  await page.getByText(`Étape 1 sur ${content.flows.find((f) => f.id === 'publication').tour.length}`, { exact: true }).waitFor();
  const messages = content.flows.find(flow => flow.id === 'messages');
  const messageStep = Math.min(3, messages.tour.length);
  await page.goto(`${base}/#parcours/messages/visite/${messageStep}`);
  await page.getByRole('heading', { name: messages.tour[messageStep - 1].title, exact: true }).waitFor();
  assert.equal(new URL(page.url()).hash, `#parcours/messages/visite/${messageStep}`);
  await page.getByRole('link', { name: 'Toutes les preuves', exact: true }).click();
  await page.locator('.tour-progress').waitFor({ state: 'detached' });
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const flow of content.flows.filter((item) => item.images.some((image) => image.landscape))) {
      await page.goto(`${base}/#parcours`);
      await page.locator('dialog').waitFor({ state: 'hidden' });
      await page.goto(`${base}/#parcours/${flow.id}`);
      await page.getByRole('dialog').waitFor();
      let current = 0;
      for (const [index, image] of flow.images.entries()) {
        if (!image.landscape) continue;
        const target = index + (flow.ui ? 0 : (flow.clips || []).length);
        while (current < target) { await page.getByRole('button', { name: 'Preuve suivante', exact: true }).click(); current++; }
        await page.getByRole('img', { name: image.alt, exact: true }).waitFor();
        await waitForImage();
        assert(await page.locator('.media-stage').evaluate((stage) => {
          const frame = stage.getBoundingClientRect(), image = stage.querySelector('img').getBoundingClientRect();
          const caption = stage.nextElementSibling.getBoundingClientRect();
          return image.left >= frame.left - 1 && image.right <= frame.right + 1 &&
            image.top >= frame.top - 1 && image.bottom <= frame.bottom + 1 && caption.top >= image.bottom;
        }), `Landscape evidence overlaps its caption: ${flow.id}/${image.file} at ${width}px`);
        if (flow.id === 'clubs' && image.file === 'guardian-review-desktop') await page.screenshot({ path: `${output}/landscape-${width}.png`, fullPage: false });
      }
    }
  }
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto(`${base}/#parcours/clubs/visite/1`);
    await page.getByText(`Étape 1 sur ${content.flows.find((flow) => flow.id === 'clubs').tour.length}`, { exact: true }).waitFor();
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    assert(await page.locator('dialog').evaluate((element) => element.scrollWidth <= element.clientWidth));
    await page.screenshot({ path: `${output}/tour-${width}.png`, fullPage: true });
  }
  for (const flow of content.flows.filter((item) => item.tour)) {
    await page.goto(`${base}/#parcours/${flow.id}/visite/${flow.tour.length}`);
    await page.getByRole('link', { name: 'Voir toutes les preuves', exact: true }).waitFor();
    if (flow.tour.at(-1).image) {
      await waitForImage();
      assert(await page.locator('.media-stage img').evaluate((img) => img.complete && img.naturalWidth > 0));
    }
  }
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const id of ['navigation', 'search', 'emergency-contact', 'ride-emergency', 'ride-observation', 'native-startup', 'team-enrollment']) {
      await page.goto(`${base}/#parcours/${id}/visite/1`);
      const flow = content.flows.find((item) => item.id === id);
      await page.getByRole('heading', { name: flow.tour[0].title, exact: true }).waitFor();
      await waitForImage();
      assert(await page.locator('.media-stage img').evaluate((img) => img.complete && img.naturalWidth > 0));
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      assert(await page.locator('dialog').evaluate((element) => element.scrollWidth <= element.clientWidth));
      await page.screenshot({ path: `${output}/phone-${id}-${width}.png`, fullPage: true });
      if (['emergency-contact', 'ride-emergency', 'ride-observation', 'native-startup', 'team-enrollment'].includes(id)) {
        for (let step = 1; step < flow.tour.length; step++) {
          await page.getByRole('link', { name: 'Suivant', exact: true }).click();
          await page.getByRole('heading', { name: flow.tour[step].title, exact: true }).waitFor();
          await waitForImage();
          const expected = flow.images.find((item) => item.file === flow.tour[step].image);
          assert.equal(await page.locator('.media-stage img').getAttribute('alt'), expected.alt);
          assert(await page.locator('dialog').evaluate((element) => element.scrollWidth <= element.clientWidth));
          if (flow.tour[step].image === 'emergency-current-dialer')
            await page.screenshot({ path: `${output}/contact-dialer-${width}.png`, fullPage: false });
          if (['ride-emergency', 'ride-observation', 'native-startup'].includes(id))
            await page.screenshot({ path: `${output}/${id}-${step + 1}-${width}.png`, fullPage: false });
        }
      }
    }
  }
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto(`${base}/#parcours`);
    await page.getByRole('dialog').waitFor({ state: 'hidden' });
    await page.goto(`${base}/#parcours/team-enrollment`);
    await page.getByRole('dialog').getByRole('heading', { name: 'Inscription à une équipe', exact: true }).waitFor();
    const flow = content.flows.find((item) => item.id === 'team-enrollment');
    for (const [index, image] of flow.images.entries()) {
      await waitForImage();
      assert.equal(await page.locator('.media-stage img').getAttribute('alt'), image.alt);
      assert.equal(await page.locator('.media-stage.is-landscape').count(), image.landscape ? 1 : 0);
      assert.match(image.alt, /19 octobre/);
      assert.doesNotMatch(image.alt, /simulé/);
      assert(await page.locator('dialog').evaluate((element) => element.scrollWidth <= element.clientWidth));
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await page.screenshot({ path: `${output}/team-${index + 1}-${width}.png`, fullPage: false });
      await page.getByRole('button', { name: 'Preuve suivante', exact: true }).click();
    }
    await page.getByRole('heading', { name: 'Ce qui a été vérifié', exact: true }).waitFor();
    assert.equal(await page.locator('.local-results li').count(), 4);
  }
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto(`${base}/#parcours`);
    await page.getByRole('dialog').waitFor({ state: 'hidden' });
    await page.goto(`${base}/#parcours/team-review`);
    await page.getByRole('dialog').getByRole('heading', { name: 'Réponse du club', exact: true }).waitFor();
    const flow = content.flows.find((item) => item.id === 'team-review');
    for (const [index, image] of flow.images.entries()) {
      await waitForImage();
      assert.equal(await page.locator('.media-stage img').getAttribute('alt'), image.alt);
      assert.equal(await page.locator('.media-stage.is-landscape').count(), image.landscape ? 1 : 0);
      assert(await page.locator('dialog').evaluate((element) => element.scrollWidth <= element.clientWidth));
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await page.screenshot({ path: `${output}/team-review-${index + 1}-${width}.png`, fullPage: false });
      if (index + 1 < flow.images.length) await page.getByRole('button', { name: 'Preuve suivante', exact: true }).click();
    }
    assert(await page.getByRole('button', { name: 'Preuve suivante', exact: true }).isDisabled());
  }
  await page.goto(`${base}/#parcours/signout/visite/1`);
  await page.locator('video').evaluate((element) => element.play());
  await page.waitForFunction(() => document.querySelector('video').currentTime > .3);
  await page.getByRole('link', { name: 'Suivant', exact: true }).click();
  await page.getByText('Étape 2 sur 2', { exact: true }).waitFor();
  assert.equal(await page.locator('dialog').evaluate((element) => element.scrollTop), 0);
  await page.goto(`${base}/#parcours/tracking`);
  await page.getByRole('img', {name: content.flows.find(flow => flow.id === 'tracking').images[0].alt, exact: true}).waitFor();
  await waitForImage();
  assert.equal(await page.locator('video').count(), 0);
  await page.goto(`${base}/#parcours/social-auth`);
  await page.getByRole('heading', { name: 'Pas encore de vidéo', exact: true }).waitFor();
  assert.equal(await page.locator('video').count(), 0);
  assert.deepEqual(errors, []);
  await verifyRemoteRideStopGallery({ browser, base, output });
  await verifyVehicleCoordinateChecks({ browser, base, output });
  await verifyChildContactGallery({ browser, base, output });
  await verifyEmergencyProfileTour({ browser, base, output });
  await verifySessionRecoveryTours({ browser, base, output });
  await verifySupportFollowupTour({ browser, base, output });
  await verifySupportSubmissionTour({ browser, base, output });
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`${base}/#suite`);
    const blocker = page.locator('.blocker').filter({ hasText: 'Rejouer l’inscription conducteur' });
    await blocker.waitFor();
    assert.match(await blocker.innerText(), /22 octobre/);
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.screenshot({ path: `${output}/payment-return-blocker-${width}.png`, fullPage: false });
    await page.goto(`${base}/#parcours/payments`);
    await page.getByRole('dialog').waitFor();
    await page.getByRole('dialog').getByText('Les pages de retour s’ouvrent à nouveau', { exact: false }).waitFor();
    assert(await page.locator('dialog').evaluate(element => element.scrollWidth <= element.clientWidth));
    await page.screenshot({ path: `${output}/payment-return-flow-${width}.png`, fullPage: true });
  }
  console.log('Portal browser checks passed: desktop/mobile, filters, deep links, dialogs, short-video playback, media navigation, no overflow or failed assets.');
} finally {
  await browser.close();
}
