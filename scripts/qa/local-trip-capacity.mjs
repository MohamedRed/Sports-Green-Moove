import assert from 'node:assert/strict';
import { call, denied, document, signIn, tripInput } from './local-flow-client.mjs';
import { configureLocalEmulators } from './local-emulator-config.mjs';

export async function checkTripCapacityOwnership() {
  const { projectId } = configureLocalEmulators();
  const parent = await signIn('p@example.test');
  const driver = await signIn('d@example.test');
  const outsider = await signIn('outsider@example.test');
  const { tripId } = await call('createTrip', driver, { ...tripInput(), title: 'Seat integrity QA' });
  const { bookingId } = await call('requestBooking', parent, { tripId, childId: 'sgm-qa-child-lina', seats: 2 });
  await call('approveBooking', driver, { bookingId });
  assert.equal((await document('trips', tripId)).seatsAvailable, 2);
  const base = `http://${process.env.FIRESTORE_EMULATOR_HOST}/v1/projects/${projectId}/databases/(default)/documents/trips/${tripId}`;
  async function patch(actor, fields, mask = Object.keys(fields)) {
    const url = new URL(base);
    for (const field of mask) url.searchParams.append('updateMask.fieldPaths', field);
    const response = await fetch(url, { method: 'PATCH', headers: { 'content-type': 'application/json',
      ...(actor ? { authorization: `Bearer ${actor.token}` } : {}) }, body: JSON.stringify({ fields }) });
    return { status: response.status, body: await response.json() };
  }
  const attempts = [
    [{ seatsAvailable: { integerValue: '4' } }, ['seatsAvailable']],
    [{ seatsTotal: { integerValue: '8' } }, ['seatsTotal']],
    [{ seatsAvailable: { integerValue: '8' }, seatsTotal: { integerValue: '8' } }, ['seatsAvailable', 'seatsTotal']],
    [{}, ['seatsAvailable']], [{}, ['seatsTotal']],
    [{ seatsAvailable: { stringValue: '4' } }, ['seatsAvailable']],
    [{ title: { stringValue: 'Must not change' }, seatsAvailable: { integerValue: '4' } }, ['title', 'seatsAvailable']],
  ];
  for (const [fields, mask] of attempts) {
    const result = await patch(driver, fields, mask);
    assert.equal(result.status, 403, `Direct driver mutation of ${mask.join(', ')} must be denied`);
    assert.equal(result.body.error?.status, 'PERMISSION_DENIED');
  }
  for (const actor of [parent, outsider, null]) {
    const result = await patch(actor, { seatsAvailable: { integerValue: '4' } });
    assert.equal(result.status, 403); assert.equal(result.body.error?.status, 'PERMISSION_DENIED');
  }
  const title = 'Seat integrity title update QA';
  assert.equal((await patch(driver, { title: { stringValue: title } })).status, 200);
  const held = await document('trips', tripId);
  assert.equal(held.title, title); assert.equal(held.seatsAvailable, 2); assert.equal(held.seatsTotal, 4);
  assert.equal((await document('bookings', bookingId)).status, 'approved');
  await call('cancelBooking', parent, { bookingId });
  await denied('cancelBooking', parent, { bookingId }, 'FAILED_PRECONDITION');
  const released = await document('trips', tripId);
  assert.equal(released.seatsAvailable, 4); assert.equal(released.seatsTotal, 4);
  return { requestedSeats: 2, seatsAfterApproval: 2, rejectedOwnerMutations: attempts.length,
    rejectedOtherActors: 3, titleEditAllowed: true, seatsAfterCancellation: 4,
    repeatedCancellationRejected: true, method: 'authenticated-local-firestore-and-callable-with-persisted-checks',
    livePayment: false, nativeUi: false };
}
