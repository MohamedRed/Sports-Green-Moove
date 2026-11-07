import assert from 'node:assert/strict';
import { content } from '../partner-portal/content.mjs';

export async function verifyRemoteRideStopGallery({ browser, base, output }) {
  const flow = content.flows.find((row) => row.id === 'remote-ride-stop');
  const page = await browser.newPage(); const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('response', (response) => { if (response.status() >= 400) errors.push(response.status() + ' ' + response.url()); });
  try {
    for (const width of [1440, 768, 390, 320]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto(base + '/#parcours/remote-ride-stop');
      const dialog = page.getByRole('dialog');
      await dialog.getByRole('heading', { name: flow.title, exact: true }).waitFor();
      await page.waitForFunction(() => {
        const image = document.querySelector('.media-stage img');
        return image?.complete && image.naturalWidth > 0;
      });
      assert.equal(await page.locator('.media-stage img').getAttribute('alt'), flow.images[0].alt);
      assert.equal(await page.getByRole('button', { name: 'Preuve suivante', exact: true }).count(), 0);
      assert(await dialog.getByText(flow.remaining, { exact: true }).isVisible());
      assert(await dialog.evaluate((element) => element.scrollWidth <= element.clientWidth));
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await page.screenshot({ path: `${output}/remote-stop-${width}.png`, fullPage: false });
    }
    assert.deepEqual(errors, []);
    console.log('Remote-stop gallery passed at 320, 390, 768 and 1440 pixels; one reviewed capture and actual limits visible.');
  } finally { await page.close(); }
}
