import assert from 'node:assert/strict';
import { promisify } from 'node:util';
import { execFile, execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { deleteApp, getApp } from 'firebase-admin/app';
import { getDatabase } from 'firebase-admin/database';
import { seedLocalUiFixtures } from './local-ui-fixtures.mjs';
import { auth, db, call, signIn } from './local-flow-client.mjs';
import { seedSearchBookingFixture, readSearchBookingState } from './search-booking-fixture.mjs';
import { openSearchBookingCheckpoints } from './search-booking-checkpoint.mjs';
import { snapshotSearchBookingRecords, verifySearchBookingIsolation } from './search-booking-records.mjs';
import { resetDisposableLocalApps } from './reset-disposable-local-apps.mjs';
import { prepareDisposableTestApks, installationGuardArguments, disposableTestRunner } from './install-disposable-test-apks.mjs';
import { collectLocalUiEvidence } from './collect-local-ui-evidence.mjs';
import { assertInstrumentationPassed } from './android-instrumentation-result.mjs';

assert.equal(process.env.SGM_SEARCH_BOOKING_APPROVAL, 'one-trial-max-eight-requests');
assert.equal(process.env.SGM_FOCUSED_UI_CASE, 'parent-search-booking');
const root = resolve(import.meta.dirname, '../..'), directory = process.env.SGM_LOCAL_UI_OUTPUT;
const serial = process.env.SGM_LOCAL_ANDROID_SERIAL; assert.match(serial, /^emulator-\d+$/);
const adb = resolve(process.env.ANDROID_HOME, 'platform-tools/adb'), execute = promisify(execFile);
const run = (cmd, args) => execFileSync(cmd, args, { cwd: root, env: process.env, encoding: 'utf8', timeout: 120_000 });
const save = (name, value) => writeFileSync(resolve(directory, name), JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
let session, fixture, checkpoints, apkPreparation, isolation, native, failure, primary;
try {
  session = await seedLocalUiFixtures();
  for (const email of [session.parent, session.driver]) await call('initializeUserProfile', await signIn(email));
  fixture = await seedSearchBookingFixture(JSON.parse(process.env.SGM_SEARCH_BOOKING_PLAN));
  const baseline = await snapshotSearchBookingRecords(db, auth, getDatabase());
  checkpoints = await openSearchBookingCheckpoints({ runId: session.runId, tripId: fixture.tripId,
    readState: bookingId => readSearchBookingState(fixture.tripId, bookingId) });
  Object.assign(session, { searchBookingCheckpointPort: checkpoints.port, searchBookingCheckpointToken: checkpoints.token });
  writeFileSync(process.env.SGM_LOCAL_UI_SESSION_FILE, JSON.stringify(session), { mode: 0o600 });
  apkPreparation = prepareDisposableTestApks({ adb, serial, android: resolve(root, 'android'), run });
  run(process.execPath, [resolve(import.meta.dirname, 'install-local-ui-session.mjs'), serial, process.env.SGM_LOCAL_UI_SESSION_FILE]);
  let output = '', instrumentFailure;
  try {
    ({ stdout: output } = await execute(adb, ['-s', serial, 'shell', 'am', 'instrument', '-w', '-e', 'timeout_msec', '240000',
      ...installationGuardArguments(), '-e', 'searchBookingApproved', session.runId,
      '-e', 'searchBookingTripId', fixture.tripId, '-e', 'searchBookingDeparture', fixture.departureAt,
      '-e', 'class', 'be.sportgreenmoove.app.ui.LocalParentSearchBookingTest',
      `be.sportgreenmoove.app.local.test/${disposableTestRunner}`],
    { env: process.env, timeout: 12 * 60_000, maxBuffer: 4 * 1024 * 1024 }));
  } catch (error) { output = String(error.stdout ?? ''); instrumentFailure = new Error('Search booking instrumentation command failed'); }
  const redacted = output.replaceAll(session.password, '[REDACTED]').replaceAll(checkpoints.token, '[REDACTED]');
  writeFileSync(resolve(directory, 'LocalParentSearchBookingTest-instrumentation.txt'), redacted, { flag: 'wx' });
  if (instrumentFailure) throw instrumentFailure;
  assertInstrumentationPassed(redacted, 1);
  primary = collectLocalUiEvidence({ adb, serial, evidenceDir: directory, phase: 'parent-search-booking', runId: session.runId, password: session.password });
  native = JSON.parse(readFileSync(resolve(directory, 'local-parent-search-booking-device.json')));
  assert.equal(native.runId, session.runId); assert.equal(native.completed, true);
  assert.equal(checkpoints.receipts().length, 3);
  isolation = verifySearchBookingIsolation(baseline, await snapshotSearchBookingRecords(db, auth, getDatabase()),
    { tripId: fixture.tripId, bookingId: native.bookingId });
} catch (error) { failure = error; }
finally {
  try { if (checkpoints) save('search-booking-checkpoints.json', checkpoints.receipts()); }
  catch (error) { failure = failure ? new AggregateError([failure, error], 'Trial and checkpoint retention failed') : error; }
  if (failure && session) {
    try { collectLocalUiEvidence({ adb, serial, evidenceDir: directory, phase: 'failure-cleanup', runId: session.runId, password: session.password }); }
    catch { console.warn('Partial evidence unavailable; the original failure is retained.'); }
  }
  for (const [label, cleanup] of [['checkpoint server', async () => { if (checkpoints) await checkpoints.close(); }],
    ['admin client', () => deleteApp(getApp())], ['local APKs', () => resetDisposableLocalApps(adb, serial)]]) {
    try { await cleanup(); } catch (error) { failure = failure ? new AggregateError([failure, error], `Trial and ${label} cleanup failed`) : error; }
  }
}
if (failure) throw failure;
const sourcePaths = ['local-search-booking-ui.mjs', 'search-booking-fixture.mjs', 'search-booking-records.mjs',
  'search-booking-checkpoint.mjs', 'search-booking-evidence.mjs', 'search-maps-policy.mjs', 'search-maps-fetch.mjs',
  'map-broker-server.mjs', 'real-maps-runtime.mjs', 'real-maps-function-bridge.mjs'].map(name => 'scripts/qa/' + name);
sourcePaths.push(...['LocalParentSearchBookingTest.kt', 'SearchBookingCheckpoint.kt', 'LocalUiCapture.kt']
  .map(name => 'android/app/src/androidTest/java/be/sportgreenmoove/app/ui/' + name));
save('search-booking-app-results.json', { ...native, fixtureIsolation: isolation, primaryEvidencePhase: 'parent-search-booking',
  primaryCopy: primary, apkPreparation, localPackagesRemoved: true, adminClientClosed: true, checkpointServerClosed: true,
  cleanupMode: 'destroy-owned-local-environment', sourceCommit: run('git', ['rev-parse', 'HEAD']).trim(),
  sourceFiles: Object.fromEntries(sourcePaths.map(path => [path, createHash('sha256').update(readFileSync(resolve(root, path))).digest('hex')])) });
