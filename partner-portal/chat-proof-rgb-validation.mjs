import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {assertEvidenceBundleChecksums} from '../scripts/qa/evidence-bundle-checksums.mjs';
import {cropDecodedSession, readSessionCrop, sessionClip} from '../scripts/lib/session-image-crop.mjs';
import {assertExactPixelFrames} from '../scripts/lib/exact-pixel-frames.mjs';

export const chatRgbFolder = 'docs/release/evidence/chat-proof-rgb-normalization-2026-11-01/';
export function validateChatRgbNormalization(root, folder = chatRgbFolder) {
  const base = resolve(root, folder), json = file => JSON.parse(readFileSync(resolve(base, file)));
  const sha = bytes => createHash('sha256').update(bytes).digest('hex');
  assertEvidenceBundleChecksums(base); const review = json('review.json');
  assert.equal(review.scope, 'portable-lossless-rgb-crops-of-existing-session-images-not-new-phone-trial');
  assert.equal(review.checkedAt, '2026-11-01'); assert.deepEqual(review.decoder, {'jpeg-js': '0.4.4', pngjs: '7.0.0'});
  assert.deepEqual(review.clip, sessionClip); assert(Number.isFinite(Date.parse(review.generatedAt)));
  for (const key of ['previousCapturesPreserved', 'originalBytesPreserved', 'previousFfmpegCropPixelClaimSuperseded',
    'reviewedForPublication']) assert.equal(review[key], true, key);
  for (const key of ['newPhoneTrial', 'physicalFlowNewlyAccepted', 'fullSmokeAccepted', 'originalShutdownCauseProven',
    'releaseAccepted']) assert.equal(review[key], false, key);
  const originalFolder = 'docs/release/evidence/chat-receipt-loss-phone-2026-11-01/';
  assertEvidenceBundleChecksums(resolve(root, originalFolder));
  const originalHashes = JSON.parse(readFileSync(resolve(root, originalFolder, 'artifact-sha256.json')));
  assert.deepEqual(review.images.map(row => row.name), ['parent-confirmed', 'parent-reopened', 'driver-visible']);
  for (const image of review.images) {
    assert.equal(image.source, originalFolder + 'original-session-captures/' + image.name + '.png');
    assert.equal(image.previousCapture, originalFolder + 'captures/' + image.name + '.png');
    assert.equal(image.originalMediaType, 'image/jpeg');
    const source = readFileSync(resolve(root, image.source)); assert.equal(sha(source), image.originalSha256);
    assert.equal(image.originalSha256, originalHashes['original-session-captures/' + image.name + '.png']);
    assert.equal(sha(readFileSync(resolve(root, image.previousCapture))), image.previousCaptureSha256);
    assert.equal(image.previousCaptureSha256, originalHashes['captures/' + image.name + '.png']);
    const {source: decoded, crop} = cropDecodedSession(source);
    assert.equal(sha(decoded.data), image.decodedRgbaSha256); assert.equal(sha(crop.data), image.cropRgbaSha256);
    const published = readFileSync(resolve(base, 'captures', image.name + '.png'));
    assert.equal(sha(published), image.cropPngSha256);
    assertExactPixelFrames(readSessionCrop(published).data, crop.data, 274 * 618 * 4);
  }
  const failed = json('failed-linux-result.json'); assert.equal(failed.diagnosticPassed, false);
  assert.equal(failed.platform, 'linux'); assert.equal(failed.phases.length, 1);
  assert.equal(failed.phases[0].id, 'media-pixels'); assert.equal(failed.phases[0].status, 1);
  assert.equal(failed.phases[0].signal, null); assert.equal(failed.cancellationSignal, null);
  for (const key of ['primaryGateAccepted', 'physicalFlowAccepted', 'rootCauseProven', 'releaseAccepted']) assert.equal(failed[key], false);
  assert.deepEqual([review.failedProducer.run, review.failedProducer.job, review.failedProducer.artifact,
    review.failedProducer.commit, review.failedProducer.conclusion], [41363818773, 125019644410, 13106396725,
    'b0720539aa2cf33f95e9b596370ec29dc0360e9a', 'failure']);
  assert.equal(review.failedProducer.archiveSha256, 'f703ae97c13214b15ef91d459d25ab052277b7652595e01c9e8a05057bde6047');
  assert.equal(review.failedProducer.firstDifferentByte, 79); assert.equal(review.failedProducer.bytes, 507996);
  return {captures: 3, exactRgbaPixels: true, originalsUnchanged: true, previousNegativeRetained: true,
    newPhoneTrial: false, releaseAccepted: false};
}
