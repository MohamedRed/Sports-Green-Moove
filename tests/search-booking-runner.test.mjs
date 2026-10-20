import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { assertSearchBookingCheckpoint, openSearchBookingCheckpoints } from '../scripts/qa/search-booking-checkpoint.mjs';
import { assertSearchBookingEvidence, searchBookingCaptures } from '../scripts/qa/search-booking-evidence.mjs';
import { verifySearchBookingIsolation } from '../scripts/qa/search-booking-records.mjs';
import { focusedCases, requireFocusedDeviceApproval, preparePinnedApks } from '../scripts/qa/preinstalled-disposable-apks.mjs';
import { restoreContinuousDevice } from '../scripts/qa/continuous-disposable-device.mjs';
import { continuousFixture } from './fixtures/continuous-disposable-device.mjs';
import { searchMapsPolicy, searchOperations } from '../scripts/qa/search-maps-policy.mjs';

const runId = 'a'.repeat(32), tripId = 'unit-trip', bookingId = 'unit-booking';
const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
function state(phase) {
  return { booking: { tripId, parentUserId: 'sgm-qa-parent', requesterUserId: 'sgm-qa-parent', driverUserId: 'sgm-qa-driver',
    childId: 'sgm-qa-child-lina', seats: 2, status: phase, ...(phase === 'requested' ? {} : { approvedAt: 'unit-time' }),
    ...(phase === 'cancelled' ? { cancelledAt: 'unit-time', cancelledByUserId: 'sgm-qa-parent', refundStatus: 'notRequired' } : {}) },
  trip: { driverUserId: 'sgm-qa-driver', priceCents: 0, seatsTotal: 4, seatsAvailable: phase === 'approved' ? 2 : 4, status: 'published' },
  receipts: [{ uid: 'sgm-qa-parent', state: 'committed', response: { bookingId, status: 'requested',
    trip: { bookingIntent: { terms: { priceCents: 0 } } } } }],
  notifications: phase === 'requested' ? [] : [{ type: 'bookingApproved', userId: 'sgm-qa-parent' },
    ...(phase === 'cancelled' ? [{ type: 'bookingCancelled', userId: 'sgm-qa-driver' }] : [])] };
}

test('independent checkpoints require exact ownership, two seats, committed free terms and nonduplicated notices', () => {
  const identity = { tripId, bookingId };
  for (const phase of ['requested', 'approved', 'cancelled']) {
    assertSearchBookingCheckpoint(phase, state(phase), identity);
    for (const mutate of [s => { s.booking.childId = 'foreign'; }, s => { s.booking.seats = 1; },
      s => { s.trip.seatsAvailable = 3; }, s => { s.receipts[0].response.bookingId = 'foreign'; },
      s => { s.receipts[0].response.trip.bookingIntent.terms.priceCents = 500; }, s => { s.notifications.push({}); },
      s => { s.booking.paymentIntentId = 'forbidden'; }]) {
      const value = state(phase); mutate(value); assert.throws(() => assertSearchBookingCheckpoint(phase, value, identity));
    }
  }
});

test('checkpoint HTTP server reads each UI stage once, in order, and rejects foreign accounts/runs', async () => {
  let reads = 0;
  const server = await openSearchBookingCheckpoints({ runId, tripId, readState: async id => {
    assert.equal(id, bookingId); return state(['requested', 'approved', 'cancelled'][reads++]);
  } });
  const send = (phase, extra = {}, token = server.token) => fetch(`http://127.0.0.1:${server.port}/checkpoint`, {
    method: 'POST', headers: { authorization: `Bearer ${token}` }, body: JSON.stringify({ phase, runId, tripId, bookingId, ...extra }) });
  try {
    assert.equal((await send('requested', {}, 'foreign')).status, 409);
    assert.equal((await send('approved')).status, 409);
    assert.equal((await send('requested', { runId: 'foreign' })).status, 409);
    assert.equal(reads, 0);
    for (const phase of ['requested', 'approved', 'cancelled']) assert.equal((await send(phase)).status, 200);
    assert.equal((await send('cancelled')).status, 409); assert.equal(reads, 3);
    assert.equal(server.receipts().length, 3); assert(!JSON.stringify(server.receipts()).includes(server.token));
  } finally { await server.close(); }
});

function evidence() {
  const capture = Buffer.alloc(2048); Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(capture);
  const native = { scope: 'local-parent-search-two-seat-booking-not-physical-or-payment', runId, tripId, bookingId,
    projectId: 'demo-sgm-local-qa', requestedSeats: 2, childId: 'sgm-qa-child-lina', capacitySequence: [4, 4, 2, 2, 4],
    parentRequestedInApp: true, driverApprovedInApp: true, parentCancelledInApp: true, parentSignedOut: true,
    firestoreClientTerminated: true, completed: true, physicalDevice: false, paymentExercised: false,
    screenshots: Object.fromEntries(searchBookingCaptures.map(name => [name, createHash('sha256').update(capture).digest('hex')])),
    selectedPlaceIds: ['place1', 'place2'] };
  const checkpoints = ['requested', 'approved', 'cancelled'].map(phase => ({ phase, runId, tripId, bookingId, state: state(phase) }));
  const provider = { policy: searchMapsPolicy, approvedRequestLimit: 8, stopped: false,
    requests: searchOperations.map(operation => ({ operation, status: 200, completed: true })),
    facts: searchOperations.map((operation, index) => ({ operation,
      ...(operation === 'place-details' ? { placeId: index === 1 ? 'place1' : 'place2' } : {}),
      ...(operation === 'route-matrix' ? { elements: Array(9).fill({}) } : {}) })) };
  return { native, checkpoints, provider, runId, tripId, readCapture: () => capture };
}

