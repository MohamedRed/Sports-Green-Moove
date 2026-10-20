import assert from 'node:assert/strict';
import { content } from '../partner-portal/content.mjs';

export async function verifySessionRecoveryTours({ browser, base, output }) {
  const page = await browser.newPage(), failures = [];
  page.on('pageerror', error => failures.push(error.message));
  page.on('response', response => { if (response.status() >= 400) failures.push(response.status()); });
  try {
    for (const id of ['session-restoration', 'session-disconnect']) for (const width of [1440, 768, 390, 320]) {
      const flow = content.flows.find(item => item.id === id);
      await page.setViewportSize({ width, height: 1000 });
      await page.goto(base + '/#parcours/' + id + '/visite/1');
      for (const [index, step] of flow.tour.entries()) {
        await page.getByRole('heading', { name: step.title, exact: true }).waitFor();
        await page.waitForFunction(() => {
          const image = document.querySelector('.media-stage img');
          return image?.complete && image.naturalWidth > 0;
        });
        const image = flow.images.find(item => item.file === step.image);
        assert.equal(await page.locator('.media-stage img').getAttribute('alt'), image.alt);
        assert.match(image.alt, /essai local du 20 octobre/);
        assert.equal(await page.locator('.media-stage.is-landscape').count(), image.landscape ? 1 : 0);
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
        assert(await page.locator('dialog').evaluate(dialog => dialog.scrollWidth <= dialog.clientWidth));
        assert(await page.locator('.media-stage').evaluate(stage => {
          const bounds = stage.getBoundingClientRect(), image = stage.querySelector('img').getBoundingClientRect();
          const caption = stage.nextElementSibling.getBoundingClientRect();
          return image.left >= bounds.left - 1 && image.right <= bounds.right + 1 &&
            image.top >= bounds.top - 1 && image.bottom <= bounds.bottom + 1 && caption.top >= image.bottom;
        }));
        await page.screenshot({ path: `${output}/${id}-${index + 1}-${width}.png`, fullPage: false });
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
