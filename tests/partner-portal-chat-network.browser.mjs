import assert from 'node:assert/strict';
import {content} from '../partner-portal/content.mjs';

export async function verifyChatNetworkPhoneGallery({browser, base, output}) {
  const page = await browser.newPage(), errors = [], flow = content.flows.find(row => row.id === 'messages');
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => {if (response.status() >= 400) errors.push(response.status() + ' ' + response.url());});
  try {
    for (const width of [1440, 768, 390, 320]) {
      await page.setViewportSize({width, height: 1000});
      await page.goto(base + '/#parcours'); await page.getByRole('dialog').waitFor({state: 'hidden'});
      await page.goto(base + '/#parcours/messages');
      const dialog = page.getByRole('dialog');
      await dialog.getByText(flow.verified, {exact: true}).waitFor();
      await dialog.getByText(flow.remaining, {exact: true}).waitFor();
      for (const image of flow.images.slice(0, 4)) {
        const picture = dialog.getByRole('img', {name: image.alt, exact: true}); await picture.waitFor();
        await page.waitForFunction(() => {
          const image = document.querySelector('.media-stage img'); return image?.complete && image.naturalWidth > 0;
        });
        assert.deepEqual(await picture.evaluate(image => [image.naturalWidth, image.naturalHeight]), [216, 457]);
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
        assert(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth));
        assert(await page.locator('.media-stage').evaluate(stage => {
          const box = stage.getBoundingClientRect(), image = stage.querySelector('img').getBoundingClientRect();
          return image.left >= box.left - 1 && image.right <= box.right + 1 && image.top >= box.top - 1 && image.bottom <= box.bottom + 1;
        }));
        await page.screenshot({path: `${output}/${image.file}-${width}.png`, fullPage: false});
        await dialog.getByRole('button', {name: 'Preuve suivante', exact: true}).click();
      }
      await dialog.getByRole('img', {name: flow.images[4].alt, exact: true}).waitFor();
      await dialog.getByRole('link', {name: 'Visite guidée', exact: true}).click();
      for (const step of flow.tour) {
        await dialog.getByRole('heading', {name: step.title, exact: true}).waitFor();
        await dialog.getByText(step.text, {exact: true}).waitFor();
        await dialog.getByRole('link', {name: step === flow.tour.at(-1) ? 'Voir toutes les preuves' : 'Suivant', exact: true}).click();
      }
    }
    assert.deepEqual(errors, []);
    console.log('Four controlled chat phone captures fit all four widths; the older simulated tour and gallery remain available.');
  } finally {await page.close();}
}
