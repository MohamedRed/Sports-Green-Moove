import assert from 'node:assert/strict';
import {content} from '../partner-portal/content.mjs';

export async function verifyDirectBookingTour({browser, base, output}) {
  const page = await browser.newPage(), failures = [];
  page.on('pageerror', error => failures.push(error.message));
  page.on('response', response => {if (response.status() >= 400) failures.push(response.status());});
  const flow = content.flows.find(row => row.id === 'booking');
  assert.equal(flow.checkedAt, '2026-10-30');
  assert.equal(flow.bookingBeforeAckPhone.checkedAt, flow.checkedAt);
  assert.equal(flow.directBookingPhone.checkedAt, '2026-10-28');
  try {
    for (const width of [1440, 768, 390, 320]) {
      await page.setViewportSize({width, height: 1000});
      await page.goto(base + '/#parcours/booking/visite/1');
      await page.getByRole('dialog').waitFor();
      await page.locator('.detail-heading .date').filter({hasText: 'Essai sur téléphone du 30 octobre 2026'}).waitFor();
      for (const [index, step] of flow.tour.entries()) {
        const image = flow.images.find(row => row.file === step.image);
        await page.getByRole('img', {name: image.alt, exact: true}).waitFor();
        await page.waitForFunction(() => {
          const image = document.querySelector('.media-stage img');
          return image?.complete && image.naturalWidth > 0;
        });
        assert.match(await page.locator('.media-caption').innerText(), /capture de session du 28 octobre/);
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
        assert(await page.locator('dialog').evaluate(dialog => dialog.scrollWidth <= dialog.clientWidth));
        assert(await page.locator('.media-stage').evaluate(stage => {
          const box = stage.getBoundingClientRect(), image = stage.querySelector('img').getBoundingClientRect();
          return image.left >= box.left - 1 && image.right <= box.right + 1 && image.top >= box.top - 1 &&
            image.bottom <= box.bottom + 1 && stage.nextElementSibling.getBoundingClientRect().top >= image.bottom;
        }));
        await page.screenshot({path: `${output}/direct-booking-${index + 1}-${width}.png`, fullPage: false});
        if (index + 1 < flow.tour.length) await page.getByRole('link', {name: 'Suivant', exact: true}).click();
      }
    }
    assert.deepEqual(failures, []);
  } finally { await page.close(); }
}
