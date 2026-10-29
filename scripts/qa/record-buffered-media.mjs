import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdirSync, readFileSync, writeFileSync, readdirSync} from 'node:fs';
import {isAbsolute, resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {content, excerpts} from '../../partner-portal/content.mjs';
import {readyBufferedVideo} from '../../tests/partner-portal-video.browser.mjs';

const [base, output] = process.argv.slice(2);
assert(['http://127.0.0.1:4177', 'https://sports-green-moove-progress.mohamed-redha.chatgpt.site'].includes(base));
assert(isAbsolute(output ?? '')); mkdirSync(output);
const save = (name, value) => writeFileSync(resolve(output, name), JSON.stringify(value, null, 2) + '\n', {flag: 'wx'});
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const result = {scope: 'short-clip-playback-not-mobile-app-or-release-proof', site: base, observedAt: new Date().toISOString(),
  approvedLimitBytes: 240000, completed: false, browserClosed: false, cases: [], errors: []};
save('started.json', {scope: result.scope, observedAt: result.observedAt});
let browser;
try {
  const expected = JSON.parse(readFileSync(new URL('../../partner-portal/dist/data.json', import.meta.url)));
  const live = await fetch(base + '/data.json'); assert.equal(live.status, 200);
  const data = await live.json(); assert.deepEqual(data, expected);
  result.assetRevision = data.assetRevision;
  result.implementationSha256 = {};
  for (const path of ['index.html', `assets/${data.assetRevision}/short-video.js`, `assets/${data.assetRevision}/app.js`]) {
    const response = await fetch(base + '/' + path); assert.equal(response.status, 200);
    const actual = Buffer.from(await response.arrayBuffer());
    assert.deepEqual(actual, readFileSync(new URL('../../partner-portal/dist/' + path, import.meta.url)));
    result.implementationSha256[path] = hash(actual);
  }
  result.media = Object.fromEntries(Object.keys(excerpts).map(id => {
    const file = id + '.mp4', bytes = readFileSync(new URL('../../partner-portal/dist/media/' + file, import.meta.url));
    assert.equal(hash(bytes), data.mediaRevisions[file]); assert.equal(bytes.length, data.shortClipBytes[file]);
    return [file, {bytes: bytes.length, sha256: hash(bytes)}];
  }));
  const {chromium} = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE_PATH).href);
  browser = await chromium.launch({headless: true, executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH});
  const page = await browser.newPage();
  page.on('pageerror', error => result.errors.push(error.name));
  page.on('response', response => {if (response.status() >= 400) result.errors.push('http-' + response.status());});
  await page.addInitScript(() => {
    const create = URL.createObjectURL.bind(URL), revoke = URL.revokeObjectURL.bind(URL);
    window.clipUrls = {created: [], revoked: []};
    URL.createObjectURL = blob => {const url = create(blob); window.clipUrls.created.push(url); return url;};
    URL.revokeObjectURL = url => {window.clipUrls.revoked.push(url); revoke(url);};
  });
  for (const width of [1440, 768, 390, 320]) for (const id of Object.keys(excerpts)) {
    await page.setViewportSize({width, height: 1000});
    const flow = content.flows.find(row => row.clips?.includes(id));
    const step = flow?.tour?.findIndex(row => row.clip === id) ?? -1;
    const route = flow ? '#parcours/' + flow.id + (step >= 0 ? '/visite/' + (step + 1) : '') : '#parcours/signout/visite/1';
    await page.goto(base + '/' + route); await page.getByRole('dialog').waitFor(); await page.bringToFront();
    let mode = step >= 0 ? 'tour' : 'gallery';
    const selectGalleryClip = async () => {
      for (let i = 0; i < flow.images.length + flow.clips.length; i++) {
        if ((await page.locator('.media-actions a[download]').getAttribute('href'))?.includes(id + '.mp4')) return;
        await page.getByRole('button', {name: 'Preuve suivante', exact: true}).click();
      }
      throw new Error('Clip missing from gallery');
    };
    if (flow && step < 0) await selectGalleryClip();
    if (!flow) {
      mode = 'unlisted-asset-production-player-harness';
      await readyBufferedVideo(page);
      await page.evaluate(async ({id, revision}) => {
        const {bindShortVideo} = await import(`/assets/${revision}/short-video.js`);
        bindShortVideo(document.querySelector('video'), id + '.mp4', document.querySelector('.media-caption'));
      }, {id, revision: data.assetRevision});
    }
    const video = await readyBufferedVideo(page);
    const state = () => video.evaluate(element => ({time: element.currentTime, duration: element.duration,
      controls: element.controls, blobSource: element.src.startsWith('blob:'), error: element.error?.code ?? null,
      seekable: Array.from({length: element.seekable.length}, (_, i) => [element.seekable.start(i), element.seekable.end(i)])}));
    await video.evaluate(element => element.play());
    await page.waitForFunction(() => document.querySelector('video')?.currentTime > .5);
    const before = await state(), target = Math.min(8.8, before.duration - 1);
    await video.evaluate((element, target) => {element.pause(); element.currentTime = target;}, target);
    await page.waitForFunction(target => {
      const video = document.querySelector('video'); return !video.seeking && video.readyState >= 2 && Math.abs(video.currentTime - target) < .1;
    }, target);
    const after = await state();
    const colors = await video.evaluate(element => {
      const canvas = document.createElement('canvas'); canvas.width = 72; canvas.height = 160;
      const context = canvas.getContext('2d'); context.drawImage(element, 0, 0, 72, 160);
      const bytes = context.getImageData(0, 0, 72, 160).data, colors = new Set();
      for (let i = 0; i < bytes.length; i += 4) colors.add(`${bytes[i]},${bytes[i + 1]},${bytes[i + 2]}`);
      return colors.size;
    });
    assert(colors > 100);
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    assert(await page.locator('dialog').evaluate(element => element.scrollWidth <= element.clientWidth));
    const screenshot = `${id}-${width}.png`;
    await page.screenshot({path: resolve(output, screenshot)});
    if (flow) {
      await page.goto(base + '/#parcours/' + flow.id);
      if (step >= 0) await selectGalleryClip();
      const link = await page.locator('.media-actions a[download]').getAttribute('href');
      assert.equal(link, 'media/' + id + '.mp4?v=' + data.mediaRevisions[id + '.mp4']);
      await readyBufferedVideo(page);
    }
    await page.getByRole('button', {name: 'Fermer', exact: true}).click();
    await page.getByRole('dialog').waitFor({state: 'hidden'});
    await page.waitForFunction(() => window.clipUrls.created.length === window.clipUrls.revoked.length);
    assert(await video.evaluate(element => element.paused && !element.hasAttribute('src')));
    const urls = await page.evaluate(() => ({created: window.clipUrls.created.length, revoked: window.clipUrls.revoked.length}));
    result.cases.push({id, width, mode, before, target, after, colors, screenshot, urls, originalDownloadUnchanged: !!flow});
    console.log(JSON.stringify({id, width, mode, passed: true}));
  }
  assert.deepEqual(result.errors, []); result.completed = true;
} finally {
  if (browser) {await browser.close(); result.browserClosed = !browser.isConnected();}
  save('result.json', result);
  save('artifact-sha256.json', Object.fromEntries(readdirSync(output).map(file => [file, hash(readFileSync(resolve(output, file)))])));
}
console.log(JSON.stringify({completed: result.completed, cases: result.cases.length, browserClosed: result.browserClosed}));
