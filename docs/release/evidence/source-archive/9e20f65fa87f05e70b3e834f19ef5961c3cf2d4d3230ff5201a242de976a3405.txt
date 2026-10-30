import assert from 'node:assert/strict';

const adultTripId = 'sgm-qa-trip-u8-wavre-bruxelles';
export function bookingReceiptTarget(value) {
  assert(value && typeof value === 'object' && !Array.isArray(value));
  if (!Object.hasOwn(value, 'subject')) {
    assert.deepEqual(Object.keys(value).sort(), ['intentRevision', 'tripId']);
    assert.equal(value.tripId, adultTripId);
    assert.match(value.intentRevision, /^[a-f0-9]{64}$/);
    return {...value, subject: 'adult', seats: 1};
  }
  assert.deepEqual(Object.keys(value).sort(), ['childId', 'intentRevision', 'seats', 'subject', 'tripId']);
  assert.equal(value.subject, 'child-search-two-seats');
  assert.match(value.tripId, /^[A-Za-z0-9_-]{1,128}$/); assert.notEqual(value.tripId, adultTripId);
  assert.equal(value.childId, 'sgm-qa-child-lina'); assert.equal(value.seats, 2);
  assert.match(value.intentRevision, /^[a-f0-9]{64}$/);
  return structuredClone(value);
}

export function assertBookingReceiptInput(data, target, uid, verifyIntent) {
  const fields = ['clientRequestId', 'expectedBookingIntent', 'requesterUserId', 'seats', 'tripId'];
  if (target.subject === 'child-search-two-seats') fields.push('childId');
  assert.deepEqual(Object.keys(data).sort(), fields.sort());
  assert.equal(uid, 'sgm-qa-parent'); assert.equal(data.requesterUserId, uid);
  assert.equal(data.tripId, target.tripId); assert.equal(data.seats, target.seats);
  assert.equal(data.childId, target.childId);
  assert.match(data.clientRequestId, /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/);
  assert.equal(verifyIntent(data.expectedBookingIntent), target.intentRevision);
}
