import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

export const bookingPhonePhases = ['prepared', 'approved', 'declined', 'parent-inbox', 'cancelled', 'driver-inbox'];
export function pendingBookingPhoneRequestIds(reply) {
  assert(Array.isArray(reply?.bookings), 'Driver reservations must be an explicit list');
  for (const row of reply.bookings) {
    assert.equal(typeof row.bookingId, 'string'); assert(row.bookingId.length > 0);
    assert.equal(typeof row.status, 'string'); assert(row.status.length > 0);
  }
  return reply.bookings.filter(row => row.status === 'requested').map(row => row.bookingId);
}
const noticeId = (type, bookingId, userId) => 'bookingDecision_' + createHash('sha256')
  .update(JSON.stringify([type, bookingId, userId])).digest('hex');

export function verifyBookingPhoneCheckpoint(phase, state, fixture) {
  const index = bookingPhonePhases.indexOf(phase); assert(index >= 0);
  const expected = [index >= 4 ? 'cancelled' : index >= 1 ? 'approved' : 'requested', index >= 2 ? 'declined' : 'requested'];
  const noticeIds = [];
  for (const [position, item] of fixture.bookings.entries()) {
    const row = state.bookings[position]; assert.equal(row.id, item.bookingId);
    assert.equal(row.tripId, item.tripId); assert.equal(row.parentUserId, fixture.parentUid);
    assert.equal(row.driverUserId, fixture.driverUid); assert.equal(row.childId, 'sgm-qa-child-lina');
    assert.equal(row.seats, 2); assert.equal(row.status, expected[position]);
    assert.equal(state.trips[position].id, item.tripId);
    assert.equal(state.trips[position].seatsAvailable, expected[position] === 'approved' ? 2 : 4);
    const expectedNotices = [];
    if (position === 0 && index >= 1) expectedNotices.push(['bookingApproved', fixture.parentUid]);
    if (position === 1 && index >= 2) expectedNotices.push(['bookingDeclined', fixture.parentUid]);
    if (position === 0 && index >= 4) {
      assert.equal(row.cancelledByUserId, fixture.parentUid); assert.equal(row.refundStatus, 'notRequired');
      expectedNotices.push(['bookingCancelled', fixture.driverUid]);
    }
    const notes = state.notices.filter(note => note.sourceId === item.bookingId);
    assert.equal(notes.length, expectedNotices.length);
    for (const [type, userId] of expectedNotices) {
      const id = noticeId(type, item.bookingId, userId), note = notes.find(value => value.id === id);
      assert(note); assert.equal(note.type, type); assert.equal(note.userId, userId);
      assert.equal(typeof note.read, 'boolean'); noticeIds.push(id);
    }
  }
  assert.equal(state.notices.length, noticeIds.length);
  for (const [actor, expectedIds] of [['parent', state.notices.filter(note => note.userId === fixture.parentUid).map(note => note.id)],
    ['driver', state.notices.filter(note => note.userId === fixture.driverUid).map(note => note.id)], ['outsider', []]])
    assert.deepEqual([...state.inboxes[actor]].sort(), expectedIds.sort());
  assert.equal(state.pendingRequestIds.includes(fixture.bookings[0].bookingId), index === 0);
  assert.equal(state.pendingRequestIds.includes(fixture.bookings[1].bookingId), index < 2);
  return {phase, statuses: expected, noticeCount: noticeIds.length, recipientIsolationVerified: true,
    physicalUiProvenByThisCheckpoint: false, pushDeliveryVerified: false};
}
