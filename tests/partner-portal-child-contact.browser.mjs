import assert from 'node:assert/strict';
import { content } from '../partner-portal/content.mjs';

export async function verifyChildContactGallery({ browser, base, output }) {
  const page = await browser.newPage(), failures = [];
  page.on('pageerror', (error) => failures.push(error.message));
  page.on('response', (response) => { if (response.status() >= 400) failures.push(response.status()); });
  try {
    const flow = content.flows.find((item) => item.id === 'child-emergency');
    assert.equal(flow.images.length, 6);
    for (const width of [1440, 768, 390, 320]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto(base + '/#parcours/child-emergency');
      await page.getByRole('dialog').getByRole('heading', { name: flow.title, exact: true }).waitFor();
      for (const [index, image] of flow.images.entries()) {
        await page.getByRole('img', { name: image.alt, exact: true }).waitFor();
        await page.waitForFunction(() => {
          const image = document.querySelector('.media-stage img');
          return image?.complete && image.naturalWidth > 0;
        });
        if (index < 3) assert.match(image.alt, /sur téléphone.*26 octobre/);
        else assert.match(image.alt, /simulé.*19 octobre/);
        assert.equal(await page.locator('.media-stage.is-landscape').count(), image.landscape ? 1 : 0);
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
        assert(await page.locator('dialog').evaluate((dialog) => dialog.scrollWidth <= dialog.clientWidth));
        assert(await page.locator('.media-stage').evaluate((stage) => {
          const bounds = stage.getBoundingClientRect(), image = stage.querySelector('img').getBoundingClientRect();
          const caption = stage.nextElementSibling.getBoundingClientRect();
          return image.left >= bounds.left - 1 && image.right <= bounds.right + 1 &&
            image.top >= bounds.top - 1 && image.bottom <= bounds.bottom + 1 && caption.top >= image.bottom;
        }));
        await page.screenshot({ path: `${output}/child-contact-${index + 1}-${width}.png`, fullPage: false });
        if (index + 1 < flow.images.length) await page.getByRole('button', { name: 'Preuve suivante', exact: true }).click();
      }
      assert(await page.getByRole('button', { name: 'Preuve suivante', exact: true }).isDisabled());
      await page.goto(base + '/#parcours');
      await page.getByRole('dialog').waitFor({ state: 'hidden' });
    }
    assert.deepEqual(failures, []);
  } finally { await page.close(); }
}

export async function verifyEmergencyProfileTour({ browser, base, output }) {
  const page = await browser.newPage(), failures = [];
  page.on('pageerror', (error) => failures.push(error.message));
  page.on('response', (response) => { if (response.status() >= 400) failures.push(response.status()); });
  try {
    const flow = content.flows.find((item) => item.id === 'emergency-profile');
    for (const width of [1440, 768, 390, 320]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto(base + '/#parcours/emergency-profile/visite/1');
      for (const [index, step] of flow.tour.entries()) {
        await page.getByRole('heading', { name: step.title, exact: true }).waitFor();
        await page.waitForFunction(() => {
          const image = document.querySelector('.media-stage img');
          return image?.complete && image.naturalWidth > 0;
        });
        const image = flow.images.find((item) => item.file === step.image);
        assert.equal(await page.locator('.media-stage img').getAttribute('alt'), image.alt);
        assert.match(image.alt, /20 octobre/);
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
        assert(await page.locator('dialog').evaluate((dialog) => dialog.scrollWidth <= dialog.clientWidth));
        await page.screenshot({ path: `${output}/emergency-profile-${index + 1}-${width}.png`, fullPage: false });
        if (index + 1 < flow.tour.length) await page.getByRole('link', { name: 'Suivant', exact: true }).click();
      }
      await page.getByRole('link', { name: 'Voir toutes les preuves', exact: true }).click();
      await page.locator('.tour-progress').waitFor({ state: 'detached' });
      assert.equal(await page.locator('.media-stage img').getAttribute('alt'), flow.images[0].alt);
      await page.goto(base + '/#parcours');
      await page.getByRole('dialog').waitFor({ state: 'hidden' });
    }
    assert.deepEqual(failures, []);
  } finally { await page.close(); }
}