test('evidence joins original capture hashes, actual provider calls and all three saved stages', () => {
  assert.equal(assertSearchBookingEvidence(evidence()).actualProviderRequests, 6);
  for (const mutate of [e => { e.native.driverApprovedInApp = false; }, e => { e.native.selectedPlaceIds.reverse(); },
    e => { e.native.physicalDevice = true; }, e => { e.checkpoints.pop(); },
    e => { e.checkpoints[1].state.trip.seatsAvailable = 4; }, e => { e.provider.requests.push(e.provider.requests[0]); },
    e => { e.provider.requests[4].completed = false; }, e => { e.provider.stopped = true; },
    e => { e.native.screenshots[searchBookingCaptures[0]] = '0'.repeat(64); }]) {
    const value = evidence(); mutate(value); assert.throws(() => assertSearchBookingEvidence(value));
  }
});

test('record isolation accepts only the same owned booking, receipt, two notices and trip timestamp', () => {
  const before = { claims: [{ uid: 'parent' }], liveTrips: null,
    documents: { trips: [{ id: tripId, data: { seatsAvailable: 4, updatedAt: 1 } }], users: [{ id: 'foreign', data: { label: 'untouched' } }] } };
  const after = structuredClone(before); after.documents.trips[0].data.updatedAt = 2;
  Object.assign(after.documents, { bookings: [{ id: bookingId, data: { tripId, status: 'cancelled' } }],
    bookingRequestReceipts: [{ id: 'receipt', data: { response: { bookingId } } }],
    notifications: ['approved', 'cancelled'].map(id => ({ id, data: { sourceId: bookingId } })) });
  assert.equal(verifySearchBookingIsolation(before, after, { tripId, bookingId }).ownNewBookings, 1);
  for (const mutate of [s => { s.claims.push({ uid: 'foreign' }); }, s => { s.documents.users[0].data.label = 'changed'; },
    s => { s.documents.trips[0].data.seatsAvailable = 2; }, s => { s.liveTrips = { active: true }; },
    s => { s.documents.bookings.push({ id: 'other', data: { tripId: 'foreign' } }); }]) {
    const changed = structuredClone(after); mutate(changed);
    assert.throws(() => verifySearchBookingIsolation(before, changed, { tripId, bookingId }));
  }
});

test('the paid manual case cannot enter the automatic six-case matrix or use legacy installs', t => {
  assert.equal(focusedCases.length, 6); assert(!focusedCases.includes('parent-search-booking'));
  const f = continuousFixture(t); f.env.SGM_FOCUSED_UI_CASE = 'parent-search-booking';
  assert.throws(() => requireFocusedDeviceApproval(f.env));
  f.env.SGM_SEARCH_BOOKING_APPROVAL = 'one-trial-max-eight-requests';
  const receipt = f.prepareAndSave();
  const pinned = preparePinnedApks({ android: f.android, serial: f.device.serial, env: f.env, device: f.device });
  assert.equal(pinned.case, 'parent-search-booking'); assert.equal(pinned.installationsRemainedBlocked, true);
  assert.equal(restoreContinuousDevice(f.device, receipt, f.execute, f.deps).verified, true);
});

test('manual workflow isolates credentials, forbids paid reruns and requires cleanup and uploaded originals', () => {
  const workflow = read('.github/workflows/native-search-booking-ui.yml');
  assert(workflow.includes('workflow_call:')); assert(!workflow.includes('workflow_dispatch:'));
  assert(workflow.includes('test "$GITHUB_RUN_ATTEMPT" = 1'));
  assert(workflow.indexOf('assembleDebug') < workflow.indexOf('secrets.GOOGLE_MAPS_API_KEY'));
  assert(!workflow.includes('SGM_GOOGLE_MAPS_ANDROID_API_KEY')); assert(!workflow.includes('continue-on-error'));
  assert(workflow.includes('always()')); assert(workflow.includes('parent-search-booking-evidence/**'));
  const shell = read('scripts/run-search-booking-android-ui.sh'); assert(shell.includes('trap restore_test_device EXIT'));
  const runner = read('scripts/qa/run-search-booking-ui.mjs');
  assert(runner.includes('emulatorEntryArguments')); assert(runner.includes('spawn(process.execPath'));
  assert(runner.indexOf("'search-booking-results.json'") > runner.indexOf('runtime.cleanup()'));
  const host = read('scripts/qa/local-search-booking-ui.mjs');
  for (const direct of ["call('requestBooking'", "call('approveBooking'", "call('cancelBooking'"])
    assert(!host.includes(direct));
  for (const name of ['native-ci.yml', 'web-integration-smoke.yml']) {
    const config = read('.github/workflows/' + name);
    assert(config.includes('tests/search-booking-runner.test.mjs'));
  }
});
