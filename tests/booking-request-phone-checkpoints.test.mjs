import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { bookingRequestPhonePhases, verifyBookingRequestPhoneState as verify } from '../scripts/qa/booking-request-phone-checkpoints.mjs';

const fixture = { tripId: 'trip', parentUid: 'sgm-qa-parent', driverUid: 'sgm-qa-driver' };
const trip = { seatsAvailable: 4, priceCents: 0, status: 'published' };
const baseline = { documents: { users: [{ id: 'protected-user', data: { name: 'Unchanged' } }],
  trips: [{ id: 'trip', data: trip }] }, claims: { 'protected-user': { role: 'parent' } }, rtdb: { protected: true } };
const noticeId = 'bookingDecision_' + createHash('sha256')
  .update(JSON.stringify(['bookingRequested', 'booking', fixture.driverUid])).digest('hex');
const timestamp = seconds => ({ _seconds: seconds, _nanoseconds: 123000000 });

function stateFor(index) {
  const state = { records: structuredClone(baseline), trip: structuredClone(trip),
    bookings: [], notices: [], receipts: [], inboxes: { parent: [], driver: [], outsider: [] }, pendingRequestIds: [] };
  if (!index) return state;
  const booking = { id: 'booking', data: { tripId: fixture.tripId, parentUserId: fixture.parentUid,
    requesterUserId: fixture.parentUid, driverUserId: fixture.driverUid, status: 'requested', seats: 1 } };
  const receipt = { id: 'receipt', data: { uid: fixture.parentUid, state: 'committed',
    clientRequestId: 'request', fingerprint: 'a'.repeat(64), response: { bookingId: 'booking',
      trip: { id: fixture.tripId }, clientRequestId: 'request', status: 'requested' } } };
  const notice = { id: noticeId, data: { type: 'bookingRequested', sourceId: 'booking', userId: fixture.driverUid,
    title: 'Nouvelle demande de réservation', body: 'Une nouvelle demande de réservation attend votre réponse.',
    read: index >= 3, createdAt: timestamp(100), ...(index >= 3 ? { readAt: timestamp(101) } : {}) } };
  for (const [key, row] of [['bookings', booking], ['receipts', receipt], ['notices', notice]]) state[key] = [row];
  Object.assign(state.records.documents, { bookings: [booking], bookingRequestReceipts: [receipt], notifications: [notice] });
  state.inboxes.driver = [{ id: noticeId, unread: index < 3 }]; state.pendingRequestIds = ['booking'];
  return state;
}

for (const [index, phase] of bookingRequestPhonePhases.entries()) test('record checkpoint: ' + phase, () => {
  const result = verify(phase, stateFor(index), baseline, fixture);
  assert.equal(result.physicalUiProven, false);
  assert.equal(result.protectedRecordCount, 2);
  if (index) { assert.equal(result.noticeRead, index >= 3); assert.equal(result.pushDeliveryProven, false); }
});

for (const [label, mutate] of [
  ['duplicate booking', s => s.bookings.push(structuredClone(s.bookings[0]))],
  ['duplicate notice', s => s.notices.push(structuredClone(s.notices[0]))],
  ['missing receipt', s => s.receipts = []],
  ['uncommitted receipt', s => s.receipts[0].data.state = 'pending'],
  ['foreign receipt', s => s.receipts[0].data.uid = 'outsider'],
  ['foreign booking', s => s.bookings[0].data.parentUserId = 'outsider'],
  ['child booking', s => s.bookings[0].data.childId = 'child'],
  ['paid booking', s => s.bookings[0].data.paymentIntentId = 'payment'],
  ['wrong seats', s => s.bookings[0].data.seats = 2],
  ['decided booking', s => s.bookings[0].data.status = 'approved'],
  ['capacity change', s => s.trip.seatsAvailable = 3],
  ['missing pending request', s => s.pendingRequestIds = []],
  ['foreign notice', s => s.notices[0].data.userId = 'outsider'],
  ['unstable notice ID', s => s.notices[0].id = 'random'],
  ['private notice field', s => s.notices[0].data.childName = 'Private'],
  ['parent leak', s => s.inboxes.parent = structuredClone(s.inboxes.driver)],
  ['outsider leak', s => s.inboxes.outsider = structuredClone(s.inboxes.driver)],
  ['premature read', s => s.notices[0].data.read = true],
  ['protected user mutation', s => s.records.documents.users[0].data.name = 'Changed'],
  ['claim mutation', s => s.records.claims['protected-user'].role = 'admin'],
  ['live data mutation', s => s.records.rtdb.protected = false],
  ['unrelated new record', s => s.records.documents.users.push({ id: 'new', data: {} })],
  ['stored notice differs', s => s.records.documents.notifications = [{ ...s.notices[0], data: {} }]],
]) test('rejects ' + label, () => {
  const state = stateFor(1); mutate(state); assert.throws(() => verify('parent-requested', state, baseline, fixture));
});

test('read confirmation requires the timestamp and read inbox state', () => {
  for (const mutate of [s => delete s.notices[0].data.readAt, s => s.notices[0].data.readAt = timestamp(99),
    s => s.notices[0].data.readAt._nanoseconds = 1e9, s => s.inboxes.driver[0].unread = true]) {
    const state = stateFor(3); mutate(state); assert.throws(() => verify('driver-read', state, baseline, fixture));
  }
});

test('prepared state cannot contain a persisted request or claim changes', () => {
  for (const mutate of [s => s.records.documents.bookings = [{ id: 'new', data: {} }],
    s => s.records.claims['protected-user'].role = 'admin', s => s.notices.push({})]) {
    const state = stateFor(0); mutate(state); assert.throws(() => verify('prepared', state, baseline, fixture));
  }
  assert.throws(() => verify('invented', stateFor(0), baseline, fixture));
});
