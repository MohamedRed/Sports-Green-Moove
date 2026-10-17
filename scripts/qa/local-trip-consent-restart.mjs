import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { call, db, denied, document, signIn, tripInput, viewedBooking } from './local-flow-client.mjs';
import { unchangedTripDetails } from './trip-change-inputs-evidence.mjs';
import { stopDisposableAppProcess } from './local-disposable-process-stop.mjs';
import { assertPreparedTripConsent, assertTripConsentRestart } from './trip-consent-restart-evidence.mjs';
import { tripChangeHash } from '../../functions/lib/domain/tripChanges.js';

const save = (directory, name, value) => writeFileSync(resolve(directory, name), JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });

async function seed() {
  const driver = await signIn('d@example.test'), parent = await signIn('p@example.test');
  const { tripId } = await call('createTrip', driver, { ...tripInput(), title: 'Accord après fermeture QA', priceCents: 250 });
  const { bookingId } = await call('requestBooking', parent, await viewedBooking(parent,
    { tripId, childId: 'sgm-qa-child-lina', seats: 1 }));
  await call('approveBooking', driver, { bookingId });
  return { tripId, bookingId, before: unchangedTripDetails(await document('trips', tripId)),
    bookingBefore: await document('bookings', bookingId), driverUid: driver.uid, parentUid: parent.uid };
}

async function snapshot(fixture) {
  const trip = await document('trips', fixture.tripId), booking = await document('bookings', fixture.bookingId);
  assert.deepEqual(unchangedTripDetails(trip), fixture.before);
  assert.deepEqual(booking, fixture.bookingBefore);
  const changes = await db.collection('tripChanges').where('tripId', '==', fixture.tripId).get();
  assert.equal(changes.size, 1); const proposalId = changes.docs[0].id, change = changes.docs[0].data();
  assert.equal(trip.pendingChangeId, proposalId); assert.equal(change.status, 'confirmed');
  assert.equal(change.tripId, fixture.tripId); assert.equal(change.driverUserId, fixture.driverUid);
  assert.deepEqual(change.parentUserIds, [fixture.parentUid]); assert.deepEqual(change.bookingIds, [fixture.bookingId]);
  assert.deepEqual(Object.keys(change.decisions), [fixture.parentUid]);
  assert.equal(change.decisions[fixture.parentUid].decision, 'accept'); assert.equal(change.application, undefined);
  assert.equal(change.originalTerms.priceCents, 250); assert.equal(change.terms.priceCents, 400);
  assert(Number.isFinite(Date.parse(fixture.before.departureAt)));
  for (const terms of [change.originalTerms, change.terms]) {
    for (const key of ['origin', 'destination']) assert.deepEqual(terms[key], fixture.before[key]);
    assert.equal(Date.parse(terms.departureAt), Date.parse(fixture.before.departureAt));
  }
  const quotes = await db.collection('tripChangeQuotes').where('tripId', '==', fixture.tripId).get(); assert.equal(quotes.size, 0);
  const balances = await db.collection('tripChangeBalances').where('tripId', '==', fixture.tripId).get(); assert.equal(balances.size, 0);
  const notes = await db.collection('notifications').where('proposalId', '==', proposalId).get();
  assert.equal(notes.size, 3); assert.deepEqual(notes.docs.map((d) => d.get('userId')).sort(),
    [fixture.parentUid, fixture.parentUid, fixture.driverUid].sort());
  const notifications = notes.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => a.id.localeCompare(b.id));
  return { proposalId, decisionCount: 1, notificationCount: 3, hashes: { trip: tripChangeHash(trip), booking: tripChangeHash(booking),
    proposal: tripChangeHash(change), notifications: tripChangeHash(notifications) } };
}

