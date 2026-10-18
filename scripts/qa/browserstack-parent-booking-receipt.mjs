import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { isAbsolute } from 'node:path';

const [sessionPath, email, phase, output] = process.argv.slice(2);
assert(isAbsolute(sessionPath ?? '') && isAbsolute(output ?? '') && !existsSync(output));
assert.equal(statSync(sessionPath).mode & 0o077, 0, 'Fixture credentials must remain private');
assert(/^phone-[a-z0-9-]+@example\.test$/.test(email ?? ''), 'Only synthetic phone fixtures are supported');
assert(['requested', 'approved', 'cancelled'].includes(phase), 'Explicit booking checkpoint required');
const session = JSON.parse(readFileSync(sessionPath, 'utf8'));
assert.equal(session.projectId, 'demo-sgm-local-qa');
assert.match(session.runId, /^[a-f0-9]{32}$/);
process.env.SGM_QA_PASSWORD = session.password;
const { auth, db, document } = await import('./local-flow-client.mjs');
const parent = await auth.getUserByEmail(email);
assert.deepEqual(parent.customClaims?.roleKeys, ['parent']);
const snapshot = await db.collection('bookings').where('parentUserId', '==', parent.uid).get();
assert.equal(snapshot.size, 1, 'Exactly one phone booking must exist');
const booking = snapshot.docs[0], data = booking.data(), trip = await document('trips', data.tripId);
assert.equal(data.status, phase); assert.equal(data.seats, 1); assert.equal(data.driverUserId, 'sgm-qa-driver');
assert.equal(trip.driverUserId, data.driverUserId); assert.equal(trip.seatsTotal, 4); assert.equal(trip.priceCents, 0);
assert.equal(trip.seatsAvailable, phase === 'approved' ? 3 : 4);
assert(!data.paymentIntentId && !data.invoiceId && !data.paymentStatus, 'This is a zero-money request');
const receipts = await db.collection('bookingRequestReceipts').where('uid', '==', parent.uid).get();
assert.equal(receipts.size, 1); assert.equal(receipts.docs[0].get('response.bookingId'), booking.id);
const notes = await db.collection('notifications').where('sourceId', '==', booking.id).get();
const notifications = notes.docs.map((note) => ({ type: note.get('type'), userId: note.get('userId') }))
  .sort((a, b) => a.type.localeCompare(b.type));
if (phase !== 'requested') assert.equal(notifications.filter((n) => n.type === 'bookingApproved' && n.userId === parent.uid).length, 1);
if (phase === 'cancelled') {
  assert.equal(data.cancelledByUserId, parent.uid); assert.equal(data.refundStatus, 'notRequired');
  assert.equal(notifications.filter((n) => n.type === 'bookingCancelled' && n.userId === data.driverUserId).length, 1);
}
const result = { projectId: session.projectId, runId: session.runId, recordedAt: new Date().toISOString(),
  scope: 'independent-local-persisted-checkpoint-not-native-ui-or-two-phone-proof', phase, parentUserId: parent.uid,
  parentEmail: email, parentRoles: parent.customClaims.roleKeys, bookingId: booking.id, tripId: data.tripId,
  driverUserId: data.driverUserId, status: data.status, seats: data.seats, seatsAvailable: trip.seatsAvailable,
  requestReceiptCount: receipts.size, bookingCount: snapshot.size, notifications,
  paymentExercised: false, productionDataWritten: false,
  ...(phase === 'cancelled' ? { cancelledByUserId: data.cancelledByUserId, refundStatus: data.refundStatus } : {}) };
writeFileSync(output, JSON.stringify(result, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
console.log(JSON.stringify({ phase, bookingCount: 1, seatsAvailable: trip.seatsAvailable, output }));
