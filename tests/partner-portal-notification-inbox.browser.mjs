import assert from 'node:assert/strict';
import {content} from '../partner-portal/content.mjs';

export async function verifyNotificationInboxGallery({browser, base, output}) {
  const page = await browser.newPage(), errors = [];
  const flow = content.flows.find(row => row.id === 'team-conversation');
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => {if (response.status() >= 400) errors.push(response.status() + ' ' + response.url());});
  try {
    for (const width of [1440, 768, 390, 320]) {
      await page.setViewportSize({width, height: 1000});
      await page.goto(base + '/#parcours/team-conversation');
      const dialog = page.getByRole('dialog');
      await dialog.getByText(flow.remaining, {exact: true}).waitFor();
      const phoneImages = flow.images.filter(image => /^team-alert-(phone|retry)-/.test(image.file));
      assert.equal(phoneImages.length, 7);
      assert.deepEqual(flow.images.slice(0, 7), phoneImages);
      for (const image of phoneImages) {
        const picture = dialog.getByRole('img', {name: image.alt, exact: true}); await picture.waitFor();
        await page.waitForFunction(() => {
          const image = document.querySelector('.media-stage img'); return image?.complete && image.naturalWidth > 0;
        });
        assert.deepEqual(await picture.evaluate(image => [image.naturalWidth, image.naturalHeight]), [198, 442]);
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
        assert(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth));
        await page.screenshot({path: `${output}/${image.file}-${width}.png`, fullPage: false});
        await dialog.getByRole('button', {name: 'Preuve suivante', exact: true}).click();
      }
      await dialog.getByRole('img', {name: flow.images[7].alt, exact: true}).waitFor();
      await dialog.getByRole('link', {name: 'Visite guidée', exact: true}).click();
      for (const [index, step] of flow.tour.entries()) {
        await dialog.getByRole('heading', {name: step.title, exact: true}).waitFor();
        await dialog.getByText(step.text, {exact: true}).waitFor();
        await dialog.getByRole('link', {name: index === flow.tour.length - 1 ? 'Voir toutes les preuves' : 'Suivant', exact: true}).click();
      }
    }
    assert.deepEqual(errors, []);
    console.log('Seven in-app alert crops and all thirty-two older team tour steps pass at four widths.');
  } finally {await page.close();}
}
