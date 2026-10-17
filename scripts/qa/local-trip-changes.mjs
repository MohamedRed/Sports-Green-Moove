import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { viewedBooking, auth, call, db, denied, document, signIn, tripInput } from './local-flow-client.mjs';
import { checkTripChangeEdges } from './local-trip-change-edges.mjs';

export async function checkTripChanges() {
  const driver = await signIn('d@example.test'), parent = await signIn('p@example.test');
  const second = await signIn('c@example.test'), outsider = await signIn('outsider@example.test');
  await auth.createUser({ uid: 'sgm-qa-trip-change-driver', email: 'trip-change-driver@example.test', password: process.env.SGM_QA_PASSWORD });
  await auth.setCustomUserClaims('sgm-qa-trip-change-driver', { roleKeys: ['driver', 'parent'] });
  const foreign = await signIn('trip-change-driver@example.test');
  const create = async (overrides = {}) => (await call('createTrip', driver, { ...tripInput(), priceCents: 250, ...overrides })).tripId;
  const book = async (tripId, actor = parent, child = false) => (await call('requestBooking', actor,
    await viewedBooking({ tripId, seats: 1, ...(child ? { childId: 'sgm-qa-child-lina' } : {}) }))).bookingId;
  const preview = (tripId) => call('getTripChangePreview', driver, { tripId });
  const proposal = (tripId, initial, overrides = {}) => ({ tripId, expectedRevision: initial.revision, requestId: randomUUID(),
    terms: { ...initial.terms, departureAt: new Date(Date.parse(initial.terms.departureAt) + 30 * 60_000).toISOString(),
      origin: { lat: 50.72, lng: 4.62 }, priceCents: 400, ...overrides } });
  const vote = (tripId, change, decision = 'accept') => ({ tripId, proposalId: change.proposalId,
    proposalRevision: change.revision, requestId: randomUUID(), decision });
  const clean = (trip) => Object.fromEntries(Object.entries(trip).filter(([key]) => !['updatedAt', 'pendingChangeId'].includes(key)));
  const tripId = await create();
  const firstId = await book(tripId, parent, true), siblingId = await book(tripId), secondId = await book(tripId, second);
  for (const bookingId of [firstId, siblingId, secondId]) await call('approveBooking', driver, { bookingId });
  // Synthetic paid metadata only; no provider charge or refund is created.
  await db.collection('bookings').doc(firstId).update({ paymentStatus: 'paid', amountPaidCents: 250 });
  const pendingId = await book(tripId);
  const before = await document('trips', tripId), bookings = await Promise.all([firstId, siblingId, secondId, pendingId].map((id) => document('bookings', id)));
  const initial = await preview(tripId); assert.equal(initial.parentCount, 2); assert.equal(initial.bookingCount, 4);
  const request = proposal(tripId, initial);
  for (const actor of [parent, outsider, foreign, null]) {
    await denied('getTripChangePreview', actor, { tripId }, actor ? 'PERMISSION_DENIED' : 'UNAUTHENTICATED');
    await denied('proposeTripChanges', actor, request, actor ? 'PERMISSION_DENIED' : 'UNAUTHENTICATED');
  }
  await denied('proposeTripChanges', driver, { ...request, parentUserIds: [parent.uid] }, 'INVALID_ARGUMENT');
  await denied('proposeTripChanges', driver, { ...request, terms: initial.terms }, 'INVALID_ARGUMENT');
  await denied('proposeTripChanges', driver, { ...request, terms: { ...request.terms, departureAt: '2000-01-01T10:00:00Z' } }, 'INVALID_ARGUMENT');
  const pair = await Promise.all([call('proposeTripChanges', driver, request), call('proposeTripChanges', driver, request)]);
  assert.deepEqual(pair[0], pair[1]); const change = pair[0];
  assert.equal(change.status, 'pending'); assert.equal(change.applied, false); assert.equal(change.applicationImplemented, true);
  assert.equal(change.parentCount, 2); assert.equal(change.acceptedParentCount, 0);
  const ref = { tripId, proposalId: change.proposalId };
  for (const actor of [outsider, foreign, null]) {
    const code = actor ? 'PERMISSION_DENIED' : 'UNAUTHENTICATED';
    await denied('getTripChangeReview', actor, ref, code); await denied('respondToTripChanges', actor, vote(tripId, change), code);
  }
  await denied('respondToTripChanges', driver, vote(tripId, change), 'PERMISSION_DENIED');
  const own = await call('getTripChangeReview', parent, ref), other = await call('getTripChangeReview', second, ref);
  assert.deepEqual(own.bookingIds, [firstId, siblingId, pendingId].sort()); assert.deepEqual(other.bookingIds, [secondId]);
  for (const view of [own, other]) { assert(!Object.hasOwn(view, 'parentUserIds')); assert(!Object.hasOwn(view, 'decisions')); assert.equal(view.canRespond, true); }
  await denied('respondToTripChanges', parent, { ...vote(tripId, change), parentUserId: second.uid }, 'INVALID_ARGUMENT');
  await denied('respondToTripChanges', parent, { ...vote(tripId, change), proposalRevision: 'a'.repeat(64) }, 'ABORTED');
  await denied('proposeTripChanges', driver, { ...request, terms: { ...request.terms, priceCents: 401 } }, 'ALREADY_EXISTS');
  await denied('proposeTripChanges', driver, { ...request, requestId: randomUUID() }, 'FAILED_PRECONDITION');
  await denied('requestBooking', outsider, await viewedBooking({ tripId, seats: 1 }), 'FAILED_PRECONDITION');
  await denied('approveBooking', driver, { bookingId: pendingId }, 'FAILED_PRECONDITION');
  await denied('startRide', driver, { tripId }, 'FAILED_PRECONDITION');
  await denied('createRidePaymentIntent', second, { bookingId: secondId }, 'FAILED_PRECONDITION');
  const firstVote = vote(tripId, change);
  const accepted = await Promise.all([call('respondToTripChanges', parent, firstVote), call('respondToTripChanges', parent, firstVote)]);
  assert.deepEqual(accepted[0], accepted[1]); assert.equal(accepted[0].status, 'pending'); assert.equal(accepted[0].acceptedParentCount, 1);
  await denied('respondToTripChanges', parent, { ...firstVote, requestId: randomUUID() }, 'ALREADY_EXISTS');
  await denied('respondToTripChanges', parent, { ...firstVote, decision: 'decline' }, 'ALREADY_EXISTS');
  const confirmed = await call('respondToTripChanges', second, vote(tripId, change));
  assert.equal(confirmed.status, 'confirmed'); assert.equal(confirmed.acceptedParentCount, 2); assert.equal(confirmed.applied, false);
  assert.deepEqual(clean(await document('trips', tripId)), clean(before));
  for (const [index, id] of [firstId, siblingId, secondId, pendingId].entries()) assert.deepEqual(await document('bookings', id), bookings[index]);
  const saved = await document('tripChanges', change.proposalId);
  assert.equal(Object.keys(saved.decisions).length, 2); assert.equal(saved.terms.priceCents, 400); assert.equal(saved.originalTerms.priceCents, 250);
  const notes = await db.collection('notifications').where('proposalId', '==', change.proposalId).get();
  assert.equal(notes.size, 5); assert.equal(new Set(notes.docs.map((item) => item.id)).size, 5);
  assert.equal((await call('respondToTripChanges', parent, firstVote)).status, 'confirmed');
  assert.equal((await call('proposeTripChanges', driver, request)).status, 'confirmed');
  assert.equal((await db.collection('notifications').where('proposalId', '==', change.proposalId).get()).size, 5);
  await denied('startRide', driver, { tripId }, 'FAILED_PRECONDITION');
  const withdrawal = { ...ref, requestId: randomUUID() };
  for (const actor of [parent, foreign, null]) await denied('withdrawTripChanges', actor, withdrawal, actor ? 'PERMISSION_DENIED' : 'UNAUTHENTICATED');
  assert.equal((await call('withdrawTripChanges', driver, withdrawal)).status, 'withdrawn');
  assert.equal((await call('withdrawTripChanges', driver, withdrawal)).status, 'withdrawn');
  await denied('withdrawTripChanges', driver, { ...withdrawal, requestId: randomUUID() }, 'ALREADY_EXISTS');
  assert.equal((await document('trips', tripId)).pendingChangeId, undefined); await preview(tripId);
  assert.deepEqual(clean(await document('trips', tripId)), clean(before));
  const edges = await checkTripChangeEdges({ driver, parent, second, outsider, create, book, preview, proposal, vote, clean });
  return { method: 'authenticated-local-callables-with-independent-persisted-checks', tripId, proposalId: change.proposalId,
    parentCount: saved.parentUserIds.length, bookingCount: saved.bookingIds.length, acceptedParentCount: Object.keys(saved.decisions).length,
    confirmedStatus: saved.status, originalTerms: saved.originalTerms, proposedTerms: saved.terms,
    finalStatus: (await document('tripChanges', change.proposalId)).status, confirmationNotificationCount: notes.size,
    originalTripAndBookingsPreserved: true, repeatedRequestsIdempotent: true, parentViewsScoped: true,
    pendingBookingApprovalPaymentAndStartDenied: true, edges,
    syntheticPaymentMetadata: true, nativeUi: false, applicationExercised: false,
    livePayment: false, refundIssued: false, productionDeployed: false };
}
