import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {isAbsolute, resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {content} from '../../partner-portal/content.mjs';

const output = process.argv[2]; assert(isAbsolute(output ?? '')); mkdirSync(output);
const site = 'https://sports-green-moove-progress.mohamed-redha.chatgpt.site';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const save = (file, value) => writeFileSync(resolve(output, file), JSON.stringify(value, null, 2) + '\n', {flag: 'wx'});
const result = {scope: 'published-short-clip-delivery-not-mobile-app-or-release-proof',
  observedAt: new Date().toISOString(), site, viewport: {width: 1440, height: 1000},
  playbackConfirmed: false, seekConfirmed: false, completed: false, browserClosed: false,
  fallbackUsed: false, playerModified: false, expectedSeekSeconds: 8.8, errorCategory: null};
save('started.json', {scope: result.scope, observedAt: result.observedAt});
let browser, failure;
try {
  const response = await fetch(site + '/media/support-submission-retry.mp4', {headers: {Range: 'bytes=0-15'}});
  const bytes = Buffer.from(await response.arrayBuffer()); assert(bytes.length <= 256 * 1024);
  const original = readFileSync(resolve(import.meta.dirname, '../../partner-portal/dist/media/support-submission-retry.mp4'));
  assert.deepEqual(bytes, original);
  result.delivery = {requestedRange: 'bytes=0-15', status: response.status,
    contentType: response.headers.get('content-type'), contentRange: response.headers.get('content-range'),
    acceptRanges: response.headers.get('accept-ranges'), bytes: bytes.length, sha256: sha(bytes), originalBytesMatched: true};
  writeFileSync(resolve(output, 'received-clip.mp4'), bytes, {flag: 'wx'});
  const modulePath = process.env.PLAYWRIGHT_MODULE_PATH; assert(isAbsolute(modulePath ?? ''));
  const {chromium} = await import(pathToFileURL(modulePath).href);
  browser = await chromium.launch({headless: true, executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH});
  const page = await browser.newPage({viewport: result.viewport});
  const flow = content.flows.find(row => row.id === 'support-submission');
  const step = flow.tour.findIndex(row => row.clip === 'support-submission-retry') + 1; assert(step > 0);
  await page.goto(site + '/#parcours/support-submission/visite/' + step);
  await page.getByRole('dialog').waitFor(); await page.bringToFront();
  const video = page.locator('video');
  const state = () => video.evaluate(element => ({currentTime: element.currentTime, duration: element.duration,
    paused: element.paused, seeking: element.seeking, readyState: element.readyState, networkState: element.networkState,
    visible: document.visibilityState === 'visible', errorCode: element.error?.code ?? null,
    buffered: Array.from({length: element.buffered.length}, (_, i) => [element.buffered.start(i), element.buffered.end(i)]),
    seekable: Array.from({length: element.seekable.length}, (_, i) => [element.seekable.start(i), element.seekable.end(i)])}));
  result.phase = 'playback'; await video.evaluate(element => element.play());
  await page.waitForFunction(() => document.querySelector('video')?.currentTime > .5);
  result.playbackConfirmed = true; result.beforeSeek = await state();
  result.phase = 'seek'; await video.evaluate(element => {element.pause(); element.currentTime = 8.8;});
  try {
    await page.waitForFunction(() => {
      const element = document.querySelector('video'); return element.readyState >= 2 && !element.seeking && element.currentTime > 8.7;
    });
    result.seekConfirmed = true;
  } finally {result.afterSeek = await state();}
  result.completed = true;
} catch (error) {
  result.errorCategory = error?.name === 'TimeoutError' ? 'browser-wait-timeout' : 'probe-error'; failure = error;
} finally {
  if (browser) {await browser.close(); result.browserClosed = !browser.isConnected();}
  save('result.json', result);
  const files = ['started.json', 'result.json', ...(result.delivery ? ['received-clip.mp4'] : [])];
  save('artifact-sha256.json', Object.fromEntries(files.map(file => [file, sha(readFileSync(resolve(output, file)))])));
}
console.log(JSON.stringify({phase: result.phase, playbackConfirmed: result.playbackConfirmed,
  seekConfirmed: result.seekConfirmed, completed: result.completed, browserClosed: result.browserClosed, errorCategory: result.errorCategory}));
if (failure) process.exitCode = 1;
