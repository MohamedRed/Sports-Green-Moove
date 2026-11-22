import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { call, db, denied, document } from './local-flow-client.mjs';

export async function checkTripChangeEdges({ driver, parent, second, outsider, create, book, preview, proposal, vote, clean }) {
  const make = async ({ child = false, twoParents = false } = {}) => {
    const tripId = await create(), bookingId = await book(tripId, parent, child);
    await call('approveBooking', driver, { bookingId });
    if (twoParents) await book(tripId, second);
    const before = await document('trips', tripId);
    const change = await call('proposeTripChanges', driver, proposal(tripId, await preview(tripId)));
    return { tripId, bookingId, change, before };
  };
  const withdraw = ({ tripId, change }) => call('withdrawTripChanges', driver, { tripId, proposalId: change.proposalId, requestId: randomUUID() });
  const declined = await make();
  assert.equal((await call('respondToTripChanges', parent, vote(declined.tripId, declined.change, 'decline'))).status, 'declined');
  const declinedTrip = await document('trips', declined.tripId), declinedBooking = await document('bookings', declined.bookingId);
  assert.equal(declinedTrip.pendingChangeId, undefined); assert.deepEqual(clean(declinedTrip), clean(declined.before));
  assert.equal(declinedBooking.status, 'approved'); assert.equal(declinedBooking.refundStatus, undefined);
  await preview(declined.tripId);

  const stale = await create(), initial = await preview(stale);
  await book(stale);
  await denied('proposeTripChanges', driver, proposal(stale, initial), 'ABORTED');
  assert.equal((await document('trips', stale)).pendingChangeId, undefined);
  const cancelledBooking = await make();
  await call('cancelBooking', parent, { bookingId: cancelledBooking.bookingId });
  assert.equal((await call('getTripChangeReview', parent, { tripId: cancelledBooking.tripId, proposalId: cancelledBooking.change.proposalId })).status, 'outdated');
  await denied('respondToTripChanges', parent, vote(cancelledBooking.tripId, cancelledBooking.change), 'FAILED_PRECONDITION');
  await withdraw(cancelledBooking);
  assert.equal((await call('getTripChangeReview', parent, { tripId: cancelledBooking.tripId, proposalId: cancelledBooking.change.proposalId })).status, 'withdrawn');

  const guardian = await make({ child: true, twoParents: true });
  await call('respondToTripChanges', parent, vote(guardian.tripId, guardian.change));
  const child = await document('children', 'sgm-qa-child-lina');
  await db.collection('children').doc('sgm-qa-child-lina').update({ guardianUserIds: [] });
  await denied('getTripChangeReview', parent, { tripId: guardian.tripId, proposalId: guardian.change.proposalId }, 'PERMISSION_DENIED');
  await denied('respondToTripChanges', second, vote(guardian.tripId, guardian.change), 'FAILED_PRECONDITION');
  assert.equal((await document('tripChanges', guardian.change.proposalId)).status, 'pending');
  await withdraw(guardian); await db.collection('children').doc('sgm-qa-child-lina').set(child);

  const paidLater = await make();
  await db.collection('bookings').doc(paidLater.bookingId).update({ paymentStatus: 'paid', amountPaidCents: 250 });
  await denied('respondToTripChanges', parent, vote(paidLater.tripId, paidLater.change), 'FAILED_PRECONDITION');
  assert.equal((await document('trips', paidLater.tripId)).priceCents, 250); await withdraw(paidLater);

  const changing = await make();
  const actions = await Promise.allSettled([call('respondToTripChanges', parent, vote(changing.tripId, changing.change)), withdraw(changing)]);
  assert.equal(actions[1].status, 'fulfilled');
  assert.equal((await document('tripChanges', changing.change.proposalId)).status, 'withdrawn');
  assert.deepEqual(clean(await document('trips', changing.tripId)), clean(changing.before));

  const raceTrip = await create(), racePreview = await preview(raceTrip);
  const race = await Promise.allSettled([call('proposeTripChanges', driver, proposal(raceTrip, racePreview)), book(raceTrip, outsider)]);
  assert.equal(race.filter((item) => item.status === 'fulfilled').length, 1);
  const racedBookings = await db.collection('bookings').where('tripId', '==', raceTrip).get();
  assert.equal(racedBookings.size, race[1].status === 'fulfilled' ? 1 : 0);
  assert.equal(Boolean((await document('trips', raceTrip)).pendingChangeId), race[0].status === 'fulfilled');
  if (race[0].status === 'fulfilled') await withdraw({ tripId: raceTrip, change: race[0].value });

  const concurrent = await create(), ready = await preview(concurrent);
  const proposals = await Promise.allSettled([call('proposeTripChanges', driver, proposal(concurrent, ready)),
    call('proposeTripChanges', driver, proposal(concurrent, ready))]);
  assert.equal(proposals.filter((item) => item.status === 'fulfilled').length, 1);
  await withdraw({ tripId: concurrent, change: proposals.find((item) => item.status === 'fulfilled').value });

  const closed = await make();
  const cancel = await call('getTripCancellation', driver, { tripId: closed.tripId });
  await call('cancelTrip', driver, { tripId: closed.tripId, expectedRevision: cancel.revision,
    reason: 'Annulation pendant proposition de modification', requestId: randomUUID() });
  assert.equal((await document('tripChanges', closed.change.proposalId)).status, 'cancelled');
  assert.equal((await document('trips', closed.tripId)).pendingChangeId, undefined);
  assert.equal((await call('getTripChangeReview', parent, { tripId: closed.tripId, proposalId: closed.change.proposalId })).status, 'cancelled');
  await denied('respondToTripChanges', parent, vote(closed.tripId, closed.change), 'FAILED_PRECONDITION');

  const active = await create(), activeBooking = await book(active);
  await call('approveBooking', driver, { bookingId: activeBooking });
  await call('startRide', driver, { tripId: active });
  await denied('getTripChangePreview', driver, { tripId: active }, 'FAILED_PRECONDITION');
  const oversized = await create(), batch = db.batch();
  for (let i = 0; i < 101; i++) batch.create(db.collection('bookings').doc(), {
    tripId: oversized, driverUserId: driver.uid, parentUserId: parent.uid, seats: 1, status: 'requested' });
  await batch.commit(); await denied('getTripChangePreview', driver, { tripId: oversized }, 'RESOURCE_EXHAUSTED');
  assert.equal((await document('trips', oversized)).pendingChangeId, undefined);

  const emptyTrip = await create(), empty = await call('proposeTripChanges', driver, proposal(emptyTrip, await preview(emptyTrip), { priceCents: 100 }));
  assert.equal(empty.status, 'confirmed'); assert.equal(empty.parentCount, 0); assert.equal(empty.acceptedParentCount, 0);
  assert.equal(empty.applied, false); assert.equal((await document('trips', emptyTrip)).priceCents, 250);
  assert.equal((await db.collection('notifications').where('proposalId', '==', empty.proposalId).get()).size, 0);
  await withdraw({ tripId: emptyTrip, change: empty });

  const corrupt = await make(), record = await document('tripChanges', corrupt.change.proposalId);
  await db.collection('tripChanges').doc(corrupt.change.proposalId).update({ terms: { ...record.terms, priceCents: 999 } });
  await denied('getTripChangeReview', parent, { tripId: corrupt.tripId, proposalId: corrupt.change.proposalId }, 'FAILED_PRECONDITION');
  await denied('respondToTripChanges', parent, vote(corrupt.tripId, corrupt.change), 'FAILED_PRECONDITION');
  assert.deepEqual(clean(await document('trips', corrupt.tripId)), clean(corrupt.before));
  await db.collection('tripChanges').doc(corrupt.change.proposalId).set(record); await withdraw(corrupt);

  const missingParent = await make({ twoParents: true }), missingRecord = await document('tripChanges', missingParent.change.proposalId);
  await db.collection('tripChanges').doc(missingParent.change.proposalId).update({ parentUserIds: [parent.uid] });
  await denied('respondToTripChanges', parent, vote(missingParent.tripId, missingParent.change), 'FAILED_PRECONDITION');
  assert.equal((await document('tripChanges', missingParent.change.proposalId)).status, 'pending');
  await db.collection('tripChanges').doc(missingParent.change.proposalId).set(missingRecord); await withdraw(missingParent);

  const orphan = await create();
  await db.collection('rideSessions').doc().set({ tripId: orphan, driverUserId: driver.uid, status: 'active' });
  await denied('getTripChangePreview', driver, { tripId: orphan }, 'FAILED_PRECONDITION');
  return { declinedWithoutCancellingBooking: true, changedReservationRejected: true, stalePreviewRejected: true,
    guardianRevocationInvalidatesPriorConsent: true, latePaymentInvalidatesProposal: true,
    acceptWithdrawRacePreservesOriginal: true, bookingProposalRaceConsistent: true, concurrentProposalWinners: 1,
    cancellationClosesProposal: true, activeRideRejected: true, oversizedProposalRejectedAtomically: true,
    emptyTripDoesNotApplyWithoutIntegration: true, corruptRevisionRejected: true, omittedParentRejected: true, orphanActiveRideRejected: true };
}
