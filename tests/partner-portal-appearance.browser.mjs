import assert from 'node:assert/strict';
import {content} from '../partner-portal/content.mjs';

export async function verifyAppearanceGallery({browser, base, output}) {
  const page = await browser.newPage(), errors = [];
  const flow = content.flows.find(row => row.id === 'appearance');
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => {if (response.status() >= 400) errors.push(response.status() + ' ' + response.url());});
  try {
    for (const width of [1440, 768, 390, 320]) {
      await page.setViewportSize({width, height: 1000});
      await page.goto(base + '/#parcours');
      await page.getByRole('dialog').waitFor({state: 'hidden'});
      await page.goto(base + '/#parcours/appearance');
      const dialog = page.getByRole('dialog');
      await dialog.getByRole('heading', {name: flow.title, exact: true}).waitFor();
      await dialog.getByText(flow.remaining, {exact: true}).waitFor();
      for (const image of flow.images.slice(0, 8)) {
        const picture = dialog.getByRole('img', {name: image.alt, exact: true});
        await picture.waitFor();
        await page.waitForFunction(() => {
          const image = document.querySelector('.media-stage img');
          return image?.complete && image.naturalWidth > 0;
        });
        assert.deepEqual(await picture.evaluate(image => [image.naturalWidth, image.naturalHeight]),
          image.landscape ? [900, 600] : [960, 2100]);
        assert(await dialog.getByText(image.alt, {exact: true}).isVisible());
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
        assert(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth));
        assert(await page.locator('.media-stage').evaluate(stage => {
          const box = stage.getBoundingClientRect(), image = stage.querySelector('img').getBoundingClientRect();
          return image.left >= box.left - 1 && image.right <= box.right + 1 && image.top >= box.top - 1 &&
            image.bottom <= box.bottom + 1 && stage.nextElementSibling.getBoundingClientRect().top >= image.bottom;
        }));
        await page.screenshot({path: `${output}/${image.file}-${width}.png`, fullPage: false});
        await dialog.getByRole('button', {name: 'Preuve suivante', exact: true}).click();
      }
      await dialog.getByRole('img', {name: flow.images[8].alt, exact: true}).waitFor();
    }
    assert.deepEqual(errors, []);
    console.log('Eight enlarged-text viewports display complete at 320, 390, 768 and 1440 pixels; old gallery preserved.');
  } finally {await page.close();}
}
