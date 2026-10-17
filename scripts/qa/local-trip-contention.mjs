import './local-egress-guard.mjs';
import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { Timestamp } from 'firebase-admin/firestore';
import { db, document } from './local-flow-client.mjs';
import { approveBooking } from '../../functions/lib/callables/bookings.js';
import { previewTripCancellation, cancelPublishedTrip } from '../../functions/lib/services/tripCancellation.js';
import { overlapCancellationAndApproval } from './local-trip-contention-gate.mjs';

const driverUserId = 'sgm-qa-contention-driver', parentUserId = 'sgm-qa-contention-parent';
const approve = (bookingId) => approveBooking.run({ data: { bookingId },
  auth: { uid: driverUserId, token: { roleKeys: ['driver'] } } });
const cases = [];
let failure;
try {
for (let round = 0; round < 12; round++) {
  const tripId = `sgm-qa-controlled-contention-${round}`, bookingId = `${tripId}-booking`;
  await db.collection('trips').doc(tripId).set({ driverUserId, status: 'published',
    seatsTotal: 4, seatsAvailable: 4, title: 'Local controlled contention' });
  await db.collection('bookings').doc(bookingId).set({ tripId, driverUserId, parentUserId,
    requesterUserId: parentUserId, seats: 1, status: 'requested', createdAt: Timestamp.now() });
  const preview = await previewTripCancellation(tripId, driverUserId, false);
  const intent = { tripId, expectedRevision: preview.revision, requestId: randomUUID(),
    reason: 'Annulation du contrôle isolé' };
  const { reads, rpc, settled, gateTimedOut } = await overlapCancellationAndApproval(tripId,
    () => cancelPublishedTrip(intent, driverUserId, false), () => approve(bookingId));
  const trip = await document('trips', tripId), booking = await document('bookings', bookingId);
  const notices = await db.collection('notifications').where('sourceId', 'in', [tripId, bookingId]).get();
  const receipt = await db.collection('tripCancellations').doc(tripId).get();
  const result = { round, tripId, bookingId, reads, rpc, gateTimedOut,
    outcomes: settled.map((item) => item.status === 'fulfilled' ? { status: item.status, result: item.value }
      : { status: item.status, code: item.reason.code, message: item.reason.message }),
    tripStatus: trip.status, bookingStatus: booking.status, seatsAvailable: trip.seatsAvailable,
    notificationCount: notices.size, cancellationReceiptExists: receipt.exists };
  cases.push(result);
  assert.equal(settled.filter((item) => item.status === 'fulfilled').length, 1, 'One reviewed operation must win');
  for (const item of settled) if (item.status === 'rejected')
    assert(['aborted', 'failed-precondition'].includes(item.reason.code), `Unexpected conflict: ${item.reason.code}`);
  assert.equal(notices.size, 1);
  if (trip.status === 'cancelled') {
    assert.equal(booking.status, 'cancelled'); assert.equal(trip.seatsAvailable, 4); assert(receipt.exists);
    assert.deepEqual(receipt.data().bookingIds, [bookingId]);
    assert.equal(notices.docs[0].data().type, 'tripCancelled');
    assert.equal(notices.docs[0].data().userId, parentUserId);
  } else {
    assert.equal(trip.status, 'published'); assert.equal(booking.status, 'approved');
    assert.equal(trip.seatsAvailable, 3); assert(!receipt.exists);
    assert.equal(notices.docs[0].data().type, 'bookingApproved');
  }
}
} catch (error) {
  failure = { message: error.message, code: error.code };
  process.exitCode = 1;
}
const result = { runId: process.env.SGM_LOCAL_RUN_ID, testedAt: new Date().toISOString(),
  projectId: process.env.GCLOUD_PROJECT, scope: 'controlled-local-production-handlers-not-phone-ui',
  sourceSha256: createHash('sha256').update(readFileSync(new URL('../../functions/src/callables/bookings.ts', import.meta.url))).digest('hex'),
  firestoreConfigSha256: createHash('sha256').update(readFileSync(new URL('../../functions/src/lib/firestore.ts', import.meta.url))).digest('hex'),
  passed: !failure, failure, rounds: cases.length, cases, livePayment: false, productionDeployed: false };
mkdirSync(dirname(process.env.SGM_LOCAL_FLOW_OUTPUT), { recursive: true });
writeFileSync(process.env.SGM_LOCAL_FLOW_OUTPUT, `${JSON.stringify(result, null, 2)}\n`);
console.log(`Controlled approval/cancellation: ${cases.length} overlaps; ${failure ? failure.message : 'passed'}.`);
