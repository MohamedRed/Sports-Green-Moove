import assert from 'node:assert/strict';
import { content } from '../partner-portal/content.mjs';

export async function verifyTeamRestartGallery({browser, base, output}) {
  const page = await browser.newPage(), failures = [];
  page.on('pageerror', error => failures.push(error.message));
  page.on('response', response => { if (response.status() >= 400) failures.push(response.status()); });
  const flow = content.flows.find(row => row.id === 'team-enrollment');
  try {
    for (const width of [1440, 768, 390, 320]) {
      await page.setViewportSize({width, height: 1000});
      for (const mode of ['gallery', 'tour']) {
        await page.goto(base + '/#parcours/team-enrollment' + (mode === 'tour' ? '/visite/1' : ''));
        await page.getByRole('dialog').waitFor();
        await page.locator('.detail-heading .date').filter({hasText: 'Essai sur téléphone du 28 octobre 2026'}).waitFor();
        for (const [index, image] of flow.images.slice(0, 5).entries()) {
          await page.getByRole('img', {name: image.alt, exact: true}).waitFor();
          await page.waitForFunction(() => {
            const image = document.querySelector('.media-stage img');
            return image?.complete && image.naturalWidth > 0;
          });
          assert.match(await page.locator('.media-caption').innerText(), /capture de session du 28 octobre/);
          assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
          assert(await page.locator('dialog').evaluate(dialog => dialog.scrollWidth <= dialog.clientWidth));
          assert(await page.locator('.media-stage').evaluate(stage => {
            const bounds = stage.getBoundingClientRect(), image = stage.querySelector('img').getBoundingClientRect();
            return image.left >= bounds.left - 1 && image.right <= bounds.right + 1 &&
              image.top >= bounds.top - 1 && image.bottom <= bounds.bottom + 1 &&
              stage.nextElementSibling.getBoundingClientRect().top >= image.bottom;
          }));
          await page.screenshot({path: `${output}/team-restart-${mode}-${index + 1}-${width}.png`, fullPage: false});
          if (index < 4) {
            if (mode === 'tour') await page.getByRole('link', {name: 'Suivant', exact: true}).click();
            else await page.getByRole('button', {name: 'Preuve suivante', exact: true}).click();
          }
        }
      }
    }
    assert.deepEqual(failures, []);
  } finally { await page.close(); }
}
