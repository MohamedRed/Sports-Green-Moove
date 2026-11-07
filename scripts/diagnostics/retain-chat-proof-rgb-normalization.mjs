import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {cropDecodedSession, sessionClip} from '../lib/session-image-crop.mjs';

const root = resolve(import.meta.dirname, '../..'), archive = process.argv[2]; assert(archive?.startsWith('/'));
const old = 'docs/release/evidence/chat-receipt-loss-phone-2026-11-01/';
const folder = resolve(root, 'docs/release/evidence/chat-proof-rgb-normalization-2026-11-01');
assert(!existsSync(folder), 'Never replace an original review bundle'); mkdirSync(folder); mkdirSync(resolve(folder, 'captures'));
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
assert.equal(sha256(readFileSync(archive)), 'f703ae97c13214b15ef91d459d25ab052277b7652595e01c9e8a05057bde6047');
const save = (file, value) => writeFileSync(resolve(folder, file), JSON.stringify(value, null, 2) + '\n', {flag: 'wx'});
for (const file of ['result.json', 'resources.jsonl']) writeFileSync(resolve(folder, 'failed-linux-' + file),
  execFileSync('unzip', ['-p', archive, file], {maxBuffer: 1024 * 1024}), {flag: 'wx'});
const images = [];
for (const name of ['parent-confirmed', 'parent-reopened', 'driver-visible']) {
  const source = old + 'original-session-captures/' + name + '.png';
  const bytes = readFileSync(resolve(root, source)), {source: decoded, crop, png} = cropDecodedSession(bytes);
  writeFileSync(resolve(folder, 'captures', name + '.png'), png, {flag: 'wx'});
  images.push({name, source, originalMediaType: 'image/jpeg', originalSha256: sha256(bytes),
    decodedRgbaSha256: sha256(decoded.data), cropRgbaSha256: sha256(crop.data), cropPngSha256: sha256(png),
    previousCapture: old + 'captures/' + name + '.png', previousCaptureSha256: sha256(readFileSync(resolve(root, old, 'captures', name + '.png')))});
}
save('review.json', {scope: 'portable-lossless-rgb-crops-of-existing-session-images-not-new-phone-trial',
  checkedAt: '2026-11-01', generatedAt: new Date().toISOString(), decoder: {'jpeg-js': '0.4.4', pngjs: '7.0.0'},
  clip: sessionClip, images, previousCapturesPreserved: true, originalBytesPreserved: true,
  previousFfmpegCropPixelClaimSuperseded: true, reviewedForPublication: false, newPhoneTrial: false,
  physicalFlowNewlyAccepted: false, fullSmokeAccepted: false, originalShutdownCauseProven: false, releaseAccepted: false,
  failedProducer: {run: 41363818773, job: 125019644410, artifact: 13106396725,
    commit: 'b0720539aa2cf33f95e9b596370ec29dc0360e9a', conclusion: 'failure',
    archiveSha256: 'f703ae97c13214b15ef91d459d25ab052277b7652595e01c9e8a05057bde6047',
    bytes: 507996, firstDifferentByte: 79,
    actualSha256: 'd7eab5dac3b892363dac88ceb90d158f1ffc29ac53c2439099e51163bf0b8ea4',
    expectedSha256: '49e8f4a60eb594f6bcf4a8824bbb23bd709de2cf03c924c9825620615e1babc6'}});
const hashes = {};
for (const entry of readdirSync(folder, {withFileTypes: true})) {
  if (entry.isDirectory()) for (const name of readdirSync(resolve(folder, entry.name))) {
    const file = entry.name + '/' + name; hashes[file] = sha256(readFileSync(resolve(folder, file)));
  } else hashes[entry.name] = sha256(readFileSync(resolve(folder, entry.name)));
}
save('artifact-sha256.json', hashes); console.log('Retained original sources, old failed Linux outcome and three lossless crops; publication review still required.');