export async function replayTripConsentRestart({ instrument, collect, adb, serial, directory, runId }) {
  const fixture = await seed();
  const args = ['-e', 'consentRestartTripId', fixture.tripId, '-e', 'consentRestartBookingId', fixture.bookingId];
  instrument(['LocalTripConsentRestartTest#prepareConfirmedConsent'], 1, args);
  const checkpoint = { projectId: 'demo-sgm-local-qa', runId, tripId: fixture.tripId, bookingId: fixture.bookingId,
    scope: 'persisted-confirmed-trip-consent-before-process-boundary', ...await snapshot(fixture) };
  save(directory, 'trip-consent-restart-checkpoint.json', checkpoint);
  stopDisposableAppProcess({ adb, serial, runId, outputDir: directory,
    beforeName: 'local-trip-consent-restart-before.json', validateBefore: assertPreparedTripConsent });
  instrument(['LocalTripConsentRestartTest#reopenConfirmedConsent'], 1, args);
  collect();
  const load = (name) => JSON.parse(readFileSync(resolve(directory, name), 'utf8'));
  const before = load('local-trip-consent-restart-before.json'), after = load('local-trip-consent-restart-after.json');
  const stopped = load('local-trip-consent-restart-stop.json');
  assertTripConsentRestart(before, stopped, after, fixture, runId);
  assert.equal(before.proposalId, checkpoint.proposalId);
  const persisted = await snapshot(fixture);
  assert.deepEqual(persisted, { proposalId: checkpoint.proposalId, decisionCount: checkpoint.decisionCount,
    notificationCount: checkpoint.notificationCount, hashes: checkpoint.hashes }, 'Reopening and refreshing must not write another decision or notice');
  const parent = await signIn('p@example.test'), driver = await signIn('d@example.test'), outsider = await signIn('outsider@example.test');
  for (const actor of [parent, driver]) {
    const review = await call('getTripChangeReview', actor, { tripId: fixture.tripId, proposalId: before.proposalId });
    assert.equal(review.status, 'confirmed'); assert.equal(review.applied, false); assert.equal(review.acceptedParentCount, 1);
    if (actor.uid === parent.uid) {
      assert.deepEqual(review.bookingIds, [fixture.bookingId]); assert.equal(review.proposalRequestId, null);
      assert(!Object.hasOwn(review, 'parentUserIds') && !Object.hasOwn(review, 'decisions'));
    }
  }
  await denied('getTripChangeReview', outsider, { tripId: fixture.tripId, proposalId: before.proposalId }, 'PERMISSION_DENIED');
  await assert.rejects(() => call('startRide', driver, { tripId: fixture.tripId }), (error) => error.code === 'FAILED_PRECONDITION' &&
    error.message === 'startRide: A proposed change must be resolved before starting the ride.');
  assert.equal((await db.collection('rideSessions').where('tripId', '==', fixture.tripId).get()).size, 0);
  const captureFiles = ['before', 'after', 'driver'].map((phase) => `local-trip-consent-restart-${phase}.png`);
  for (const name of captureFiles) {
    const image = readFileSync(resolve(directory, name));
    assert(image.length > 24 && image.subarray(0, 8).toString('hex') === '89504e470d0a1a0a');
    assert(image.readUInt32BE(16) > 0 && image.readUInt32BE(20) > 0);
  }
  const result = { projectId: 'demo-sgm-local-qa', runId, testedAt: new Date().toISOString(),
    recordType: 'native-trip-consent-restart-stage-not-full-run-result', scope: 'local-ui-not-physical-device',
    testCount: 1, nativeCaseCount: 2, steps: [{ id: 'trip-consent-process-restart-ui', status: 'passed' }],
    tripId: fixture.tripId, bookingId: fixture.bookingId, proposalId: before.proposalId,
    native: { before, stopped, after }, checkpoint, persisted, captureFiles,
    originalDecisionAndNoticesUnchanged: true, tripAndBookingUnchanged: true, parentViewScoped: true, outsiderDenied: true,
    unappliedTripStartDenied: true, applicationExercised: false, routeProviderExercised: false, paymentExercised: false,
    fullAppReplay: false, limitation: 'Confirmed single-parent price consent after process death only; no pending/refused/withdrawn proposal recovery, unsent drafts, application, route, real payment or physical-device proof.' };
  save(directory, 'trip-consent-restart-ui-stage.json', result);
  return result;
}
