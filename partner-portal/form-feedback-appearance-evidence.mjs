import assert from 'node:assert/strict';
import {formFeedbackVisualFolder, formFeedbackPublicCases, validateFormFeedbackVisualReview} from '../scripts/qa/form-feedback-visual-evidence.mjs';

export function validateFormFeedbackAppearance(root, flow, captures) {
  const review = validateFormFeedbackVisualReview(root);
  assert.equal(flow.status, 'partial'); assert.equal(flow.latestEvidence, 'local'); assert.equal(flow.checkedAt, review.reviewedAt);
  assert.equal(flow.source, formFeedbackVisualFolder + 'README.md');
  assert.deepEqual(flow.formFeedbackVisualReview, {source: formFeedbackVisualFolder + 'review.json',
    checksums: formFeedbackVisualFolder + 'artifact-sha256.json', checkedAt: review.reviewedAt});
  const images = flow.images.filter(image => image.file.startsWith('form-feedback-'));
  assert.deepEqual(images.map(image => image.file), formFeedbackPublicCases.map(name => 'form-feedback-' + name));
  for (const image of images) {
    const name = image.file.slice('form-feedback-'.length);
    assert.equal(captures[image.file], formFeedbackVisualFolder + 'captures/form-' + name + '.png');
    assert.equal(image.checkedAt, review.reviewedAt); assert.equal(image.landscape, name.endsWith('-wide'));
  }
  const previous = {...flow, images: flow.images.filter(image => !image.file.startsWith('form-feedback-'))};
  delete previous.formFeedbackVisualReview;
  for (const key of ['checkedAt', 'summary', 'verified', 'source']) previous[key] = review.previousAppearance[key];
  assert.deepEqual(previous, review.previousAppearance, 'Every earlier appearance image, status, phone date and tour is retained');
  return previous;
}
