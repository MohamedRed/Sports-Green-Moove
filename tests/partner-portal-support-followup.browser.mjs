import assert from 'node:assert/strict';
import { content } from '../partner-portal/content.mjs';

export async function verifySupportFollowupTour({ browser, base, output }) {
  const page = await browser.newPage(), failures = [];
  const flow = content.flows.find(item => item.id === 'support');
  assert.equal(flow.tour.length, 9);
  page.on('pageerror', error => failures.push(error.message));
  page.on('response', response => { if (response.status() >= 400) failures.push(response.status()); });
  try {
    for (const width of [1440, 768, 390, 320]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto(`${base}/#parcours/support/visite/1`);
      for (const [index, step] of flow.tour.entries()) {
        await page.getByRole('heading', { name: step.title, exact: true }).waitFor();
        const expected = flow.images.find(image => image.file === step.image);
        await page.getByRole('img', { name: expected.alt, exact: true }).waitFor();
        await page.waitForFunction(() => {
          const image = document.querySelector('.media-stage img');
          return image?.complete && image.naturalWidth > 0;
        });
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
        assert(await page.locator('dialog').evaluate(dialog => dialog.scrollWidth <= dialog.clientWidth));
        assert(await page.locator('.tour-navigation').evaluate(nav => {
          const links = [...nav.querySelectorAll('a')].map(link => link.getBoundingClientRect());
          return links.length < 2 || links[0].right <= links[1].left || links[0].bottom <= links[1].top;
        }), `Tour links overlap at ${width}px, step ${index + 1}`);
        assert(await page.locator('.media-stage').evaluate(stage => {
          const frame = stage.getBoundingClientRect(), image = stage.querySelector('img').getBoundingClientRect();
          const caption = stage.nextElementSibling.getBoundingClientRect();
          return image.left >= frame.left - 1 && image.right <= frame.right + 1 &&
            image.top >= frame.top - 1 && image.bottom <= frame.bottom + 1 && caption.top >= image.bottom;
        }));
        await page.screenshot({ path: `${output}/support-followup-${index + 1}-${width}.png`, fullPage: false });
        if (index + 1 < flow.tour.length) await page.getByRole('link', { name: 'Suivant', exact: true }).click();
      }
      await page.getByRole('link', { name: 'Voir toutes les preuves', exact: true }).click();
      await page.locator('.tour-progress').waitFor({ state: 'detached' });
      assert.equal(await page.locator('.media-stage img').getAttribute('alt'), flow.images[0].alt);
      await page.goto(`${base}/#parcours`);
      await page.getByRole('dialog').waitFor({ state: 'hidden' });
    }
    assert.deepEqual(failures, []);
  } finally { await page.close(); }
}
