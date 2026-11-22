import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { db, call, denied, document, signIn, viewedBooking, tripInput } from './local-flow-client.mjs';
import { assertTripChangeInputsReceipt, assertTripChangeInputsRecords, unchangedTripDetails } from './trip-change-inputs-evidence.mjs';

export async function seedTripChangeInputsUi() {
  const driver = await signIn('d@example.test'), parent = await signIn('p@example.test');
  const departure = new Date(Date.now() + 24 * 3600_000);
  departure.setUTCHours(9, 0, 0, 0);
  const originalDepartureAt = departure.toISOString();
  const proposedDepartureAt = new Date(departure.getTime() + 3600_000).toISOString();
  const { tripId } = await call('createTrip', driver, { ...tripInput(), title: 'Horaire et adresses QA', departureAt: originalDepartureAt, priceCents: 250 });
  const { bookingId } = await call('requestBooking', parent, await viewedBooking(parent, { tripId, seats: 1 }));
  await call('approveBooking', driver, { bookingId });
  return { tripId, bookingId, originalDepartureAt, proposedDepartureAt,
    before: unchangedTripDetails(await document('trips', tripId)), bookingBefore: await document('bookings', bookingId) };
}

export async function verifyTripChangeInputsUi(fixture, directory, runId) {
  const native = JSON.parse(readFileSync(resolve(directory, 'local-trip-change-inputs-ui.json'), 'utf8'));
  assertTripChangeInputsReceipt(native, fixture, runId);
  const captureFiles = ['local-trip-change-time-confirmed.png', 'local-trip-change-route-unavailable.png'];
  for (const name of captureFiles) {
    const image = readFileSync(resolve(directory, name));
    assert(image.length > 24 && image.subarray(0, 8).toString('hex') === '89504e470d0a1a0a');
    assert(image.readUInt32BE(16) > 0 && image.readUInt32BE(20) > 0);
  }
  const driver = await signIn('d@example.test'), parent = await signIn('p@example.test'), outsider = await signIn('outsider@example.test');
  const changes = await db.collection('tripChanges').where('tripId', '==', fixture.tripId).get();
  assert.equal(changes.size, 1);
  const change = changes.docs[0].data(), proposalId = changes.docs[0].id;
  assertTripChangeInputsRecords({ trip: await document('trips', fixture.tripId), booking: await document('bookings', fixture.bookingId),
    change, proposalId, parentUid: parent.uid, driverUid: driver.uid }, fixture);
  const review = await call('getTripChangeReview', parent, { tripId: fixture.tripId, proposalId });
  assert.equal(review.status, 'confirmed'); assert.equal(review.applied, false);
  assert.deepEqual(review.bookingIds, [fixture.bookingId]); assert.equal(review.acceptedParentCount, 1);
  assert.equal(Date.parse(review.terms.departureAt), Date.parse(fixture.proposedDepartureAt));
  assert.equal(review.proposalRequestId, null); assert.equal(review.withdrawalRequestId, null);
  assert(!Object.hasOwn(review, 'parentUserIds') && !Object.hasOwn(review, 'decisions'));
  await denied('getTripChangeReview', outsider, { tripId: fixture.tripId, proposalId }, 'PERMISSION_DENIED');
  const quotes = await db.collection('tripChangeQuotes').where('tripId', '==', fixture.tripId).get();
  assert.equal(quotes.size, 0, 'A failed real route request cannot leave an applicable quote');
  const notes = await db.collection('notifications').where('proposalId', '==', proposalId).get();
  assert.equal(notes.size, 3); assert.equal(new Set(notes.docs.map((item) => item.id)).size, 3);
  assert.deepEqual(notes.docs.map((item) => item.data().userId).sort(), [parent.uid, parent.uid, driver.uid].sort());
  const result = { projectId: 'demo-sgm-local-qa', runId, testedAt: new Date().toISOString(),
    recordType: 'native-trip-change-inputs-stage-not-full-run-result', scope: 'local-ui-not-physical-device',
    testCount: 1, steps: [{ id: 'trip-change-inputs-ui', status: 'passed' }], native, captureFiles,
    tripId: fixture.tripId, proposalId, bookingId: fixture.bookingId,
    originalDepartureAt: fixture.originalDepartureAt, proposedDepartureAt: fixture.proposedDepartureAt,
    tripAndBookingUnchanged: true, parentViewScoped: true, outsiderDenied: true, notificationCount: notes.size,
    applicationExercised: false, successfulRouteChangeExercised: false, routeProviderExercised: false,
    paymentExercised: false, datePickerExercised: false, fullAppReplay: false,
    limitation: 'Departure time and price consent, unresolved-address rejection and failed route request only; no successful place lookup, route change, application, payment or physical-device proof.' };
  writeFileSync(resolve(directory, 'trip-change-inputs-ui-stage.json'), JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
  return result;
}
