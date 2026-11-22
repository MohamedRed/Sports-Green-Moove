import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { FieldValue } from 'firebase-admin/firestore';
import { auth, db, call, denied, document, signIn, viewedBooking, tripInput } from './local-flow-client.mjs';
import { verifyRealMapDisplayFiles } from './real-map-display-evidence.mjs';

const secondParent = { uid: 'sgm-qa-real-route-parent-two', email: 'real-route-parent-two@example.test' };
export async function seedRealMapsTripUi() {
  await auth.createUser({ ...secondParent, password: process.env.SGM_QA_PASSWORD, emailVerified: true });
  await auth.setCustomUserClaims(secondParent.uid, { roleKeys: ['parent'] });
  await db.collection('users').doc(secondParent.uid).set({ displayName: 'Deuxième parent QA', roles: { parent: true } });
  await db.collection('memberships').doc(`${secondParent.uid}_sgm-qa-club-green-wavre`).set({
    userId: secondParent.uid, clubId: 'sgm-qa-club-green-wavre', role: 'member', status: 'active', active: true });
  await db.collection('clubs').doc('sgm-qa-club-green-wavre').update({ memberCount: FieldValue.increment(1) });
  const driver = await signIn('d@example.test'), parents = [await signIn('p@example.test'), await signIn(secondParent.email)];
  const { tripId } = await call('createTrip', driver, { ...tripInput(), title: 'Nouveau parcours QA', priceCents: 0 });
  const bookingIds = [];
  for (const actor of parents) {
    const { bookingId } = await call('requestBooking', actor, await viewedBooking(actor, { tripId, seats: 1 }));
    await call('approveBooking', driver, { bookingId }); bookingIds.push(bookingId);
  }
  return { tripId, bookingIds, before: await document('trips', tripId), secondParent };
}

export async function verifyRealMapsTripUi(fixture, directory, runId) {
  const native = JSON.parse(readFileSync(resolve(directory, 'local-real-maps-ui.json'), 'utf8'));
  assert.equal(native.projectId, 'demo-sgm-local-qa'); assert.equal(native.runId, runId);
  assert.equal(native.scope, 'native-three-account-real-map-trip-application'); assert.equal(native.tripId, fixture.tripId);
  verifyRealMapDisplayFiles(native.mapDisplay, directory);
  for (const key of ['completed', 'realSuggestionsSelected', 'unconfirmedPlaceBlocked', 'bothParentsConfirmedInApp',
    'originalTripKeptBeforeApplication', 'parentsCannotApply', 'routeQuoteRequired', 'driverAppliedInApp']) assert.equal(native[key], true, key);
  assert.equal(native.selectedPlaceIds.length, 2); assert.equal(new Set(native.selectedPlaceIds).size, 2);
  const changes = await db.collection('tripChanges').where('tripId', '==', fixture.tripId).get();
  assert.equal(changes.size, 1);
  const change = changes.docs[0].data(), proposalId = changes.docs[0].id;
  assert.equal(change.status, 'applied'); assert.equal(Object.keys(change.decisions).length, 2);
  assert(Object.values(change.decisions).every((item) => item.decision === 'accept'));
  assert.deepEqual(change.originalTerms.origin, fixture.before.origin);
  assert.deepEqual(change.originalTerms.destination, fixture.before.destination);
  const saved = await document('trips', fixture.tripId);
  assert.deepEqual(saved.origin, change.terms.origin); assert.deepEqual(saved.destination, change.terms.destination);
  assert.notDeepEqual(saved.origin, fixture.before.origin); assert.notDeepEqual(saved.destination, fixture.before.destination);
  assert.equal(saved.pendingChangeId, undefined); assert.equal(saved.appliedChangeId, proposalId); assert.equal(saved.priceCents, 0);
  const quotes = await db.collection('tripChangeQuotes').where('tripId', '==', fixture.tripId).get();
  assert.equal(quotes.size, 1); const route = quotes.docs[0].data().route;
  assert.equal(change.application.quoteId, quotes.docs[0].id);
  assert.equal(saved.distanceKm, route.distanceMeters / 1000); assert.equal(saved.routeDurationSeconds, route.durationSeconds);
  assert.equal(saved.routeEncodedPolyline, route.encodedPolyline);
  assert.equal(native.quoteText, `${route.distanceMeters} m · ${Math.floor(route.durationSeconds / 60)} min`);
  const parents = [await signIn('p@example.test'), await signIn(secondParent.email)];
  for (const [index, actor] of parents.entries()) {
    const booking = await document('bookings', fixture.bookingIds[index]);
    assert.equal(booking.tripTermsRevision, change.revision); assert.equal(booking.agreedPriceCents, 0);
    assert.equal(booking.tripChangeBalanceCents, 0); assert(!booking.paymentIntentId && !booking.paymentAttempt);
    const review = await call('getTripChangeReview', actor, { tripId: fixture.tripId, proposalId });
    assert.equal(review.applied, true); assert.deepEqual(review.bookingIds, [fixture.bookingIds[index]]);
    assert(!Object.hasOwn(review, 'parentUserIds') && !Object.hasOwn(review, 'decisions'));
  }
  const balances = await db.collection('tripChangeBalances').where('proposalId', '==', proposalId).get();
  assert.equal(balances.size, 2); assert(balances.docs.every((d) => d.data().state === 'notRequired' && d.data().balanceCents === 0));
  const notices = await db.collection('notifications').where('proposalId', '==', proposalId).get();
  assert.equal(notices.docs.filter((d) => d.data().title === 'Trajet modifié').length, 3);
  await denied('getTripChangeReview', await signIn('outsider@example.test'), { tripId: fixture.tripId, proposalId }, 'PERMISSION_DENIED');
  const captureFiles = ['local-real-maps-selected.png', 'local-real-maps-applied.png', native.mapDisplay.screenFile, native.mapDisplay.regionFile];
  for (const file of captureFiles) {
    const png = readFileSync(resolve(directory, file));
    assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
    assert(png.readUInt32BE(16) > 0 && png.readUInt32BE(20) > 0);
  }
  return { projectId: 'demo-sgm-local-qa', runId, testedAt: new Date().toISOString(), status: 'passed',
    scope: 'native-ui-with-local-callables-and-explicit-real-maps-not-physical-device', native, route, captureFiles,
    tripId: fixture.tripId, proposalId, bookingIds: fixture.bookingIds,
    savedTrip: { origin: saved.origin, destination: saved.destination, distanceKm: saved.distanceKm,
      routeDurationSeconds: saved.routeDurationSeconds, polylineSha256: createHash('sha256').update(saved.routeEncodedPolyline).digest('hex') },
    parentCount: 2, acceptedParentCount: 2, quoteThroughCallable: true, nativeUi: true,
    physicalDevice: false, productionDataWritten: false, paymentExercised: false, refundIssued: false,
    steps: [{ id: 'real-route-application-ui', status: 'passed' }] };
}
