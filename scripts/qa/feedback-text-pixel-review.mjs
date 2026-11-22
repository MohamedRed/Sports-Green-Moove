import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {PNG} from 'pngjs';

const sha = bytes => createHash('sha256').update(bytes).digest('hex');

export function compareFeedbackViewportPixels(viewportBytes, windowBytes, {left, top}) {
  const viewport = PNG.sync.read(viewportBytes, {checkCRC: true});
  const window = PNG.sync.read(windowBytes, {checkCRC: true});
  assert(Number.isInteger(left) && Number.isInteger(top) && left >= 0 && top >= 0);
  assert(left + viewport.width <= window.width && top + viewport.height <= window.height);
  const region = Buffer.alloc(viewport.data.length);
  let changedPixels = 0;
  for (let y = 0; y < viewport.height; y++) {
    const start = ((top + y) * window.width + left) * 4;
    window.data.copy(region, y * viewport.width * 4, start, start + viewport.width * 4);
  }
  for (let at = 0; at < region.length; at += 4)
    if (viewport.data.readUInt32BE(at) !== region.readUInt32BE(at)) changedPixels++;
  return {width: viewport.width, height: viewport.height, windowWidth: window.width, windowHeight: window.height,
    left, top, comparedPixels: viewport.width * viewport.height, changedPixels,
    viewportRgbaSha256: sha(viewport.data), windowRegionRgbaSha256: sha(region)};
}

export function validateFeedbackPixelReview(folder, cases, originallyRejectedCases) {
  const read = name => readFileSync(resolve(folder, name));
  const review = JSON.parse(read('pixel-review.json'));
  assert.equal(review.scope, 'correction-of-visual-classification-not-new-execution');
  assert.equal(review.checkedAt, '2026-11-03'); assert.equal(review.originalReview, 'review.json');
  assert.equal(review.originalReviewSha256, sha(read('review.json')));
  assert.deepEqual(review.retractedIncompleteCases, originallyRejectedCases);
  assert.equal(review.originalClassificationIncorrect, true);
  assert.equal(review.completeViewportCaptures, 12); assert.deepEqual(review.incompleteViewportCases, []);
  assert.equal(review.visualContentReviewed, true); assert.equal(review.exportDefectConfirmed, false);
  for (const key of ['newDeviceRun', 'mediaEdits', 'captureMechanismChanged', 'fallbackAdded',
    'physicalDeviceAccepted', 'fullAppAccessibilityAccepted', 'releaseAccepted']) assert.equal(review[key], false, key);
  assert.deepEqual(review.comparisons.map(row => row.case), cases);
  for (const row of review.comparisons) {
    const wide = row.case.endsWith('-wide');
    const region = wide ? {left: 90, top: 900} : {left: 60, top: 150};
    const observed = compareFeedbackViewportPixels(read('captures/' + row.case + '.png'),
      read('captures/' + row.case + '-window.png'), region);
    assert.deepEqual(row, {case: row.case, ...observed});
    assert.equal(observed.width, wide ? 900 : 960); assert.equal(observed.height, wide ? 600 : 2100);
    assert.equal(observed.windowWidth, 1080); assert.equal(observed.windowHeight, 2400);
    assert.equal(observed.changedPixels, 0, row.case + ': original captures must match without tolerance');
    assert.equal(observed.viewportRgbaSha256, observed.windowRegionRgbaSha256);
  }
  return review;
}
