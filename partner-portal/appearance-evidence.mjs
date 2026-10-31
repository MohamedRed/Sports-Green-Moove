import assert from 'node:assert/strict';
import {dirname} from 'node:path';
import {neutralVisualSource, validateNeutralTextVisualReview} from '../scripts/qa/neutral-text-visual-evidence.mjs';
import {accentControlsFolder, accentControlPublicPhases, validateAccentControlEvidence} from '../scripts/qa/accent-controls-evidence.mjs';

export function validateAppearanceEvidence(root, flow, captures) {
  assert.equal(flow.id, 'appearance'); assert.equal(flow.status, 'partial');
  validateAccentControlEvidence(root);
  assert.equal(flow.accentControlReview.source, accentControlsFolder + 'review.json');
  assert.equal(flow.accentControlReview.checksums, accentControlsFolder + 'artifact-sha256.json');
  assert.equal(flow.accentControlReview.checkedAt, '2026-10-30'); assert.equal(flow.latestEvidence, 'phone');
  const phone = flow.images.filter(image => image.file.startsWith('accent-control-'));
  assert.deepEqual(phone.map(image => image.file), accentControlPublicPhases.map(phase => 'accent-control-' + phase));
  for (const image of phone) {
    assert.equal(captures[image.file], accentControlsFolder + 'captures/' + image.file.slice('accent-control-'.length) + '.png');
    assert.equal(image.landscape, false); assert.equal(image.checkedAt, '2026-10-30');
  }
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
  assert.deepEqual(flow.images.filter(image => !/^(neutral-text-|accent-control-)/.test(image.file)).map(image => image.file),
    ['local-landscape', 'local-theme']);
}
