import assert from 'node:assert/strict';

export async function seedChatNetworkHistory(client, env = process.env) {
  assert.equal(env.SGM_LOCAL_DISPOSABLE_EMULATOR, 'true');
  for (const key of ['GCLOUD_PROJECT', 'FIREBASE_PROJECT_ID']) assert.equal(env[key], 'demo-sgm-local-qa');
  const parent = await client.signIn('p@example.test'), driver = await client.signIn('d@example.test');
  assert.equal(parent.uid, 'sgm-qa-parent'); assert.equal(driver.uid, 'sgm-qa-driver');
  const bookings = [];
  for (const status of ['declined', 'cancelled']) {
    const { tripId } = await client.call('createTrip', driver, {
      ...client.tripInput(), title: `Isolated network picker ${status} QA`,
    });
    const { bookingId } = await client.call('requestBooking', parent,
      await client.viewedBooking(parent, { tripId, childId: 'sgm-qa-child-lina', seats: 1 }));
    await client.call(status === 'declined' ? 'declineBooking' : 'cancelBooking',
      status === 'declined' ? driver : parent, { bookingId });
    const booking = await client.document('bookings', bookingId);
    assert.equal(booking.status, status); assert.equal(booking.parentUserId, parent.uid);
    assert.equal(booking.driverUserId, driver.uid); assert.equal(booking.childId, 'sgm-qa-child-lina');
    assert.equal(booking.seats, 1); assert.equal((await client.document('trips', tripId)).seatsAvailable, 4);
    bookings.push({ tripId, bookingId, status });
  }
  return { method: 'isolated-callable-fixture-not-ui-verification', bookings };
}
