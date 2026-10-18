import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { seedLocalUiFixtures } from './local-ui-fixtures.mjs';
import { seedRealMapsTripUi, verifyRealMapsTripUi } from './real-maps-trip-ui.mjs';
import { assertInstrumentationPassed } from './android-instrumentation-result.mjs';
import { collectLocalUiEvidence } from './collect-local-ui-evidence.mjs';
import { finishDisposableCleanup } from './disposable-device-cleanup.mjs';
import { collectNativeProcessFailure } from './native-process-failure-evidence.mjs';

assert.equal(process.env.SGM_REAL_MAPS_UI, 'approved-five-requests');
const root = resolve(import.meta.dirname, '../..'), android = resolve(root, 'android');
const adb = resolve(process.env.ANDROID_HOME, 'platform-tools/adb'), serial = process.env.SGM_LOCAL_ANDROID_SERIAL;
assert.match(serial, /^emulator-\d+$/);
const directory = process.env.SGM_LOCAL_UI_OUTPUT;
const session = await seedLocalUiFixtures(), fixture = await seedRealMapsTripUi();
const redact = (value) => String(value).replaceAll(session.password, '[REDACTED]')
  .replace(/AIza[\w-]{20,}|Bearer\s+[\w.~+/-]+=*|eyJ[\w-]+\.[\w-]+\.[\w-]*/g, '[REDACTED]');
const run = (command, args) => execFileSync(command, args, { env: process.env, cwd: root, encoding: 'utf8', timeout: 120_000 });
let failure, result, collected = false;
const collect = (phase) => collectLocalUiEvidence({ adb, serial, evidenceDir: directory, phase, runId: session.runId, password: session.password });
try {
  for (const apk of ['apk/debug/app-debug.apk', 'apk/androidTest/debug/app-debug-androidTest.apk'])
    run(adb, ['-s', serial, 'install', '-r', resolve(android, 'app/build/outputs', apk)]);
  run(process.execPath, [resolve(import.meta.dirname, 'install-local-ui-session.mjs'), serial, process.env.SGM_LOCAL_UI_SESSION_FILE]);
  const output = execFileSync(adb, ['-s', serial, 'shell', 'am', 'instrument', '-w', '-e', 'timeout_msec', '240000',
    '-e', 'realMapsApproved', session.runId, '-e', 'realMapsTripId', fixture.tripId,
    '-e', 'realMapsFirstBooking', fixture.bookingIds[0], '-e', 'realMapsSecondBooking', fixture.bookingIds[1],
    '-e', 'realMapsSecondParentEmail', fixture.secondParent.email,
    '-e', 'class', 'be.sportgreenmoove.app.ui.LocalRealMapsTripChangeTest',
    'be.sportgreenmoove.app.local.test/androidx.test.runner.AndroidJUnitRunner'],
  { env: process.env, encoding: 'utf8', timeout: 12 * 60_000, maxBuffer: 4 * 1024 * 1024 });
  writeFileSync(resolve(directory, 'LocalRealMapsTripChangeTest-instrumentation.txt'), redact(output), { flag: 'wx' });
  assertInstrumentationPassed(output, 1);
  collect('real-maps-application'); collected = true;
  result = await verifyRealMapsTripUi(fixture, directory, session.runId);
} catch (error) {
  failure = new Error(redact(error.stack ?? error));
  try {
    const logs = run(adb, ['-s', serial, 'logcat', '-d', '-v', 'brief', 'Google Maps Android API:E', '*:S']);
    writeFileSync(resolve(directory, 'map-display-provider-errors.txt'), redact(logs), { mode: 0o600, flag: 'wx' });
  } catch { console.warn('Map display provider diagnostics were unavailable.'); }
  try { collectNativeProcessFailure({ adb, serial, directory, label: 'real-maps-application', password: session.password, runId: session.runId }); }
  catch { console.warn('Additional map UI failure diagnostics were unavailable.'); }
} finally {
  finishDisposableCleanup(failure, [() => { if (!collected) collect('failure-cleanup'); },
    () => run(adb, ['-s', serial, 'shell', 'run-as', 'be.sportgreenmoove.app.local', 'rm', '-f', 'files/local-qa-session.json'])]);
}
assert(result, 'A completed native replay with persisted checks is required');
writeFileSync(resolve(directory, 'results.json'), JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
