import assert from 'node:assert/strict';
import {content} from '../partner-portal/content.mjs';

export async function verifySearchDepartureGallery({browser, base, output}) {
  const page = await browser.newPage(), errors = [];
  const flow = content.flows.find(row => row.id === 'search');
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => {if (response.status() >= 400) errors.push(response.status() + ' ' + response.url());});
  try {
    for (const width of [1440, 768, 390, 320]) {
      await page.setViewportSize({width, height: 1000});
      await page.goto(base + '/#parcours');
      await page.getByRole('dialog').waitFor({state: 'hidden'});
      await page.goto(base + '/#parcours/search');
      const dialog = page.getByRole('dialog');
      await dialog.getByRole('heading', {name: flow.title, exact: true}).waitFor();
      await dialog.getByText(flow.remaining, {exact: true}).waitFor();
      for (const image of flow.images.filter(row => row.file.startsWith('search-departure-'))) {
        const picture = dialog.getByRole('img', {name: image.alt, exact: true});
        await picture.waitFor();
        await page.waitForFunction(() => {
          const image = document.querySelector('.media-stage img');
          return image?.complete && image.naturalWidth > 0;
        });
        assert.deepEqual(await picture.evaluate(image => [image.naturalWidth, image.naturalHeight]), [240, 510]);
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
        assert(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth));
        assert(await page.locator('.media-stage').evaluate(stage => {
          const box = stage.getBoundingClientRect(), image = stage.querySelector('img').getBoundingClientRect();
          return image.left >= box.left - 1 && image.right <= box.right + 1 && image.top >= box.top - 1 && image.bottom <= box.bottom + 1;
        }));
        await page.screenshot({path: `${output}/${image.file}-${width}.png`, fullPage: false});
        await dialog.getByRole('button', {name: 'Preuve suivante', exact: true}).click();
      }
      await dialog.getByRole('img', {name: flow.images[5].alt, exact: true}).waitFor();
      await dialog.getByRole('link', {name: 'Visite guidée', exact: true}).click();
      const firstTourImage = flow.images.find(row => row.file === flow.tour[0].image);
      await dialog.getByRole('img', {name: firstTourImage.alt, exact: true}).waitFor();
    }
    assert.deepEqual(errors, []);
    console.log('Five physical calendar captures fit all four widths; the older full-search gallery and tour remain available.');
  } finally {await page.close();}
}
