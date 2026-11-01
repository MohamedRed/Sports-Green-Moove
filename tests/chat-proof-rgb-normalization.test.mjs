import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import test from 'node:test';
import {PNG} from 'pngjs';
import {cropDecodedSession, readSessionCrop, sessionClip} from '../scripts/lib/session-image-crop.mjs';
import {chatRgbFolder, validateChatRgbNormalization} from '../partner-portal/chat-proof-rgb-validation.mjs';
import {content, captures} from '../partner-portal/content.mjs';

const root = fileURLToPath(new URL('..', import.meta.url)), base = join(root, chatRgbFolder);
const json = file => JSON.parse(readFileSync(join(base, file)));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const expected = {captures: 3, exactRgbaPixels: true, originalsUnchanged: true, previousNegativeRetained: true,
  newPhoneTrial: false, releaseAccepted: false};
test('three reviewed lossless crops preserve every pixel from the fixed original JPEG decode', () => {
  assert.deepEqual(validateChatRgbNormalization(root), expected);
  for (const image of json('review.json').images) {
    const {source, crop} = cropDecodedSession(readFileSync(join(root, image.source)));
    for (let row = 0; row < sessionClip.height; row++) {
      const from = ((row + sessionClip.y) * source.width + sessionClip.x) * 4;
      assert(crop.data.subarray(row * crop.width * 4, (row + 1) * crop.width * 4)
        .equals(source.data.subarray(from, from + crop.width * 4)));
    }
  }
});
test('a filename cannot select another decoder, and invalid inputs or crop bounds fail closed', () => {
  assert.throws(() => cropDecodedSession(Buffer.alloc(10)), /JPEG/);
  assert.throws(() => cropDecodedSession(Buffer.alloc(8 * 1024 * 1024 + 1)), /Bounded/);
  const bytes = readFileSync(join(root, json('review.json').images[0].source));
  for (const clip of [{...sessionClip, x: -1}, {...sessionClip, y: 0.5}, {...sessionClip, width: 2000}])
    assert.throws(() => cropDecodedSession(bytes, clip));
  assert.throws(() => readSessionCrop(bytes));
});
for (const change of ['pixel', 'coordinates', 'decoder', 'scope', 'failed-result']) test('coherently rehashed contradiction remains rejected: ' + change, t => {
  const temporary = mkdtempSync(join(tmpdir(), 'sgm-rgb-proof-')); t.after(() => rmSync(temporary, {recursive: true, force: true}));
  const folder = join(temporary, chatRgbFolder), original = 'docs/release/evidence/chat-receipt-loss-phone-2026-11-01/';
  cpSync(base, folder, {recursive: true}); cpSync(join(root, original), join(temporary, original), {recursive: true});
  assert.deepEqual(validateChatRgbNormalization(temporary), expected);
  const review = json('review.json'), hashes = json('artifact-sha256.json');
  const save = (file, bytes) => {writeFileSync(join(folder, file), bytes); hashes[file] = sha(bytes);};
  if (change === 'pixel') {
    const file = 'captures/parent-confirmed.png', image = readSessionCrop(readFileSync(join(folder, file)));
    image.data[image.data.length - 1] = 253; const bytes = PNG.sync.write(image);
    save(file, bytes); review.images[0].cropPngSha256 = sha(bytes);
  } else if (change === 'coordinates') review.clip.x++;
  else if (change === 'decoder') review.decoder['jpeg-js'] = '0.4.3';
  else if (change === 'scope') review.fullSmokeAccepted = true;
  else {const failed = json('failed-linux-result.json'); failed.diagnosticPassed = true; save('failed-linux-result.json', JSON.stringify(failed));}
  save('review.json', JSON.stringify(review)); writeFileSync(join(folder, 'artifact-sha256.json'), JSON.stringify(hashes));
  assert.throws(() => validateChatRgbNormalization(temporary));
});
test('only three current capture paths change; phone dates, all prior gallery items and partial status stay', () => {
  const flow = content.flows.find(row => row.id === 'messages');
  assert.equal(flow.status, 'partial'); assert.equal(flow.checkedAt, '2026-11-01');
  assert.equal(flow.images.length, 34); assert.equal(flow.tour.length, 15);
  assert.equal(flow.captureNormalization.source, chatRgbFolder + 'review.json');
  for (const image of json('review.json').images)
    assert.equal(captures['chat-receipt-phone-' + image.name], chatRgbFolder + 'captures/' + image.name + '.png');
  const progress = content.updates.find(row => row.source === chatRgbFolder + 'README.md'); assert(progress);
  assert.doesNotMatch(progress.title + progress.text, /FFmpeg|jpeg-js|pngjs|BrowserStack|Firebase|SDK|APK/);
  const pkg = JSON.parse(readFileSync(join(root, 'package.json')));
  assert.equal(pkg.devDependencies['jpeg-js'], '0.4.4'); assert.equal(pkg.devDependencies.pngjs, '7.0.0');
});
