import assert from 'node:assert/strict';

export async function readyBufferedVideo(page) {
  await page.waitForFunction(() => {
    const video = document.querySelector('video');
    return video && !video.hasAttribute('aria-busy') && video.readyState >= 2 && video.src.startsWith('blob:');
  });
  const video = page.locator('video');
  assert(await video.evaluate(element => element.controls && element.seekable.length === 1
    && element.seekable.end(0) >= element.duration - .1));
  return video;
}
