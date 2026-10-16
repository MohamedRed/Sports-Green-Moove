import assert from 'node:assert/strict';
import { call, db, document, signIn, tripInput } from './local-flow-client.mjs';
import { configureLocalEmulators } from './local-emulator-config.mjs';

export async function checkTripDetailsOwnership() {
  const { projectId } = configureLocalEmulators();
  const driver = await signIn('d@example.test'), parent = await signIn('p@example.test');
  const { tripId } = await call('createTrip', driver, { ...tripInput(), title: 'Trip details boundary QA', priceCents: 250 });
  const { bookingId } = await call('requestBooking', parent, { tripId, childId: 'sgm-qa-child-lina', seats: 2 });
  await call('approveBooking', driver, { bookingId });
  // Local fixture metadata only; no provider payment is created.
  await db.collection('bookings').doc(bookingId).update({ paymentStatus: 'paid' });
  const original = await document('trips', tripId), originalBooking = await document('bookings', bookingId);
  const origin = `http://${process.env.FIRESTORE_EMULATOR_HOST}/v1/projects/${projectId}/databases/(default)/documents`;
  const resource = `projects/${projectId}/databases/(default)/documents/trips/${tripId}`;
  async function write(actor, fields, mask = Object.keys(fields), commit = false) {
    const url = new URL(`${origin}/trips/${tripId}`);
    for (const field of mask) url.searchParams.append('updateMask.fieldPaths', field);
    const response = await fetch(commit ? origin + ':commit' : url, { method: commit ? 'POST' : 'PATCH',
      redirect: 'error', signal: AbortSignal.timeout(10_000), headers: { 'content-type': 'application/json',
        ...(actor ? { authorization: `Bearer ${actor.token}` } : {}) }, body: JSON.stringify(commit
        ? { writes: [{ update: { name: resource, fields }, updateMask: { fieldPaths: mask } }] } : { fields }) });
    return { status: response.status, body: await response.json() };
  }
  const attempts = [];
  async function denied(actor, fields, mask, kind, commit = false) {
    const response = await write(actor, fields, mask, commit);
    assert.equal(response.status, 403, `${kind} must be denied`);
    assert.equal(response.body.error?.status, 'PERMISSION_DENIED');
    assert.deepEqual(await document('trips', tripId), original, 'Denied changes must preserve the entire trip');
    assert.deepEqual(await document('bookings', bookingId), originalBooking, 'The paid booking must remain unchanged');
    attempts.push({ kind, status: response.status, tripUnchanged: true, bookingUnchanged: true });
  }
  const bundledTitlePrice = { title: { stringValue: 'Must not change' }, priceCents: { integerValue: '9000' } };
  const changes = [
    ['driver-price-change', { priceCents: { integerValue: '9000' } }],
    ['driver-origin-change', { origin: { mapValue: { fields: { lat: { doubleValue: 0 }, lng: { doubleValue: 0 } } } } }],
    ['driver-destination-change', { destination: { mapValue: { fields: { lat: { doubleValue: 0 }, lng: { doubleValue: 0 } } } } }],
    ['driver-departure-change', { departureAt: { stringValue: '2099-01-01T10:00:00Z' } }],
    ['driver-team-change', { teamId: { stringValue: 'foreign-team' } }],
    ['driver-child-tracking-change', { supportsChildTracking: { booleanValue: false } }],
    ['driver-vehicle-tracking-change', { supportsVehicleTracking: { booleanValue: false } }],
    ['driver-backdated-update', { updatedAt: { timestampValue: '2000-01-01T00:00:00Z' } }],
    ['driver-future-field-injection', { pendingTripChanges: { mapValue: { fields: { approvedByParent: { booleanValue: true } } } } }],
    ['driver-bundled-title-price-change', bundledTitlePrice],
  ];
  for (const [kind, fields] of changes) await denied(driver, fields, Object.keys(fields), kind);
  for (const field of ['priceCents', 'origin', 'departureAt']) await denied(driver, {}, [field], `driver-remove-${field}`);
  await denied(driver, bundledTitlePrice, ['title', 'priceCents'], 'driver-atomic-commit-price-change', true);
  const deniedOwnerMutations = attempts.length;
  for (const actor of [parent, await signIn('outsider@example.test'), null]) {
    await denied(actor, { title: { stringValue: 'Foreign title' } }, ['title'], actor ? 'foreign-title-change' : 'signed-out-title-change');
  }
  const title = 'Trip details cosmetic title QA';
  assert.equal((await write(driver, { title: { stringValue: title } })).status, 200);
  const saved = await document('trips', tripId);
  assert.deepEqual(saved, { ...original, title });
  assert.deepEqual(await document('bookings', bookingId), originalBooking);
  return { method: 'authenticated-local-firestore-rest-with-independent-persisted-checks', tripId, bookingId,
    deniedOwnerMutations, deniedOtherActors: attempts.length - deniedOwnerMutations, attempts, titleEditAllowed: true,
    savedTrip: { title: saved.title, status: saved.status, priceCents: saved.priceCents,
      origin: saved.origin, destination: saved.destination, departureAt: saved.departureAt,
      teamId: saved.teamId, supportsChildTracking: saved.supportsChildTracking, supportsVehicleTracking: saved.supportsVehicleTracking,
      seatsAvailable: saved.seatsAvailable, seatsTotal: saved.seatsTotal },
    savedBooking: { status: originalBooking.status, paymentStatus: originalBooking.paymentStatus, seats: originalBooking.seats },
    syntheticPaymentMetadata: true, nativeUi: false, operationalEditingImplemented: false,
    reconfirmationPolicyApproved: false, livePayment: false, productionDeployed: false };
}
