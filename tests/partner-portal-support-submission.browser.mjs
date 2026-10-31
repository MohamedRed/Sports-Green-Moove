import assert from 'node:assert/strict';
import { content } from '../partner-portal/content.mjs';
import {readyBufferedVideo} from './partner-portal-video.browser.mjs';

export async function verifySupportSubmissionTour({ browser, base, output }) {
  const page = await browser.newPage(), errors = [];
  const flow = content.flows.find(item => item.id === 'support-submission');
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => { if (response.status() >= 400) errors.push(response.status()); });
  try {
    for (const width of [1440, 768, 390, 320]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto(`${base}/#parcours/${flow.id}/visite/1`);
      await page.getByRole('dialog').waitFor();
      await page.getByRole('heading', { name: flow.tour[0].title, exact: true }).waitFor();
      await page.bringToFront();
      for (const [index, step] of flow.tour.entries()) {
        if (index) await page.getByRole('link', { name: 'Suivant', exact: true }).click();
        await page.getByRole('heading', { name: step.title, exact: true }).waitFor();
        if (step.clip) await verifyRecordedClip(page, width, output);
        else {
          const expected = flow.images.find(image => image.file === step.image);
          await page.getByRole('img', { name: expected.alt, exact: true }).waitFor();
          await page.waitForFunction(() => {
            const image = document.querySelector('.media-stage img'); return image?.complete && image.naturalWidth > 0;
          });
        }
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
        assert(await page.locator('dialog').evaluate(dialog => dialog.scrollWidth <= dialog.clientWidth));
        await page.screenshot({ path: `${output}/support-submission-step-${index + 1}-${width}.png`, fullPage: false });
      }
      await page.goto(`${base}/#parcours`); await page.getByRole('dialog').waitFor({ state: 'hidden' });
    }
    assert.deepEqual(errors, []);
  } finally { await page.close(); }
}

async function verifyRecordedClip(page, width, output) {
  const video = await readyBufferedVideo(page); await video.evaluate(element => element.play());
  try { await page.waitForFunction(() => document.querySelector('video')?.currentTime > .5); }
  catch (cause) {
    const state = await video.evaluate(element => ({ current: element.currentTime, paused: element.paused,
      ready: element.readyState, visibility: document.visibilityState, error: element.error?.message }));
    throw new Error(`Support playback stalled at ${width}px: ${JSON.stringify(state)}`, { cause });
  }
  const duration = await video.evaluate(element => element.duration); assert(duration > 9.9 && duration < 10.1);
  await video.evaluate(element => { element.pause(); element.currentTime = 8.8; });
  await page.waitForFunction(() => {
    const element = document.querySelector('video'); return element.readyState >= 2 && !element.seeking && element.currentTime > 8.7;
  });
  assert(await video.evaluate(element => {
    const canvas = document.createElement('canvas'); canvas.width = 72; canvas.height = 160;
    const context = canvas.getContext('2d'); context.drawImage(element, 0, 0, 72, 160);
    const bytes = context.getImageData(0, 0, 72, 160).data;
    const colors = new Set(); for (let at = 0; at < bytes.length; at += 4) colors.add(`${bytes[at]},${bytes[at + 1]},${bytes[at + 2]}`);
    return colors.size > 100;
  }), 'Recorded video must render real, nonblank pixels');
  await page.screenshot({ path: `${output}/support-submission-video-${width}.png`, fullPage: false });
}
