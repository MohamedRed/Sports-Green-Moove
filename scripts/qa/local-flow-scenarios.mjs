import assert from 'node:assert/strict';
import { auth, db, signIn, call, denied, document, tripInput } from './local-flow-client.mjs';

export async function runScenarios(check, lifecycle) {
  const parent = await signIn('p@example.test');
  const driver = await signIn('d@example.test');
  await auth.createUser({ uid: 'sgm-qa-outsider', email: 'outsider@example.test',
    password: process.env.SGM_QA_PASSWORD, displayName: 'Local QA outsider' });
  await auth.setCustomUserClaims('sgm-qa-outsider', { roleKeys: ['parent'] });
  const outsider = await signIn('outsider@example.test');
  await call('initializeUserProfile', outsider);
  let tripId;
  await check('publication', async () => {
    const input = tripInput();
    await denied('createTrip', parent, input, 'PERMISSION_DENIED');
    const trip = await call('createTrip', driver, input);
    tripId = trip.tripId;
    assert(tripId);
    assert.equal((await document('trips', tripId)).status, 'published');
    const listing = await call('listTrips', parent);
    assert(JSON.stringify(listing).includes(tripId), 'Published trip must appear in parent list');
    await denied('createTrip', driver, { ...input, seatsAvailable: 5 }, 'INVALID_ARGUMENT');
    await denied('listTrips', null, {}, 'UNAUTHENTICATED');
  });
  await check('booking-cancellation', async () => {
    assert(tripId, 'Publication must pass first');
    const booking = await call('requestBooking', parent, { tripId, childId: 'sgm-qa-child-lina', seats: 1 });
    const id = booking.bookingId;
    assert.equal((await document('trips', tripId)).seatsAvailable, 4);
    await denied('approveBooking', parent, { bookingId: id }, 'PERMISSION_DENIED');
    await denied('cancelBooking', outsider, { bookingId: id }, 'PERMISSION_DENIED');
    await call('approveBooking', driver, { bookingId: id });
    assert.equal((await document('trips', tripId)).seatsAvailable, 3);
    await denied('approveBooking', driver, { bookingId: id }, 'FAILED_PRECONDITION');
    await call('cancelBooking', parent, { bookingId: id, reason: 'Local QA cancellation' });
    assert.equal((await document('bookings', id)).status, 'cancelled');
    assert.equal((await document('trips', tripId)).seatsAvailable, 4);
    await denied('cancelBooking', parent, { bookingId: id }, 'FAILED_PRECONDITION');
    assert.equal((await document('trips', tripId)).seatsAvailable, 4);
    const pending = await call('requestBooking', parent, { tripId, seats: 1 });
    await call('cancelBooking', driver, { bookingId: pending.bookingId });
    assert.equal((await document('trips', tripId)).seatsAvailable, 4);
    await denied('requestBooking', outsider, { tripId, childId: 'sgm-qa-child-lina', seats: 1 }, 'PERMISSION_DENIED');
    await denied('requestBooking', driver, { tripId, seats: 1 }, 'FAILED_PRECONDITION');
  });
  await check('last-seat-concurrency', async () => {
    const { tripId: id } = await call('createTrip', driver, { ...tripInput(), seatsTotal: 1, seatsAvailable: 1 });
    const first = await call('requestBooking', parent, { tripId: id, seats: 1 });
    const second = await call('requestBooking', outsider, { tripId: id, seats: 1 });
    const results = await Promise.allSettled([first, second].map((b) => call('approveBooking', driver, { bookingId: b.bookingId })));
    assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
    const rejection = results.find((r) => r.status === 'rejected');
    assert.equal(rejection?.reason.code, 'FAILED_PRECONDITION');
    assert.equal((await document('trips', id)).seatsAvailable, 0);
    await denied('requestBooking', parent, { tripId: id, seats: 1 }, 'FAILED_PRECONDITION');
  });
  await check('messages-notifications', async () => {
    const bookingId = lifecycle.bookingId;
    const outbound = await call('sendChatMessage', parent, { bookingId, body: 'Local parent confirmation' });
    const reply = await call('sendChatMessage', driver, { bookingId, body: 'Local driver reply' });
    for (const message of [outbound, reply]) {
      const stored = await document('messages', message.messageId);
      assert(stored.participantUserIds.includes(parent.uid));
      assert(stored.participantUserIds.includes(driver.uid));
    }
    for (const actor of [parent, driver]) {
      const { inbox } = await call('getInbox', actor);
      const conversation = inbox.chats.find((chat) => chat.sourceId === bookingId);
      assert.equal(conversation?.preview, 'Local driver reply');
      assert(conversation.unreadCount > 0);
      const expectedBody = actor.uid === parent.uid ? 'Local driver reply' : 'Local parent confirmation';
      assert(inbox.notifications.some((note) => note.body === expectedBody), 'Recipient inbox must expose the other participant message');
      const notes = await db.collection('notifications').where('userId', '==', actor.uid).where('type', '==', 'chatMessage').get();
      assert(notes.docs.some((d) => d.data().sourceId === bookingId), 'Recipient must receive a stored notification');
    }
    await denied('sendChatMessage', outsider, { bookingId, body: 'Unauthorized local attempt' }, 'PERMISSION_DENIED');
    await denied('sendChatMessage', parent, { bookingId, body: ' ' }, 'INVALID_ARGUMENT');
    const foreignInbox = await call('getInbox', outsider);
    assert.equal(foreignInbox.inbox.chats.length, 0);
  });
  await check('ride-audit-ledgers', async () => {
    const { rideSessionId, bookingId } = lifecycle;
    const ride = await document('rideSessions', rideSessionId);
    assert.equal(ride.status, 'completed');
    const audits = await db.collection('rideSessions').doc(rideSessionId).collection('auditEvents').get();
    assert.equal(audits.size, 2);
    for (const collection of ['co2Ledger', 'rewardLedger']) {
      const entries = await db.collection(collection).where('rideSessionId', '==', rideSessionId).get();
      assert.equal(entries.size, 1, `${collection}: one completion entry required`);
    }
    await denied('endRide', driver, { rideSessionId, distanceMeters: 28600, passengersSharing: 2 }, 'FAILED_PRECONDITION');
    await denied('markPickup', driver, { rideSessionId, bookingId, childId: 'sgm-qa-child-lina' }, 'FAILED_PRECONDITION');
    const closed = await call('getActiveRide', parent);
    assert.equal(closed.ride, null);
  });
  await check('ratings', async () => {
    const input = { rideSessionId: lifecycle.rideSessionId, ratedUserId: driver.uid, score: 5, comment: 'Local QA review' };
    await denied('submitRating', outsider, input, 'PERMISSION_DENIED');
    const rating = await call('submitRating', parent, input);
    assert.equal((await document('ratings', rating.ratingId)).score, 5);
    await denied('submitRating', parent, input, 'ALREADY_EXISTS');
    const inbox = await call('getInbox', parent);
    assert(!JSON.stringify(inbox.inbox.reviews).includes(lifecycle.rideSessionId));
  });
  await check('club-request', async () => {
    const clubId = 'sgm-qa-club-green-wavre';
    const first = await call('requestClubMembership', outsider, { clubId });
    assert.equal(first.status, 'requested');
    assert.equal(first.reused, false);
    const again = await call('requestClubMembership', outsider, { clubId });
    assert.equal(again.membershipId, first.membershipId);
    assert.equal(again.reused, true);
    assert.equal((await document('memberships', first.membershipId)).status, 'requested');
    await denied('requestClubMembership', outsider, { clubId: 'sgm-qa-missing-club' }, 'NOT_FOUND');
  });
  await check('support-request', async () => {
    const report = await call('createReport', parent, { subjectType: 'other', reason: 'Local QA', description: 'Isolated local support request' });
    assert.equal(report.status, 'open');
    const stored = await document('reports', report.reportId);
    assert.equal(stored.reporterUserId, parent.uid);
    assert.equal(stored.status, 'open');
    await denied('reviewReport', parent, { reportId: report.reportId, status: 'resolved' }, 'PERMISSION_DENIED');
    await denied('createReport', parent, { subjectType: 'other', reason: 'QA', description: '' }, 'INVALID_ARGUMENT');
  });
}
