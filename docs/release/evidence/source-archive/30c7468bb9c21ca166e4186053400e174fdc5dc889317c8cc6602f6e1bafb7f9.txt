import assert from 'node:assert/strict';
import { call, db, document, signIn, tripInput } from './local-flow-client.mjs';

export async function seedSearchBookingFixture(plan) {
  const input = { ...tripInput(), ...plan, title: 'Trajet QA recherche deux places', priceCents: 0,
    seatsTotal: 4, seatsAvailable: 4 };
  const { tripId } = await call('createTrip', await signIn('d@example.test'), input);
  const trip = await document('trips', tripId);
  assert.equal(trip.priceCents, 0); assert.equal(trip.driverVerified, true);
  const from = new Date(Date.parse(plan.departureAt) - 180 * 60_000).toISOString();
  const to = new Date(Date.parse(plan.departureAt) + 360 * 60_000).toISOString();
  const candidates = await db.collection('trips').where('status', '==', 'published')
    .where('departureAt', '>=', from).where('departureAt', '<=', to).get();
  assert.deepEqual(candidates.docs.map(row => row.id), [tripId], 'Exactly one genuine future fixture may be eligible');
  return { tripId, departureAt: plan.departureAt };
}

export async function readSearchBookingState(tripId, bookingId) {
  const bookings = await db.collection('bookings').where('tripId', '==', tripId).get();
  assert.deepEqual(bookings.docs.map(row => row.id), [bookingId]);
  const receipts = await db.collection('bookingRequestReceipts').where('response.bookingId', '==', bookingId).get();
  const notifications = await db.collection('notifications').where('sourceId', '==', bookingId).get();
  return { booking: bookings.docs[0].data(), trip: await document('trips', tripId),
    receipts: receipts.docs.map(row => row.data()), notifications: notifications.docs.map(row => row.data()) };
}
