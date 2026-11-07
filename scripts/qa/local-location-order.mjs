import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { deleteApp, getApp } from 'firebase-admin/app';
import { getDatabase } from 'firebase-admin/database';
import { call, denied, signIn, tripInput, viewedBooking } from './local-flow-client.mjs';

const checks = [];
const clockObservations = [];
const record = (id) => checks.push({ id, status: 'passed' });
let observed;
async function runChecks() {
  execFileSync(process.execPath, [resolve(import.meta.dirname, 'seed-firebase-emulator.mjs')],
    { env: process.env, stdio: ['ignore', 'pipe', 'pipe'], timeout: 90_000 });
  const driver = await signIn('d@example.test'), parent = await signIn('p@example.test');
  const { tripId } = await call('createTrip', driver, tripInput());
  const { bookingId } = await call('requestBooking', parent, await viewedBooking(parent, {
    tripId, seats: 1, childId: 'sgm-qa-child-lina',
  }));
  await call('approveBooking', driver, { bookingId });
  const { ride } = await call('startRide', driver, { tripId, bookingIds: [bookingId] });
  const vehicle = getDatabase().ref(`liveTrips/${ride.rideSessionId}/vehicle`);
  const base = Date.now() - 30_000;
  const point = (capturedAt, lng = 4.612) => ({ rideSessionId: ride.rideSessionId, role: 'driver',
    lat: 50.715, lng, accuracyM: 8, capturedAt });
  const submit = async (updates) => {
    const before = Date.now();
    const { serverTimeMs, ...result } = await call('writeLocationBatch', driver, { updates });
    const after = Date.now();
    assert(Number.isSafeInteger(serverTimeMs) && serverTimeMs >= before && serverTimeMs <= after);
    clockObservations.push({ endpoint: 'writeLocationBatch', before, serverTimeMs, after, ...result });
    return result;
  };
  const retained = (updates) => ({ written: 0, ignored: updates.length, receipts: updates.map((update) => ({
    status: 'retained', rideSessionId: update.rideSessionId, role: update.role, capturedAt: update.capturedAt,
  })) });
  assert.equal((await submit([point(base)])).written, 1);
  const first = (await vehicle.get()).val();
  const oldResult = await submit([point(base - 90_000, 4.5)]);
  observed = { expectedCapturedAt: base, afterDelayedPoint: (await vehicle.get()).val() };
  assert.deepEqual(observed.afterDelayedPoint, first, 'A delayed upload must not replace a newer stored observation');
  assert.deepEqual(oldResult, retained([point(base - 90_000, 4.5)]));
  record('delayed-native-point-cannot-replace-newer-observation');
  assert.deepEqual(await submit([point(base, 4.4)]), retained([point(base, 4.4)]));
  assert.deepEqual((await vehicle.get()).val(), first);
  record('same-time-duplicate-does-not-change-location-or-receipt-time');

  const batches = Array.from({ length: 12 }, (_, index) => point(base + index + 1, 4.6 + index / 1000));
  await Promise.all(batches.toReversed().map((update) => submit([update])));
  const newest = (await vehicle.get()).val();
  assert.equal(newest.capturedAt, base + 12); assert.equal(newest.lng, batches.at(-1).lng);
  record('concurrent-native-requests-retain-the-greatest-observation-time');
  const readStartedAt = Date.now();
  const parentResponse = await call('getActiveRide', parent);
  const readCompletedAt = Date.now();
  assert(Number.isSafeInteger(parentResponse.serverTimeMs) && parentResponse.serverTimeMs >= readStartedAt && parentResponse.serverTimeMs <= readCompletedAt);
  const parentView = parentResponse.ride;
  clockObservations.push({ endpoint: 'getActiveRide', before: readStartedAt, after: readCompletedAt,
    serverTimeMs: parentResponse.serverTimeMs, rideSessionId: parentView.rideSessionId });
  assert.equal(parentView.rideSessionId, ride.rideSessionId); assert.equal(parentView.stale, false);
  assert.match(parentView.vehicleLastUpdateLabel, /^Secours GPS · il y a \d+ s$/);
  record('participant-parent-still-receives-the-current-observation-age');
  await denied('writeLocationBatch', parent, { updates: [point(base + 20)] }, 'PERMISSION_DENIED');
  assert.deepEqual((await vehicle.get()).val(), newest);
  record('unauthorized-parent-write-remains-denied-without-changing-location');

  const { writeLiveLocation } = await import('../../functions/lib/lib/liveTrips.js');
  const serverPoint = (capturedAt, source, userId = driver.uid, role = 'driver') =>
    ({ ...point(capturedAt), userId, role, source, uploadedAt: Date.now() });
  assert.equal(await writeLiveLocation(serverPoint(base + 11, 'radar')), false);
  assert.deepEqual((await vehicle.get()).val(), newest);
  assert.equal(await writeLiveLocation(serverPoint(base + 100, 'radar')), true);
  const radar = (await vehicle.get()).val();
  assert.equal(radar.capturedAt, base + 100); assert.equal(radar.source, 'radar');
  assert.deepEqual(await submit([point(base + 99)]), retained([point(base + 99)]));
  assert.deepEqual((await vehicle.get()).val(), radar);
  record('native-and-webhook-writer-share-one-monotonic-register');

  const { reconcileRadarEvent } = await import('../../functions/lib/services/radarReconciliation.js');
  const { firestore } = await import('../../functions/lib/lib/firestore.js');
  const delayedEvent = { _id: 'qa-delayed-position-event', type: 'user.updated_trip',
    user: { userId: driver.uid }, trip: { externalId: ride.rideSessionId },
    createdAt: new Date(base + 99).toISOString(), location: { latitude: 50.71, longitude: 4.5, accuracy: 8 } };
  assert.deepEqual(await reconcileRadarEvent({ event: delayedEvent }), { locationWritten: false, signalWritten: true });
  const audit = await firestore.doc(`rideSessions/${ride.rideSessionId}/auditEvents/${delayedEvent._id}`).get();
  assert.equal(audit.data().capturedAt.toMillis(), base + 99); assert.equal(audit.data().source, 'radar');
  assert.deepEqual((await vehicle.get()).val(), radar);
  record('delayed-provider-event-retains-audit-without-rewinding-location');

  const children = getDatabase().ref(`liveTrips/${ride.rideSessionId}/children`);
  await Promise.all([writeLiveLocation(serverPoint(base + 100, 'radar', 'qa-device-a', 'child')),
    writeLiveLocation(serverPoint(base, 'nativeFallback', 'qa-device-b', 'child'))]);
  assert.equal(await writeLiveLocation(serverPoint(base - 1, 'radar', 'qa-device-a', 'child')), false);
  const childPoints = (await children.get()).val();
  assert.equal(childPoints['qa-device-a'].capturedAt, base + 100);
  assert.equal(childPoints['qa-device-b'].capturedAt, base);
  assert.deepEqual((await vehicle.get()).val(), radar);
  record('each-child-register-and-vehicle-register-are-independent');

  for (const capturedAt of [0, -1, 1.5, Date.now() + 86_400_000]) {
    assert.equal(await writeLiveLocation(serverPoint(capturedAt, 'radar')), false);
  }
  assert.deepEqual((await vehicle.get()).val(), radar);
  record('invalid-or-future-provider-times-cannot-poison-current-register');
  const future = point(Date.now() + 86_400_000);
  assert.deepEqual(await submit([future]), { written: 0, ignored: 1,
    receipts: [{ status: 'invalid', rideSessionId: future.rideSessionId, role: 'driver', capturedAt: future.capturedAt }] });
  await denied('getActiveRide', null, { rideSessionId: ride.rideSessionId }, 'UNAUTHENTICATED');
  await denied('writeLocationBatch', null, { updates: [point(base)] }, 'UNAUTHENTICATED');
  for (const serverTimeMs of [0, Date.now() + 86_400_000]) {
    await denied('getActiveRide', driver, { rideSessionId: ride.rideSessionId, serverTimeMs }, 'INVALID_ARGUMENT');
    await denied('writeLocationBatch', driver, { updates: [point(base)], serverTimeMs }, 'INVALID_ARGUMENT');
  }
  assert.deepEqual((await vehicle.get()).val(), radar);
  record('authenticated-server-clock-reference-does-not-relax-native-capture-validation');
  assert.deepEqual(await submit([point(base), point(base + 1), point(base + 2)]), retained([point(base), point(base + 1), point(base + 2)]));
  assert.deepEqual((await vehicle.get()).val(), radar);
  record('older-batch-counts-only-committed-points-as-written');
  const sourcePaths = ['scripts/qa/local-location-order.mjs', 'functions/src/lib/liveTrips.ts', 'functions/src/callables/rides.ts',
    'functions/src/domain/liveLocationOrder.ts', 'functions/src/callables/locations.ts',
    'functions/src/services/radarReconciliation.ts'];
  return { projectId: 'demo-sgm-local-qa', runId: process.env.SGM_LOCAL_RUN_ID,
    testedAt: new Date().toISOString(), scope: 'local-emulated-services-not-phone-ui',
    method: 'actual-authenticated-callables-and-shared-admin-writer', checks, clockObservations,
    steps: [{ id: 'location-order', status: 'passed' }], testCount: 1,
    finalCapturedAt: radar.capturedAt, concurrentRequestCount: 12,
    nativeUiExecuted: false, physicalDevice: false, productionWrites: false, providerRequests: 0,
    providerWebhookDelivery: false, auditAcceptance: false,
    sourceFiles: Object.fromEntries(sourcePaths.map((file) => [file,
      createHash('sha256').update(readFileSync(resolve(import.meta.dirname, '../..', file))).digest('hex')])) };
}

let report;
try { report = await runChecks(); }
catch (error) {
  writeFileSync(process.env.SGM_LOCAL_FLOW_OUTPUT + '.failure.json', JSON.stringify({
    scope: 'diagnostic-failed-location-order-replay-not-acceptance', accepted: false,
    projectId: 'demo-sgm-local-qa', runId: process.env.SGM_LOCAL_RUN_ID, checks, observed,
    failure: error.message, physicalDevice: false, productionWrites: false,
  }, null, 2) + '\n', { flag: 'wx' });
  throw error;
}
finally { await deleteApp(getApp()); }
writeFileSync(process.env.SGM_LOCAL_FLOW_OUTPUT, JSON.stringify({ ...report, adminClientClosed: true }, null, 2) + '\n', { flag: 'wx' });
console.log('Eleven location-order and server-clock groups passed; no native UI, physical GPS or real webhook evidence accepted.');
