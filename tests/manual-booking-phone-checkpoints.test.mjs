import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { bookingPhonePhases, verifyBookingPhoneCheckpoint } from '../scripts/qa/manual-booking-phone-checkpoints.mjs';

const fixture = {parentUid: 'parent', driverUid: 'driver', bookings: [
  {bookingId: 'approval', tripId: 'trip-a'}, {bookingId: 'decline', tripId: 'trip-b'}]};
const idFor = (type, bookingId, userId) => 'bookingDecision_' + createHash('sha256')
  .update(JSON.stringify([type, bookingId, userId])).digest('hex');
function stateFor(index) {
  const statuses = [index >= 4 ? 'cancelled' : index >= 1 ? 'approved' : 'requested', index >= 2 ? 'declined' : 'requested'];
  const bookings = fixture.bookings.map((row, position) => ({id: row.bookingId, tripId: row.tripId, status: statuses[position],
    parentUserId: 'parent', driverUserId: 'driver', childId: 'sgm-qa-child-lina', seats: 2,
    ...(position === 0 && index >= 4 ? {cancelledByUserId: 'parent', refundStatus: 'notRequired'} : {})}));
  const notices = [];
  function note(type, bookingId, userId) { notices.push({id: idFor(type, bookingId, userId), sourceId: bookingId, type, userId, read: false}); }
  if (index >= 1) note('bookingApproved', 'approval', 'parent');
  if (index >= 2) note('bookingDeclined', 'decline', 'parent');
  if (index >= 4) note('bookingCancelled', 'approval', 'driver');
  return {bookings, notices, trips: fixture.bookings.map((row, position) => ({id: row.tripId,
    seatsAvailable: statuses[position] === 'approved' ? 2 : 4})),
  inboxes: {parent: notices.filter(note => note.userId === 'parent').map(note => note.id),
    driver: notices.filter(note => note.userId === 'driver').map(note => note.id), outsider: []},
  pendingRequestIds: fixture.bookings.filter((_, position) => statuses[position] === 'requested').map(row => row.bookingId)};
}
for (const [index, phase] of bookingPhonePhases.entries()) test('independent record contract: ' + phase, () => {
  const result = verifyBookingPhoneCheckpoint(phase, stateFor(index), fixture);
  assert.equal(result.physicalUiProvenByThisCheckpoint, false); assert.equal(result.pushDeliveryVerified, false);
});
for (const [name, mutate] of [
  ['wrong capacity', state => state.trips[0].seatsAvailable = 4],
  ['wrong child', state => state.bookings[0].childId = 'another-child'],
  ['wrong seat count', state => state.bookings[0].seats = 1],
  ['wrong actor', state => state.bookings[0].parentUserId = 'another-parent'],
  ['missing notice', state => state.notices.pop()],
  ['duplicate notice', state => state.notices.push({...state.notices[0]})],
  ['wrong recipient', state => state.notices[0].userId = 'outsider'],
  ['missing parent inbox item', state => state.inboxes.parent.pop()],
  ['outsider leak', state => state.inboxes.outsider.push(state.notices[0].id)],
  ['still pending', state => state.pendingRequestIds.push('approval')],
]) test('rejects ' + name, () => {
  const state = stateFor(1); mutate(state); assert.throws(() => verifyBookingPhoneCheckpoint('approved', state, fixture));
});
test('cancellation requires the parent and an explicit unpaid refund state', () => {
  for (const mutate of [state => state.bookings[0].cancelledByUserId = 'driver', state => state.bookings[0].refundStatus = 'pending']) {
    const state = stateFor(4); mutate(state); assert.throws(() => verifyBookingPhoneCheckpoint('cancelled', state, fixture));
  }
  assert.throws(() => verifyBookingPhoneCheckpoint('invented', stateFor(0), fixture));
});
