import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {cancellationPhonePhases, cancellationPhoneReason as reason, verifyCancellationPhoneCheckpoint}
  from '../scripts/qa/trip-cancellation-phone-checkpoints.mjs';

const beforeTime = {_seconds: 1793200000, _nanoseconds: 0}, time = {_seconds: 1793200100, _nanoseconds: 12000};
const fixture = {tripId: 'trip', driverUid: 'sgm-qa-driver', parentUids: ['sgm-qa-parent', 'sgm-qa-cancel-parent-two'],
  activeBookingIds: ['approved', 'requested'], initialPreview: {status: 'ready', bookingCount: 2, refundPendingCount: 0, revision: 'a'.repeat(64)}};
function baseline() {
  return {documents: {
    trips: [{id: 'trip', data: {title: 'Synthetic', driverUserId: fixture.driverUid, seatsTotal: 4, seatsAvailable: 2,
      status: 'published', priceCents: 0, approvedPassengerUserIds: ['sgm-qa-parent'], updatedAt: beforeTime}}],
    bookings: [{id: 'approved', data: {tripId: 'trip', driverUserId: fixture.driverUid, parentUserId: fixture.parentUids[0],
      childId: 'sgm-qa-child-lina', seats: 2, status: 'approved', updatedAt: beforeTime}},
    {id: 'requested', data: {tripId: 'trip', driverUserId: fixture.driverUid, parentUserId: fixture.parentUids[1], seats: 1, status: 'requested'}},
    {id: 'closed', data: {tripId: 'trip', parentUserId: fixture.parentUids[0], seats: 1, status: 'cancelled', cancelledByUserId: fixture.parentUids[0]}}],
    users: [...fixture.parentUids, fixture.driverUid, 'unrelated'].map(id => ({id, data: {displayName: id, updatedAt: beforeTime}})),
    notifications: [{id: 'earlier', data: {userId: 'unrelated', read: false}}],
  }, claims: [{uid: fixture.driverUid, claims: {roleKeys: ['driver']}}], liveTrips: null};
}
function cancelled() {
  const after = baseline(), trip = after.documents.trips[0].data;
  Object.assign(trip, {status: 'cancelled', seatsAvailable: 4, approvedPassengerUserIds: [], cancelledAt: time,
    cancelledByUserId: fixture.driverUid, cancelReason: reason, updatedAt: time});
  for (const row of after.documents.bookings.slice(0, 2)) Object.assign(row.data, {status: 'cancelled', cancelledAt: time,
    cancelledByUserId: fixture.driverUid, cancelReason: reason, refundStatus: 'notRequired', updatedAt: time});
  after.documents.tripCancellations = [{id: 'trip', data: {tripId: 'trip', actorUserId: fixture.driverUid,
    requestId: '12345678-1234-4123-8123-123456789abc', expectedRevision: 'a'.repeat(64), reason,
    cancelledAt: time, bookingIds: ['approved', 'requested'], refundPendingCount: 0, seatsAvailable: 4}}];
  for (const [index, uid] of fixture.parentUids.entries()) after.documents.notifications.push({
    id: 'tripCancelled_' + createHash('sha256').update(JSON.stringify(['trip', uid])).digest('hex'),
    data: {userId: uid, type: 'tripCancelled', title: 'Trajet annulé', body: reason, sourceId: 'trip',
      bookingIds: [fixture.activeBookingIds[index]], read: false, createdAt: time}});
  return after;
}
for (const [index, phase] of cancellationPhonePhases.entries()) test('cancellation record checkpoint: ' + phase, () => {
  const result = verifyCancellationPhoneCheckpoint(phase, baseline(), index < 4 ? baseline() : cancelled(), fixture);
  assert.equal(result.cancelledBookings, index < 4 ? 0 : 2); assert.equal(result.phoneUiProven, false);
});
for (const [label, mutate] of [
  ['double seat restitution', s => s.documents.trips[0].data.seatsAvailable = 6],
  ['an active booking left open', s => s.documents.bookings[1].data.status = 'requested'],
  ['the older closed booking rewritten', s => s.documents.bookings[2].data.cancelledByUserId = fixture.driverUid],
  ['a missing notice', s => s.documents.notifications.pop()],
  ['a duplicate notice', s => s.documents.notifications.push(s.documents.notifications.at(-1))],
  ['another recipient', s => s.documents.notifications[1].data.userId = 'outsider'],
  ['another receipt revision', s => s.documents.tripCancellations[0].data.expectedRevision = 'b'.repeat(64)],
  ['synthetic paid state', s => s.documents.bookings[0].data.paymentStatus = 'paid'],
  ['a refund invented', s => s.documents.bookings[0].data.refundStatus = 'pending'],
  ['a different cancellation time', s => s.documents.bookings[0].data.cancelledAt = beforeTime],
  ['a notice marked read merely by opening', s => s.documents.notifications[1].data.read = true],
  ['an unrelated profile changed', s => s.documents.users.at(-1).data.updatedAt = time],
  ['a privileged claim', s => s.claims[0].claims.roleKeys.push('admin')],
  ['tracking data written', s => s.liveTrips = {trip: {status: 'active'}}],
]) test('rejects ' + label, () => {
  const state = cancelled(); mutate(state);
  assert.throws(() => verifyCancellationPhoneCheckpoint('cancellation-confirmed', baseline(), state, fixture));
});
test('opening and dismissal cannot hide an early business mutation', () => {
  assert.throws(() => verifyCancellationPhoneCheckpoint('preview-dismissed', baseline(), cancelled(), fixture));
  assert.throws(() => verifyCancellationPhoneCheckpoint('invented', baseline(), baseline(), fixture));
});
test('only owned sign-in profile timestamps are normalized', () => {
  const state = baseline(); for (const user of state.documents.users.slice(0, 3)) user.data.updatedAt = time;
  verifyCancellationPhoneCheckpoint('driver-signed-in', baseline(), state, fixture);
  state.documents.users[0].data.displayName = 'changed';
  assert.throws(() => verifyCancellationPhoneCheckpoint('driver-signed-in', baseline(), state, fixture));
});
test('the observer retains each pre-assertion snapshot and never cancels after preparation', () => {
  const source = readFileSync(new URL('../scripts/qa/manual-trip-cancellation-phone-session.mjs', import.meta.url), 'utf8');
  assert(source.indexOf("save('observed-' + phase") < source.indexOf('verifyCancellationPhoneCheckpoint(phase'));
  assert(!source.includes("call('cancelTrip'")); assert(source.includes("save('failed-checkpoint', failure)"));
});
