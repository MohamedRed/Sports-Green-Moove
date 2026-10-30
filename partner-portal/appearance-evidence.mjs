import assert from 'node:assert/strict';
import {dirname} from 'node:path';
import {neutralVisualSource, validateNeutralTextVisualReview} from '../scripts/qa/neutral-text-visual-evidence.mjs';

export function validateAppearanceEvidence(root, flow, captures) {
  assert.equal(flow.id, 'appearance'); assert.equal(flow.status, 'partial');
  assert.equal(flow.neutralTextReview.source, neutralVisualSource + '/review.json');
  assert.equal(flow.neutralTextReview.checksums, neutralVisualSource + '/artifact-sha256.json');
  const review = validateNeutralTextVisualReview(root, dirname(flow.neutralTextReview.source));
  assert.equal(flow.checkedAt, review.reviewedAt); assert.equal(flow.neutralTextReview.checkedAt, review.reviewedAt);
  assert.equal(flow.ui.checkedAt, '2026-10-15');
  const images = flow.images.filter(image => image.file.startsWith('neutral-text-'));
  assert.deepEqual(images.map(image => image.file), review.cases.map(name => 'neutral-text-' + name));
  for (const image of images) {
    const name = image.file.slice('neutral-text-'.length);
    assert.equal(captures[image.file], neutralVisualSource + '/captures/' + name + '.png');
    assert.equal(image.landscape, name.endsWith('-wide')); assert.equal(image.checkedAt, review.reviewedAt);
  }
  assert.deepEqual(flow.images.filter(image => !image.file.startsWith('neutral-text-')).map(image => image.file),
    ['local-landscape', 'local-theme']);
}
