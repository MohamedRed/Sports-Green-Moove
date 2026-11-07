import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { getDatabase } from 'firebase-admin/database';
import { getApp, deleteApp } from 'firebase-admin/app';
import { auth, db, call, denied, signIn } from './local-flow-client.mjs';
import { seedRideObservationFixture, verifyRideObservationFixture, verifyCompletedRideFixtureIsolation } from './local-ride-observation-fixture.mjs';

let report;
try {
  execFileSync(process.execPath, [resolve(import.meta.dirname, 'seed-firebase-emulator.mjs')],
    { env: process.env, stdio: ['ignore', 'pipe', 'pipe'], timeout: 90_000 });
  const fixture = await seedRideObservationFixture();
  const parent = await signIn('p@example.test'), driver = await signIn('d@example.test');
  const checks = [], record = (id) => checks.push({ id, status: 'passed' });
  const selected = async (actor = parent) => (await call('getActiveRide', actor, { rideSessionId: fixture.rideSessionId })).ride;
  assert.equal((await selected()).vehiclePoint, null); record('missing-location-is-not-replaced-with-a-route-anchor');
  const old = { rideSessionId: fixture.rideSessionId, role: 'driver', lat: 50.715, lng: 4.612,
    capturedAt: Date.now() - 120_000, accuracyM: 8 };
  await call('writeLocationBatch', driver, { updates: [old] });
  const stale = await selected(); assert.equal(stale.stale, true);
  assert.deepEqual(stale.vehiclePoint, { lat: old.lat, lng: old.lng, capturedAt: old.capturedAt, source: 'nativeFallback' });
  record('old-position-keeps-its-original-time-and-stale-status');
  const fresh = { ...old, lat: 50.717, lng: 4.614, capturedAt: Date.now() };
  await call('writeLocationBatch', driver, { updates: [fresh] });
  const current = await selected(); assert.equal(current.stale, false);
  const point = { lat: fresh.lat, lng: fresh.lng, capturedAt: fresh.capturedAt, source: 'nativeFallback' };
  assert.deepEqual(current.vehiclePoint, point); assert.deepEqual((await selected(driver)).vehiclePoint, point);
  assert.deepEqual(Object.keys(point).sort(), ['capturedAt', 'lat', 'lng', 'source']);
  assert.equal(current.childPoint, undefined); assert.equal(current.children, undefined);
  record('parent-and-driver-read-the-actual-selected-vehicle-coordinates-without-child-coordinates');
  await denied('writeLocationBatch', driver, { updates: [{ ...fresh, lat: 91 }] }, 'INVALID_ARGUMENT');
  await call('writeLocationBatch', driver, { updates: [{ ...fresh, capturedAt: Date.now() + 86_400_000 }] });
  await call('writeLocationBatch', driver, { updates: [old] });
  assert.deepEqual((await selected()).vehiclePoint, point); record('invalid-future-and-delayed-inputs-do-not-move-the-retained-position');
  const ref = getDatabase().ref(`liveTrips/${fixture.rideSessionId}/vehicle`), retained = (await ref.get()).val();
  for (const patch of [{ rideSessionId: 'another-ride' }, { userId: 'another-driver' }, { role: 'child' }]) {
    await ref.set({ ...retained, ...patch }); assert.equal((await selected()).vehiclePoint, null);
  }
  await ref.set(retained);
  const rideRef = db.collection('rideSessions').doc(fixture.rideSessionId);
  await rideRef.update({ driverUserId: 'qa-replacement-driver' }); assert.equal((await selected()).vehiclePoint, null);
  await rideRef.update({ driverUserId: driver.uid });
  record('different-ride-child-or-replaced-driver-points-are-not-exposed');
  await auth.createUser({ uid: 'qa-map-outsider', email: 'map-outsider@example.test', password: process.env.SGM_QA_PASSWORD });
  await denied('getActiveRide', await signIn('map-outsider@example.test'), { rideSessionId: fixture.rideSessionId }, 'PERMISSION_DENIED');
  await denied('getActiveRide', null, { rideSessionId: fixture.rideSessionId }, 'UNAUTHENTICATED');
  await denied('writeLocationBatch', parent, { updates: [fresh] }, 'PERMISSION_DENIED');
  const originalRide = (await rideRef.get()).data();
  await rideRef.update({ participantUserIds: [] });
  await denied('getActiveRide', parent, { rideSessionId: fixture.rideSessionId }, 'PERMISSION_DENIED');
  await rideRef.update({ participantUserIds: originalRide.participantUserIds });
  record('authentication-participation-and-write-role-are-enforced-before-coordinate-access');
  const passenger = { rideSessionId: fixture.rideSessionId, bookingId: fixture.bookingId, childId: fixture.childId };
  await call('markPickup', driver, passenger); await call('markDropoff', driver, passenger);
  await call('endRide', driver, { rideSessionId: fixture.rideSessionId, distanceMeters: 0, passengersSharing: 1 });
  assert.equal(await selected(), null); record('completion-removes-the-active-coordinate-response');
  const completion = await verifyRideObservationFixture(fixture, fixture);
  const isolation = await verifyCompletedRideFixtureIsolation(fixture);
  const paths = ['scripts/qa/local-vehicle-map-services.mjs', 'scripts/qa/run-local-vehicle-map-services.mjs',
    'functions/src/domain/vehicleMapPoint.ts', 'functions/src/lib/clientTrips.ts', 'functions/src/callables/rides.ts',
    'functions/src/lib/activeRideLookup.ts', 'functions/src/domain/access.ts'];
  report = { scope: 'local-emulated-services-not-phone-ui', projectId: 'demo-sgm-local-qa', runId: process.env.SGM_LOCAL_RUN_ID,
    testedAt: new Date().toISOString(), steps: [{ id: 'vehicle-map-points', status: 'passed' }], testCount: 1, checks,
    completion, isolation, nativeUiExecuted: false, physicalDevice: false, mapSdkVerified: false,
    mapMovementVerified: false, productionWrites: false, providerRequests: 0,
    sourceFiles: Object.fromEntries(paths.map((path) => [path, createHash('sha256').update(readFileSync(resolve(import.meta.dirname, '../..', path))).digest('hex')])) };
} finally { await deleteApp(getApp()); }
writeFileSync(process.env.SGM_LOCAL_FLOW_OUTPUT, JSON.stringify({ ...report, adminClientClosed: true }, null, 2) + '\n', { flag: 'wx' });
console.log('Seven authenticated coordinate groups passed; actual map rendering remains unverified.');
