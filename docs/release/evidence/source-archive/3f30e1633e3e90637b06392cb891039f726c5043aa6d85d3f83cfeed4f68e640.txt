import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { deleteApp } from 'firebase-admin/app';
import { getDatabase } from 'firebase-admin/database';
import { auth, db, call, denied, signIn, viewedBooking } from './local-flow-client.mjs';
import { seedLocalUiFixtures } from './local-ui-fixtures.mjs';
import { seedSearchBookingFixture, readSearchBookingState } from './search-booking-fixture.mjs';
import { assertSearchBookingCheckpoint } from './search-booking-checkpoint.mjs';
import { snapshotSearchBookingRecords, verifySearchBookingIsolation } from './search-booking-records.mjs';
import { withLocalAdminCleanup } from './local-admin-lifecycle.mjs';

const root = resolve(import.meta.dirname, '../..'), checks = [], checkpoints = [];
let failure, fixture, isolation, adminClientClosed = false, firestoreClientTerminated = false;
const sourcePaths = ['scripts/qa/search-booking-notice-services-suite.mjs', 'scripts/qa/search-booking-checkpoint.mjs',
  'scripts/qa/search-booking-records.mjs', 'functions/src/callables/bookingRequests.ts'];
const sourceFiles = Object.fromEntries(sourcePaths.map(path => [path,
  createHash('sha256').update(readFileSync(resolve(root, path))).digest('hex')]));
const check = async (id, action) => {await action(); checks.push({id, status: 'passed'});};
try {
  await withLocalAdminCleanup(async () => {
    assert.equal(typeof process.env.GOOGLE_APPLICATION_CREDENTIALS, 'string');
    process.env.SGM_LOCAL_UI_SESSION_FILE = resolve(dirname(process.env.GOOGLE_APPLICATION_CREDENTIALS), 'notice-service-session.json');
    await seedLocalUiFixtures();
    const parent = await signIn('p@example.test'), driver = await signIn('d@example.test');
    for (const actor of [parent, driver]) await call('initializeUserProfile', actor);
    fixture = await seedSearchBookingFixture({origin: {lat: 50.7167, lng: 4.6167}, destination: {lat: 50.8503, lng: 4.3517},
      departureAt: new Date(Date.now() + 72 * 3600_000).toISOString()});
    const before = await snapshotSearchBookingRecords(db, auth, getDatabase());
    const input = await viewedBooking(parent, {tripId: fixture.tripId, seats: 2, childId: 'sgm-qa-child-lina', guardianConsent: true});
    let bookingId;
    const checkpoint = async phase => {
      const state = await readSearchBookingState(fixture.tripId, bookingId);
      const result = assertSearchBookingCheckpoint(phase, state, {tripId: fixture.tripId, bookingId});
      checkpoints.push({phase, state, result}); return state;
    };
    await check('current-request-notice-passes-the-actual-search-checkpoint', async () => {
      ({bookingId} = await call('requestBooking', parent, input)); await checkpoint('requested');
    });
    await check('same-request-retry-preserves-one-booking-receipt-and-notice', async () => {
      const state = await readSearchBookingState(fixture.tripId, bookingId);
      const retry = await call('requestBooking', parent, input); assert.equal(retry.bookingId, bookingId);
      assert.deepEqual(await readSearchBookingState(fixture.tripId, bookingId), state);
    });
    await check('driver-approval-keeps-request-notice-and-consumes-two-seats', async () => {
      await call('approveBooking', driver, {bookingId}); await checkpoint('approved');
    });
    await check('parent-cancellation-keeps-all-three-notices-and-restores-capacity', async () => {
      await call('cancelBooking', parent, {bookingId}); await checkpoint('cancelled');
    });
    await check('rejected-repeated-decisions-do-not-mutate-the-accepted-state', async () => {
      const state = await readSearchBookingState(fixture.tripId, bookingId);
      await denied('approveBooking', driver, {bookingId}, 'FAILED_PRECONDITION');
      await denied('cancelBooking', parent, {bookingId}, 'FAILED_PRECONDITION');
      assert.deepEqual(await readSearchBookingState(fixture.tripId, bookingId), state);
    });
    await check('all-unrelated-records-claims-and-live-trips-stay-unchanged', async () => {
      isolation = verifySearchBookingIsolation(before, await snapshotSearchBookingRecords(db, auth, getDatabase()),
        {tripId: fixture.tripId, bookingId});
    });
  }, {firestore: {terminate: async () => {await db.terminate(); firestoreClientTerminated = true;}},
    closeApp: async app => {await deleteApp(app); adminClientClosed = true;}});
} catch (error) {failure = error;}
const report = {scope: 'authenticated-search-booking-notice-contract-not-native-ui-or-provider',
  projectId: 'demo-sgm-local-qa', runId: process.env.SGM_LOCAL_RUN_ID, testedAt: new Date().toISOString(),
  checks, checkpoints, fixture, isolation, adminClientClosed, firestoreClientTerminated, sourceFiles,
  completed: !failure, nativeUiExecuted: false, providerRequests: 0, productionWrites: false, releaseComplete: false,
  ...(failure ? {failure: {name: failure.name, message: String(failure.message).replaceAll(process.env.SGM_QA_PASSWORD, '[REDACTED]')}} : {})};
mkdirSync(dirname(process.env.SGM_LOCAL_FLOW_OUTPUT), {recursive: true});
writeFileSync(process.env.SGM_LOCAL_FLOW_OUTPUT, JSON.stringify(report, null, 2) + '\n', {flag: 'wx'});
if (failure) throw new Error('Search booking notice contract failed; see the sanitized replay report');
console.log('Six authenticated search-booking notice checks passed without provider calls or native UI.');
