import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { db, call, denied, tripInput, viewedBooking } from './local-flow-client.mjs';

export async function checkBookingRequestRaces(parent, driver) {
  const outcomes = [];
  const create = async () => (await call('createTrip', driver, { ...tripInput(), title: 'QA request identity race' })).tripId;
  const count = async (tripId) => (await db.collection('bookings').where('tripId', '==', tripId).get()).size;
  {
    const tripId = await create(), input = await viewedBooking(parent, { tripId, seats: 2 });
    const replies = await Promise.all([call('requestBooking', parent, input), call('requestBooking', parent, input)]);
    assert.equal(replies[0].bookingId, replies[1].bookingId); assert.equal(await count(tripId), 1);
    assert.deepEqual(replies.map((reply) => reply.reused).sort(), [false, true]);
    outcomes.push({ id: 'concurrent-identical-retry', bookingCount: 1, sameBookingId: true });
  }
  {
    const tripId = await create(), input = await viewedBooking(parent, { tripId, seats: 1 });
    const replies = await Promise.allSettled([call('requestBooking', parent, input), call('requestBooking', parent, { ...input, seats: 2 })]);
    assert.equal(replies.filter((reply) => reply.status === 'fulfilled').length, 1);
    assert.equal(replies.find((reply) => reply.status === 'rejected').reason.code, 'ALREADY_EXISTS');
    assert.equal(await count(tripId), 1);
    outcomes.push({ id: 'concurrent-conflicting-payload', bookingCount: 1, conflictRejected: true });
  }
  {
    const tripId = await create(), input = await viewedBooking(parent, { tripId, seats: 1 });
    const resolved = await call('resolveBookingRequest', parent, { clientRequestId: input.clientRequestId, requesterUserId: parent.uid });
    assert.equal(resolved.state, 'abandoned');
    await denied('requestBooking', parent, input, 'FAILED_PRECONDITION');
    assert.equal(await count(tripId), 0);
    outcomes.push({ id: 'abandonment-fences-a-late-send', bookingCount: 0, lateSendRejected: true });
  }
  {
    const tripId = await create(), input = await viewedBooking(parent, { tripId, seats: 1 });
    const booking = await call('requestBooking', parent, input);
    const resolved = await call('resolveBookingRequest', parent, { clientRequestId: input.clientRequestId, requesterUserId: parent.uid });
    assert.equal(resolved.state, 'committed'); assert.equal(resolved.bookingId, booking.bookingId);
    assert.equal((await db.collection('bookings').doc(booking.bookingId).get()).get('status'), 'requested');
    outcomes.push({ id: 'resolution-never-cancels-a-committed-booking', bookingCount: 1, sameBookingId: true });
  }
  for (let iteration = 0; iteration < 8; iteration++) {
    const tripId = await create(), input = await viewedBooking(parent, { tripId, seats: 1 });
    const [sent, resolved] = await Promise.allSettled([call('requestBooking', parent, input),
      call('resolveBookingRequest', parent, { clientRequestId: input.clientRequestId, requesterUserId: parent.uid })]);
    assert.equal(resolved.status, 'fulfilled');
    const bookings = await count(tripId);
    if (resolved.value.state === 'committed') {
      assert.equal(sent.status, 'fulfilled'); assert.equal(sent.value.bookingId, resolved.value.bookingId); assert.equal(bookings, 1);
    } else {
      assert.equal(resolved.value.state, 'abandoned'); assert.equal(sent.status, 'rejected');
      assert.equal(sent.reason.code, 'FAILED_PRECONDITION'); assert.equal(bookings, 0);
    }
    outcomes.push({ id: `send-resolution-race-${iteration + 1}`, state: resolved.value.state, bookingCount: bookings, consistent: true });
  }
  {
    const tripId = await create(), input = await viewedBooking(parent, { tripId, seats: 1 });
    await denied('requestBooking', parent, { ...input, requesterUserId: driver.uid }, 'PERMISSION_DENIED');
    await denied('resolveBookingRequest', parent, { clientRequestId: input.clientRequestId, requesterUserId: driver.uid }, 'PERMISSION_DENIED');
    for (const clientRequestId of [undefined, 'not-a-uuid'])
      await denied('requestBooking', parent, { ...input, clientRequestId }, 'INVALID_ARGUMENT');
    assert.equal(await count(tripId), 0);
    await denied('requestBooking', null, { ...input, clientRequestId: randomUUID() }, 'UNAUTHENTICATED');
    outcomes.push({ id: 'account-and-request-identity-boundary', bookingCount: 0, accountMismatchRejected: true });
  }
  return { scope: 'isolated-service-request-identity-races-not-native-ui', passed: true, outcomes };
}
