import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { db, call, denied, document, signIn, viewedBooking, tripInput } from './local-flow-client.mjs';
import { unchangedTripDetails } from './trip-change-inputs-evidence.mjs';
import { assertTripScheduleReceipt, assertTripScheduleRecords, tripScheduleFixtureTimes } from './trip-change-schedule-evidence.mjs';

export async function seedTripScheduleUi() {
  const driver = await signIn('d@example.test'), parent = await signIn('p@example.test');
  const { originalDepartureAt, proposedDepartureAt, desiredArrivalBy, pastDepartureAt } = tripScheduleFixtureTimes();
  const { tripId } = await call('createTrip', driver, { ...tripInput(), title: 'Date et arrivée QA', departureAt: originalDepartureAt, priceCents: 250 });
  const { bookingId } = await call('requestBooking', parent, await viewedBooking(parent, { tripId, seats: 1 }));
  await call('approveBooking', driver, { bookingId });
  return { tripId, bookingId, originalDepartureAt, proposedDepartureAt, desiredArrivalBy, pastDepartureAt,
    before: unchangedTripDetails(await document('trips', tripId)), bookingBefore: await document('bookings', bookingId) };
}

export async function verifyTripScheduleUi(fixture, directory, runId) {
  const native = JSON.parse(readFileSync(resolve(directory, 'local-trip-change-schedule-ui.json'), 'utf8'));
  assertTripScheduleReceipt(native, fixture, runId);
  const captureFiles = ['local-trip-change-date-arrival-confirmed.png'];
  const image = readFileSync(resolve(directory, captureFiles[0]));
  assert(image.length > 24 && image.subarray(0, 8).toString('hex') === '89504e470d0a1a0a');
  assert(image.readUInt32BE(16) > 0 && image.readUInt32BE(20) > 0);
  const driver = await signIn('d@example.test'), parent = await signIn('p@example.test'), outsider = await signIn('outsider@example.test');
  const changes = await db.collection('tripChanges').where('tripId', '==', fixture.tripId).get();
  assert.equal(changes.size, 1, 'Cancelled and invalid drafts must not persist additional proposals');
  const change = changes.docs[0].data(), proposalId = changes.docs[0].id;
  assertTripScheduleRecords({ trip: await document('trips', fixture.tripId), booking: await document('bookings', fixture.bookingId),
    change, proposalId, driverUid: driver.uid, parentUid: parent.uid }, fixture);
  const review = await call('getTripChangeReview', parent, { tripId: fixture.tripId, proposalId });
  assert.equal(review.status, 'confirmed'); assert.equal(review.applied, false); assert.equal(review.acceptedParentCount, 1);
  assert.deepEqual(review.bookingIds, [fixture.bookingId]); assert.equal(review.proposalRequestId, null);
  assert.equal(review.withdrawalRequestId, null); assert.equal(review.originalTerms.arrivalBy, null);
  assert.equal(Date.parse(review.originalTerms.departureAt), Date.parse(fixture.originalDepartureAt));
  assert.equal(Date.parse(review.terms.departureAt), Date.parse(fixture.proposedDepartureAt));
  assert.equal(Date.parse(review.terms.arrivalBy), Date.parse(fixture.desiredArrivalBy));
  assert(!Object.hasOwn(review, 'parentUserIds') && !Object.hasOwn(review, 'decisions'));
  await denied('getTripChangeReview', outsider, { tripId: fixture.tripId, proposalId }, 'PERMISSION_DENIED');
  const quotes = await db.collection('tripChangeQuotes').where('tripId', '==', fixture.tripId).get(); assert.equal(quotes.size, 0);
  const notes = await db.collection('notifications').where('proposalId', '==', proposalId).get();
  assert.equal(notes.size, 3); assert.equal(new Set(notes.docs.map((item) => item.id)).size, 3);
  assert.deepEqual(notes.docs.map((item) => item.data().userId).sort(), [parent.uid, parent.uid, driver.uid].sort());
  const result = { projectId: 'demo-sgm-local-qa', runId, testedAt: new Date().toISOString(),
    recordType: 'native-trip-schedule-stage-not-full-run-result', scope: 'local-ui-not-physical-device',
    testCount: 1, steps: [{ id: 'trip-change-schedule-ui', status: 'passed' }], native, captureFiles,
    tripId: fixture.tripId, bookingId: fixture.bookingId, proposalId,
    originalDepartureAt: fixture.originalDepartureAt, proposedDepartureAt: fixture.proposedDepartureAt, desiredArrivalBy: fixture.desiredArrivalBy,
    tripAndBookingUnchanged: true, parentViewScoped: true, outsiderDenied: true, notificationCount: notes.size,
    datePickerExercised: true, desiredArrivalEditingExercised: true, applicationExercised: false,
    routeProviderExercised: false, paymentExercised: false, fullAppReplay: false,
    limitation: 'Date and desired-arrival consent plus cancelled/past/invalid drafts only; no route change, application, payment, physical tracking or post-restart consent proof.' };
  writeFileSync(resolve(directory, 'trip-change-schedule-ui-stage.json'), JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
  return result;
}
