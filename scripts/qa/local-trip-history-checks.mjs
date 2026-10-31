import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { Timestamp } from 'firebase-admin/firestore';
import { auth, call, db, denied, document, signIn, tripInput, viewedBooking } from './local-flow-client.mjs';
import { tripChangeHash } from '../../functions/lib/domain/tripChanges.js';

export async function checkTripHistory() {
  const driver = await signIn('d@example.test'), parent = await signIn('p@example.test');
  const second = await signIn('c@example.test');
  await auth.createUser({ uid: 'sgm-qa-history-later-parent', email: 'history-later-parent@example.test', password: process.env.SGM_QA_PASSWORD });
  await auth.setCustomUserClaims('sgm-qa-history-later-parent', { roleKeys: ['parent'] });
  const outsider = await signIn('history-later-parent@example.test');
  await call('initializeUserProfile', outsider);
  const tripId = (await call('createTrip', driver, { ...tripInput(), title: 'Historique QA isolé', priceCents: 250 })).tripId;
  const book = async (actor, child = false) => {
    const { bookingId } = await call('requestBooking', actor, await viewedBooking(actor,
      { tripId, seats: 1, ...(child ? { childId: 'sgm-qa-child-lina' } : {}) }));
    await call('approveBooking', driver, { bookingId });
    return bookingId;
  };
  const firstBooking = await book(parent, true), secondBooking = await book(second);
  const proposals = [];
  for (let index = 0; index < 13; index++) {
    if (index === 6) await book(outsider);
    const preview = await call('getTripChangePreview', driver, { tripId });
    const change = await call('proposeTripChanges', driver, { tripId, requestId: randomUUID(), expectedRevision: preview.revision,
      terms: { ...preview.terms, priceCents: 300 + index } });
    if (index % 2 === 0) await call('respondToTripChanges', parent, { tripId, proposalId: change.proposalId,
      proposalRevision: change.revision, requestId: randomUUID(), decision: 'decline' });
    else await call('withdrawTripChanges', driver, { tripId, proposalId: change.proposalId, requestId: randomUUID() });
    // A tie is an adversarial ordering fixture, not a synthetic user decision.
    const nanos = Math.floor(index / 3) * 1000;
    await db.collection('tripChanges').doc(change.proposalId).update({ createdAt: new Timestamp(1792300000, nanos) });
    assert.equal((await db.collection('tripChanges').doc(change.proposalId).get()).get('createdAt').nanoseconds, nanos);
    proposals.push({ proposalId: change.proposalId, index, status: index % 2 === 0 ? 'declined' : 'withdrawn' });
  }
  const expected = [...proposals].sort((a, b) => Math.floor(b.index / 3) - Math.floor(a.index / 3) || b.proposalId.localeCompare(a.proposalId));
  const snapshot = async () => {
    const collections = {};
    for (const name of ['tripChanges', 'bookings', 'notifications']) {
      const field = name === 'notifications' ? 'sourceId' : 'tripId';
      const found = await db.collection(name).where(field, '==', tripId).get();
      collections[name] = found.docs.map((doc) => ({ id: doc.id, ...doc.data() })).sort((a, b) => a.id.localeCompare(b.id));
    }
    return tripChangeHash({ trip: await document('trips', tripId), ...collections });
  };
  const beforeHash = await snapshot();
  let parentCursor;
  const counts = [];
  for (const actor of [parent, second, driver, outsider]) {
    const first = await call('getTripChangeHistory', actor, { tripId });
    const rows = [...first.items];
    if (first.nextCursor) {
      const rest = await call('getTripChangeHistory', actor, { tripId, cursor: first.nextCursor });
      rows.push(...rest.items); assert.equal(rest.nextCursor, null);
    }
    const own = actor === outsider ? expected.filter((p) => p.index >= 6) : expected;
    assert.deepEqual(rows.map((r) => r.proposalId), own.map((r) => r.proposalId));
    assert.deepEqual(rows.map((r) => r.status), own.map((r) => r.status));
    for (const row of rows) assert.deepEqual(Object.keys(row).sort(), ['tripId', 'proposalId', 'status', 'createdAt', 'departureAt', 'priceCents'].sort());
    if (actor === parent) parentCursor = first.nextCursor;
    for (const row of rows) {
      const review = await call('getTripChangeReview', actor, { tripId, proposalId: row.proposalId });
      assert.equal(review.status, row.status); assert.equal(review.canRespond, false); assert.equal(review.canWithdraw, false);
      if (actor === parent) assert.deepEqual(review.bookingIds, [firstBooking]);
      if (actor === second) assert.deepEqual(review.bookingIds, [secondBooking]);
    }
    counts.push(rows.length);
  }
  assert.equal(typeof parentCursor, 'string');
  await denied('getTripChangeHistory', second, { tripId, cursor: parentCursor }, 'PERMISSION_DENIED');
  await denied('getTripChangeHistory', null, { tripId }, 'UNAUTHENTICATED');
  await denied('getTripChangeHistory', parent, { tripId, userId: driver.uid }, 'INVALID_ARGUMENT');
  const otherTrip = (await call('createTrip', driver, { ...tripInput(), title: 'Historique QA vide' })).tripId;
  const empty = await call('getTripChangeHistory', driver, { tripId: otherTrip });
  assert.deepEqual(empty, { tripId: otherTrip, items: [], nextCursor: null });
  await denied('getTripChangeHistory', parent, { tripId: otherTrip }, 'PERMISSION_DENIED');
  await denied('getTripChangeHistory', parent, { tripId: otherTrip, cursor: parentCursor }, 'INVALID_ARGUMENT');
  const child = db.collection('children').doc('sgm-qa-child-lina');
  const guardians = (await child.get()).get('guardianUserIds');
  await child.update({ guardianUserIds: guardians.filter((id) => id !== parent.uid) });
  try {
    await denied('getTripChangeHistory', parent, { tripId }, 'PERMISSION_DENIED');
    await denied('getTripChangeReview', parent, { tripId, proposalId: proposals[0].proposalId }, 'PERMISSION_DENIED');
  } finally { await child.update({ guardianUserIds: guardians }); }
  assert.equal(await snapshot(), beforeHash, 'History reads must not create or modify any trip, booking, proposal or notice');
  const historical = db.collection('tripChanges').doc(proposals[0].proposalId);
  const originalParents = (await historical.get()).get('parentUserIds');
  await historical.update({ parentUserIds: [...originalParents, outsider.uid] });
  try {
    await denied('getTripChangeHistory', outsider, { tripId }, 'PERMISSION_DENIED');
    await denied('getTripChangeReview', outsider, { tripId, proposalId: proposals[0].proposalId }, 'PERMISSION_DENIED');
  } finally { await historical.update({ parentUserIds: originalParents }); }
  assert.equal(await snapshot(), beforeHash);
  const afterHash = await snapshot();
  await call('cancelBooking', parent, { bookingId: firstBooking, reason: 'Isolated history after cancellation' });
  const cancelledBeforeHash = await snapshot();
  assert.equal((await document('bookings', firstBooking)).status, 'cancelled');
  assert.equal((await call('getTripChangeHistory', parent, { tripId })).items.length, 10);
  assert.deepEqual((await call('getTripChangeReview', parent, { tripId, proposalId: proposals[0].proposalId })).bookingIds, [firstBooking]);
  const cancelledAfterHash = await snapshot(); assert.equal(cancelledAfterHash, cancelledBeforeHash);
  return { proposalCount: 13, pageSize: 10, actorCounts: counts, microsecondAndIdOrdering: true,
    scopedReviewBookingIds: true, laterParentCannotSeeEarlierProposals: true, guardianRevocationDenied: true,
    signedOutDenied: true, crossAccountCursorDenied: true, crossTripCursorDenied: true, recordsUnchanged: true,
    forgedParentListDenied: true, cancelledBookingHistoryPreserved: true, cancelledBeforeHash, cancelledAfterHash,
    beforeHash, afterHash, nativeUiExercised: false, productionDeployed: false };
}
