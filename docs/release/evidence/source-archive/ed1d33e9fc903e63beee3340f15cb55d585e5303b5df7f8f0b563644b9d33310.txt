import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { deleteApp, getApp } from 'firebase-admin/app';
import { auth, call, denied, signIn, tripInput, viewedBooking } from './local-flow-client.mjs';

async function runChecks() {
  execFileSync(process.execPath, [resolve(import.meta.dirname, 'seed-firebase-emulator.mjs')],
    { env: process.env, stdio: ['ignore', 'pipe', 'pipe'], timeout: 90_000 });
  const parent = await signIn('p@example.test'), driver = await signIn('d@example.test');
  const checks = [], record = (id) => checks.push({ id, status: 'passed' });
  async function start() {
    const { tripId } = await call('createTrip', driver, tripInput());
    const { bookingId } = await call('requestBooking', parent, await viewedBooking(parent, { tripId, seats: 1, childId: 'sgm-qa-child-lina' }));
    await call('approveBooking', driver, { bookingId });
    const { ride } = await call('startRide', driver, { tripId, bookingIds: [bookingId] });
    return { rideSessionId: ride.rideSessionId, bookingId };
  }
  const first = await start(), second = await start();
  const selected = (await call('getActiveRide', parent, { rideSessionId: first.rideSessionId })).ride;
  assert.equal(selected.rideSessionId, first.rideSessionId);
  assert.equal((await call('getActiveRide', parent)).ride.rideSessionId, second.rideSessionId);
  record('explicit-observer-id-cannot-be-replaced-by-another-active-ride');
  assert.deepEqual(selected.observation, { vehicleAgeMs: null, childAgeMs: null, vehicleHasPoint: false,
    childHasPoint: false, vehicleSource: null, childSource: null });
  record('missing-point-remains-explicitly-unverified');
  await call('writeLocationBatch', driver, { updates: [{ rideSessionId: first.rideSessionId, role: 'driver',
    lat: 50.715, lng: 4.612, accuracyM: 8, capturedAt: Date.now() - 30_000 }] });
  const fresh = (await call('getActiveRide', parent, { rideSessionId: first.rideSessionId })).ride;
  assert(fresh.observation.vehicleAgeMs >= 30_000 && fresh.observation.vehicleAgeMs < 60_000);
  assert.equal(fresh.observation.vehicleHasPoint, true); assert.equal(fresh.observation.vehicleSource, 'nativeFallback');
  assert.equal(fresh.stale, false); record('server-returns-capture-age-for-monotonic-client-aging');
  await auth.createUser({ uid: 'qa-ride-observer-outsider', email: 'ride-outsider@example.test', password: process.env.SGM_QA_PASSWORD });
  const outsider = await signIn('ride-outsider@example.test');
  await denied('getActiveRide', outsider, { rideSessionId: first.rideSessionId }, 'PERMISSION_DENIED');
  await denied('getActiveRide', null, { rideSessionId: first.rideSessionId }, 'UNAUTHENTICATED');
  record('explicit-ride-id-does-not-bypass-current-authentication-or-participation');
  await denied('getActiveRide', parent, { rideSessionId: 'ride/other' }, 'INVALID_ARGUMENT');
  await denied('getActiveRide', parent, { rideSessionId: first.rideSessionId, extra: true }, 'INVALID_ARGUMENT');
  record('observer-references-and-payload-shape-are-validated');
  await call('markPickup', driver, { rideSessionId: first.rideSessionId, bookingId: first.bookingId, childId: 'sgm-qa-child-lina' });
  const picked = (await call('getActiveRide', parent, { rideSessionId: first.rideSessionId })).ride;
  assert.equal(picked.passengers[0].pickupStatus, 'pickedUp'); record('parent-observer-response-includes-remote-pickup-state');
  await call('markDropoff', driver, { rideSessionId: first.rideSessionId, bookingId: first.bookingId, childId: 'sgm-qa-child-lina' });
  await call('endRide', driver, { rideSessionId: first.rideSessionId, distanceMeters: 0, passengersSharing: 1 });
  assert.equal((await call('getActiveRide', parent, { rideSessionId: first.rideSessionId })).ride, null);
  assert.equal((await call('getActiveRide', parent)).ride.rideSessionId, second.rideSessionId);
  record('completion-clears-the-observed-ride-without-switching-to-a-different-one');
  const paths = ['scripts/qa/local-ride-observation-services.mjs', 'functions/src/callables/rides.ts',
    'functions/src/lib/activeRideLookup.ts', 'functions/src/lib/clientTrips.ts', 'functions/src/domain/types.ts'];
  return { projectId: 'demo-sgm-local-qa', runId: process.env.SGM_LOCAL_RUN_ID, testedAt: new Date().toISOString(),
    scope: 'local-ride-observation-callables-not-native-or-physical', checks,
    steps: [{ id: 'ride-observation-services', status: 'passed' }], testCount: 1,
    nativeUiExecuted: false, physicalDevice: false, productionWrites: false, providerRequests: 0,
    sourceFiles: Object.fromEntries(paths.map((path) => [path, createHash('sha256').update(readFileSync(resolve(import.meta.dirname, '../..', path))).digest('hex')])) };
}
let report;
try { report = await runChecks(); }
finally { await deleteApp(getApp()); }
writeFileSync(process.env.SGM_LOCAL_FLOW_OUTPUT, JSON.stringify({ ...report, adminClientClosed: true }, null, 2) + '\n', { flag: 'wx' });
console.log('Seven actual ride-observer callable groups passed; native UI and physical GPS remain separate.');
