import assert from 'node:assert/strict';
import { content } from '../partner-portal/content.mjs';

export async function verifyVehicleCoordinateChecks({ browser, base, output }) {
  const flow = content.flows.find((row) => row.id === 'ride-observation');
  const page = await browser.newPage(); const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('response', (response) => { if (response.status() >= 400) errors.push(response.status() + ' ' + response.url()); });
  try {
    for (const width of [1440, 768, 390, 320]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto(base + '/#parcours');
      await page.getByRole('dialog').waitFor({ state: 'hidden' });
      await page.goto(base + '/#parcours/ride-observation');
      const dialog = page.getByRole('dialog');
      await dialog.getByRole('heading', { name: flow.title, exact: true }).waitFor();
      for (let image = 0; image < flow.images.length; image++)
        await page.getByRole('button', { name: 'Preuve suivante', exact: true }).click();
      await page.getByRole('heading', { name: 'Ce qui a été vérifié', exact: true }).waitFor();
      assert.deepEqual(await page.locator('.local-results li').allTextContents(), flow.local.checks);
      assert(await page.getByRole('button', { name: 'Preuve suivante', exact: true }).isDisabled());
      assert(await dialog.getByText(flow.remaining, { exact: true }).isVisible());
      assert(await dialog.evaluate((element) => element.scrollWidth <= element.clientWidth));
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await page.screenshot({ path: `${output}/vehicle-map-results-${width}.png`, fullPage: false });
    }
    assert.deepEqual(errors, []);
    console.log('Vehicle coordinate results passed at 320, 390, 768 and 1440 pixels; local checks and remaining map scope visible.');
  } finally { await page.close(); }
}
