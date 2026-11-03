import assert from 'node:assert/strict';
import {dirname} from 'node:path';
import {neutralVisualSource, validateNeutralTextVisualReview} from '../scripts/qa/neutral-text-visual-evidence.mjs';
import {accentControlsFolder, accentControlPublicPhases, validateAccentControlEvidence} from '../scripts/qa/accent-controls-evidence.mjs';
import {feedbackVisualFolder, feedbackVisualPublicCases, validateFeedbackTextVisualReview} from '../scripts/qa/feedback-text-visual-evidence.mjs';

export function validateAppearanceEvidence(root, flow, captures) {
  assert.equal(flow.id, 'appearance'); assert.equal(flow.status, 'partial');
  validateAccentControlEvidence(root);
  assert.equal(flow.accentControlReview.source, accentControlsFolder + 'review.json');
  assert.equal(flow.accentControlReview.checksums, accentControlsFolder + 'artifact-sha256.json');
  assert.equal(flow.accentControlReview.checkedAt, '2026-10-30'); assert.equal(flow.latestEvidence, 'local');
  const feedback = validateFeedbackTextVisualReview(root);
  assert.equal(flow.checkedAt, feedback.reviewedAt); assert.equal(flow.feedbackVisualReview.checkedAt, feedback.reviewedAt);
  assert.equal(flow.feedbackVisualReview.source, feedbackVisualFolder + 'review.json');
  assert.equal(flow.feedbackVisualReview.checksums, feedbackVisualFolder + 'artifact-sha256.json');
  assert.equal(flow.source, feedbackVisualFolder + 'README.md');
  const legacy = {...flow, images: flow.images.filter(image => !image.file.startsWith('feedback-text-'))};
  delete legacy.feedbackVisualReview;
  for (const key of ['checkedAt', 'latestEvidence', 'summary', 'verified', 'remaining', 'source']) legacy[key] = feedback.previousAppearance[key];
  assert.deepEqual(legacy, feedback.previousAppearance, 'Every older appearance field/image must remain unchanged');
  const current = flow.images.filter(image => image.file.startsWith('feedback-text-'));
  assert.deepEqual(current.map(image => image.file), feedbackVisualPublicCases.map(name => 'feedback-text-' + name));
  for (const image of current) {
    const name = image.file.slice('feedback-text-'.length);
    assert.equal(captures[image.file], feedbackVisualFolder + 'captures/' + name + '.png');
    assert.equal(image.landscape, name.endsWith('-wide')); assert.equal(image.checkedAt, feedback.reviewedAt);
  }
  const phone = flow.images.filter(image => image.file.startsWith('accent-control-'));
  assert.deepEqual(phone.map(image => image.file), accentControlPublicPhases.map(phase => 'accent-control-' + phase));
  for (const image of phone) {
    assert.equal(captures[image.file], accentControlsFolder + 'captures/' + image.file.slice('accent-control-'.length) + '.png');
    assert.equal(image.landscape, false); assert.equal(image.checkedAt, '2026-10-30');
  }
  assert.equal(flow.neutralTextReview.source, neutralVisualSource + '/review.json');
  assert.equal(flow.neutralTextReview.checksums, neutralVisualSource + '/artifact-sha256.json');
  const review = validateNeutralTextVisualReview(root, dirname(flow.neutralTextReview.source));
  assert.equal(flow.neutralTextReview.checkedAt, review.reviewedAt);
  assert.equal(flow.ui.checkedAt, '2026-10-15');
  const images = flow.images.filter(image => image.file.startsWith('neutral-text-'));
  assert.deepEqual(images.map(image => image.file), review.cases.map(name => 'neutral-text-' + name));
  for (const image of images) {
    const name = image.file.slice('neutral-text-'.length);
    assert.equal(captures[image.file], neutralVisualSource + '/captures/' + name + '.png');
    assert.equal(image.landscape, name.endsWith('-wide')); assert.equal(image.checkedAt, review.reviewedAt);
  }
  assert.deepEqual(flow.images.filter(image => !/^(neutral-text-|accent-control-|feedback-text-)/.test(image.file)).map(image => image.file),
    ['local-landscape', 'local-theme']);
}
