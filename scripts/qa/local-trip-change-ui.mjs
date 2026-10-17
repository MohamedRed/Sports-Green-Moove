import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { FieldValue } from 'firebase-admin/firestore';
import { auth, db, call, denied, document, signIn, viewedBooking, tripInput } from './local-flow-client.mjs';
import { assertTripChangeUiReceipt } from './trip-change-ui-evidence.mjs';

const secondParent = { uid: 'sgm-qa-trip-change-parent-two', email: 'trip-change-parent-two@example.test' };
const cleanTrip = (trip) => Object.fromEntries(Object.entries(trip).filter(([key]) => !['pendingChangeId', 'updatedAt'].includes(key)));

export async function seedTripChangeUi() {
  await auth.createUser({ ...secondParent, password: process.env.SGM_QA_PASSWORD, emailVerified: true, displayName: 'Deuxième parent QA' });
  await auth.setCustomUserClaims(secondParent.uid, { roleKeys: ['parent'] });
  await db.collection('users').doc(secondParent.uid).set({ displayName: 'Deuxième parent QA', roles: { parent: true } });
  await db.collection('memberships').doc(`${secondParent.uid}_sgm-qa-club-green-wavre`).set({
    userId: secondParent.uid, clubId: 'sgm-qa-club-green-wavre', role: 'member', status: 'active', active: true,
  });
  await db.collection('clubs').doc('sgm-qa-club-green-wavre').update({ memberCount: FieldValue.increment(1) });
  const driver = await signIn('d@example.test'), parents = [await signIn('p@example.test'), await signIn(secondParent.email)];
  const fixtures = {};
  for (const kind of ['confirmed', 'declined', 'withdrawn']) {
    const { tripId } = await call('createTrip', driver, { ...tripInput(), title: `Confirmation des parents QA ${kind}`, priceCents: 250 });
    const bookingIds = [];
    for (const parent of parents) {
      const { bookingId } = await call('requestBooking', parent, await viewedBooking(parent, { tripId, seats: 1 }));
      await call('approveBooking', driver, { bookingId });
      bookingIds.push(bookingId);
    }
    fixtures[kind] = { tripId, bookingIds, before: cleanTrip(await document('trips', tripId)),
      bookingsBefore: await Promise.all(bookingIds.map((id) => document('bookings', id))) };
  }
  return { fixtures, secondParent };
}

export async function verifyTripChangeUi({ fixtures }, directory, runId) {
  const native = JSON.parse(readFileSync(resolve(directory, 'local-trip-change-ui.json'), 'utf8'));
  assertTripChangeUiReceipt(native, { fixtures, runId });
  const driver = await signIn('d@example.test'), parent = await signIn('p@example.test');
  const second = await signIn(secondParent.email), outsider = await signIn('outsider@example.test');
  const records = [];
  for (const [kind, fixture] of Object.entries(fixtures)) {
    const trip = await document('trips', fixture.tripId);
    assert.deepEqual(cleanTrip(trip), fixture.before, 'Consent alone must not alter the trip');
    for (const [index, id] of fixture.bookingIds.entries()) assert.deepEqual(await document('bookings', id), fixture.bookingsBefore[index]);
    const changes = await db.collection('tripChanges').where('tripId', '==', fixture.tripId).get();
    assert.equal(changes.size, 1); const change = changes.docs[0].data(), proposalId = changes.docs[0].id;
    assert.equal(change.status, kind); assert.equal(change.terms.priceCents, 400); assert.equal(change.originalTerms.priceCents, 250);
    assert.deepEqual([...change.parentUserIds].sort(), [parent.uid, second.uid].sort());
    assert.deepEqual([...change.bookingIds].sort(), [...fixture.bookingIds].sort());
    const decisions = Object.values(change.decisions);
    assert.equal(decisions.length, kind === 'confirmed' ? 2 : kind === 'declined' ? 1 : 0);
    assert(decisions.every((item) => item.decision === (kind === 'declined' ? 'decline' : 'accept')));
    if (kind === 'confirmed') assert.equal(trip.pendingChangeId, proposalId);
    else assert.equal(trip.pendingChangeId, undefined);
    for (const [index, actor] of [parent, second].entries()) {
      const review = await call('getTripChangeReview', actor, { tripId: fixture.tripId, proposalId });
      assert.deepEqual(review.bookingIds, [fixture.bookingIds[index]]); assert.equal(review.applied, false);
      assert.equal(review.proposalRequestId, null); assert.equal(review.withdrawalRequestId, null);
      assert(!Object.hasOwn(review, 'parentUserIds') && !Object.hasOwn(review, 'decisions'));
    }
    await denied('getTripChangeReview', outsider, { tripId: fixture.tripId, proposalId }, 'PERMISSION_DENIED');
    if (kind === 'confirmed') await assert.rejects(() => call('startRide', driver, { tripId: fixture.tripId }),
      (error) => error.code === 'FAILED_PRECONDITION' &&
        error.message === 'startRide: A proposed change must be resolved before starting the ride.');
    const notes = await db.collection('notifications').where('proposalId', '==', proposalId).get();
    assert.equal(notes.size, 5); assert.equal(new Set(notes.docs.map((item) => item.id)).size, 5);
    records.push({ tripId: fixture.tripId, proposalId, status: kind, parentCount: 2, decisionCount: decisions.length,
      bookingCount: 2, originalPriceCents: 250, proposedPriceCents: 400, notificationCount: notes.size });
  }
  const result = { projectId: 'demo-sgm-local-qa', runId, testedAt: new Date().toISOString(),
    recordType: 'native-trip-change-stage-not-full-run-result', scope: 'local-ui-not-physical-device',
    testCount: 1, steps: [{ id: 'trip-change-parent-confirmation-ui', status: 'passed' }],
    method: 'native-app-three-account-ui-with-independent-persisted-checks', records, native,
    tripAndBookingsUnchanged: true, parentViewsScoped: true, outsiderDenied: true, unappliedTripStartDenied: true,
    applicationExercised: false, routeProviderExercised: false, paymentExercised: false, fullAppReplay: false,
    limitation: 'Price proposals, consent, refusal and withdrawal only; no route calculation, application, payment or physical-device proof.' };
  writeFileSync(resolve(directory, 'trip-change-ui-stage.json'), JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
  return result;
}
