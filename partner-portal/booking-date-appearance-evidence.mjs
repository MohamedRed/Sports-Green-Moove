import assert from 'node:assert/strict';
import {bookingDateVisualFolder, bookingDatePublicCases, validateBookingDateVisualReview} from '../scripts/qa/booking-date-visual-evidence.mjs';

export function validateBookingDateAppearance(root, flow, captures) {
  const review = validateBookingDateVisualReview(root);
  assert.equal(flow.status, 'partial'); assert.equal(flow.latestEvidence, 'local');
  assert.equal(flow.source, bookingDateVisualFolder + 'README.md'); assert.equal(flow.checkedAt, review.reviewedAt);
  assert.deepEqual(flow.bookingDateVisualReview, {source: bookingDateVisualFolder + 'review.json',
    checksums: bookingDateVisualFolder + 'artifact-sha256.json', checkedAt: review.reviewedAt});
  const images = flow.images.filter(image => image.file.startsWith('booking-date-'));
  assert.deepEqual(images.map(image => image.file), bookingDatePublicCases.map(name => 'booking-date-' + name));
  for (const image of images) {
    const name = image.file.slice('booking-date-'.length);
    assert.equal(captures[image.file], bookingDateVisualFolder + 'captures/' + name + '.png');
    assert.equal(image.checkedAt, review.reviewedAt); assert.equal(image.landscape, name.endsWith('-wide'));
  }
  const previous = {...flow, images: flow.images.filter(image => !image.file.startsWith('booking-date-'))};
  delete previous.bookingDateVisualReview;
  for (const key of ['checkedAt', 'summary', 'verified', 'remaining', 'source']) previous[key] = review.previousAppearance[key];
  assert.deepEqual(previous, review.previousAppearance, 'Preserve every earlier appearance field, media item and tour');
  return previous;
}
