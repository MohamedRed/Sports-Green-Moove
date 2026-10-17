import './local-egress-guard.mjs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { Transaction } from 'firebase-admin/firestore';
import { db, tripInput } from './local-flow-client.mjs';
import { requestBooking } from '../../functions/lib/callables/bookings.js';
import { bookingIntentSnapshot } from '../../functions/lib/domain/bookingIntent.js';
import { applyChangesDuringBooking } from './local-booking-application-race.mjs';

const parentUserId = 'sgm-qa-consistency-parent', driverUserId = 'sgm-qa-consistency-driver';
const scenarios = [
  ['price', 'aborted', (trip) => trip.update({ priceCents: 900, appliedChangeId: 'a'.repeat(64) })],
  ['departure', 'aborted', (trip) => trip.update({ departureAt: new Date(Date.now() + 72 * 3600_000).toISOString() })],
  ['origin', 'aborted', (trip) => trip.update({ origin: { lat: 50.75, lng: 4.61 } })],
  ['destination', 'aborted', (trip) => trip.update({ destination: { lat: 50.88, lng: 4.36 } })],
  ['arrival', 'aborted', (trip) => trip.update({ arrivalBy: new Date(Date.now() + 73 * 3600_000).toISOString() })],
  ['applied-revision', 'aborted', (trip) => trip.update({ appliedChangeId: 'b'.repeat(64) })],
  ['guardian-revoked', 'permission-denied', (_trip, child) => child.update({ guardianUserIds: [] })],
  ['child-deleted', 'permission-denied', (_trip, child) => child.delete()],
  ['child-label', null, (_trip, child) => child.update({ displayName: 'QA enfant actualisé' })],
  ['cosmetic-title', null, (trip) => trip.update({ title: 'QA titre actualisé' })],
  ['closed-trip', 'failed-precondition', (trip) => trip.update({ status: 'cancelled' })],
  ['pending-proposal', 'failed-precondition', (trip) => trip.update({ pendingChangeId: 'c'.repeat(64) })],
  ['lost-capacity', 'failed-precondition', (trip) => trip.update({ seatsAvailable: 0 })],
  ['confirmed-application', 'aborted', (trip) => applyChangesDuringBooking(trip, driverUserId)],
];
const cases = [];
for (const [id, expectedError, mutate] of scenarios) {
  const trip = db.collection('trips').doc(`sgm-qa-consistency-${id}`);
  const child = db.collection('children').doc(`${trip.id}-child`);
  const initial = { ...tripInput(), driverUserId, status: 'published', priceCents: 250 };
  await trip.set(initial);
  await child.set({ displayName: 'QA enfant initial', guardianUserIds: [parentUserId] });
  const originalGet = Transaction.prototype.get;
  let mutationApplied = false, mutationPhase = false, mutationResult, returned, rejected;
  const reads = [];
  Transaction.prototype.get = async function (reference, ...options) {
    if (!mutationApplied) {
      mutationApplied = true;
      mutationPhase = true;
      try { mutationResult = await mutate(trip, child); }
      finally { mutationPhase = false; }
    }
    if (!mutationPhase) reads.push(reference.path ?? 'query');
    return originalGet.call(this, reference, ...options);
  };
  try {
    returned = await requestBooking.run({ data: { tripId: trip.id, childId: child.id, seats: 2,
      expectedBookingIntent: bookingIntentSnapshot(initial) },
      auth: { uid: parentUserId, token: { roleKeys: ['parent'] } } });
  } catch (error) { rejected = { code: error.code, message: error.message }; }
  finally { Transaction.prototype.get = originalGet; }
  const bookings = await db.collection('bookings').where('tripId', '==', trip.id).where('parentUserId', '==', parentUserId).get();
  const current = (await trip.get()).data(), currentChild = await child.get();
  const saved = bookings.docs.map((doc) => ({ id: doc.id, tripId: doc.data().tripId,
    seats: doc.data().seats, childLabel: doc.data().childLabel, status: doc.data().status,
    agreedPriceCents: doc.data().agreedPriceCents, tripTermsRevision: doc.data().tripTermsRevision }));
  let failure;
  try {
    assert(mutationApplied, 'The mutation must occur between preflight and transaction reads');
    if (expectedError) { assert.equal(rejected?.code, expectedError); assert.equal(bookings.size, 0); }
    else {
      assert.equal(rejected, undefined); assert.equal(bookings.size, 1);
      assert.equal(saved[0].seats, 2); assert.equal(saved[0].status, 'requested');
      assert.equal(saved[0].childLabel, currentChild.data().displayName);
      assert.equal(returned.trip.title, current.title);
    }
  } catch (error) { failure = error.message; process.exitCode = 1; }
  cases.push({ id, status: failure ? 'failed' : 'passed', failure, expectedError, mutationApplied,
    reads, rejected, mutationResult: id === 'confirmed-application' ? mutationResult : undefined,
    bookingCount: bookings.size, bookings: saved,
    initialTerms: { priceCents: initial.priceCents, departureAt: initial.departureAt, origin: initial.origin, destination: initial.destination },
    currentTerms: { priceCents: current.priceCents, departureAt: current.departureAt, origin: current.origin,
      destination: current.destination, arrivalBy: current.arrivalBy, appliedChangeId: current.appliedChangeId },
    childExists: currentChild.exists, currentGuardians: currentChild.data()?.guardianUserIds,
    returnedTrip: returned?.trip,
  });
}
const result = { runId: process.env.SGM_LOCAL_RUN_ID, testedAt: new Date().toISOString(), projectId: process.env.GCLOUD_PROJECT,
  scope: 'controlled-local-booking-handler-not-phone-ui', passed: cases.every((item) => item.status === 'passed'), cases,
  bookingSourceSha256: createHash('sha256').update(readFileSync(new URL('../../functions/src/callables/bookings.ts', import.meta.url))).digest('hex'),
  requestSourceSha256: createHash('sha256').update(readFileSync(new URL('../../functions/src/callables/bookingRequests.ts', import.meta.url))).digest('hex'),
  intentSourceSha256: createHash('sha256').update(readFileSync(new URL('../../functions/src/domain/bookingIntent.ts', import.meta.url))).digest('hex'),
  livePayment: false, productionDeployed: false };
mkdirSync(dirname(process.env.SGM_LOCAL_FLOW_OUTPUT), { recursive: true });
writeFileSync(process.env.SGM_LOCAL_FLOW_OUTPUT, `${JSON.stringify(result, null, 2)}\n`);
console.log(`Booking consistency: ${cases.filter((item) => item.status === 'passed').length}/${cases.length} cases passed.`);
