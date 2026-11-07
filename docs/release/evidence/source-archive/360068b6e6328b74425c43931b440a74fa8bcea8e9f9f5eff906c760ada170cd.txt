import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomBytes, createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';
import { resetDisposableLocalApps } from './reset-disposable-local-apps.mjs';
import { installDisposableTestApks, disposableTestRunner } from './install-disposable-test-apks.mjs';
import { assertInstrumentationPassed } from './android-instrumentation-result.mjs';
import { collectLocalUiEvidence } from './collect-local-ui-evidence.mjs';

assert.equal(process.env.SGM_LOCAL_DISPOSABLE_EMULATOR, 'true');
const serial = process.argv[2], output = process.env.SGM_LOCAL_UI_OUTPUT;
assert.match(serial, /^emulator-\d+$/); assert(isAbsolute(output ?? '') && !existsSync(output));
const root = resolve(import.meta.dirname, '../..'), android = resolve(root, 'android');
const adb = resolve(process.env.ANDROID_HOME, 'platform-tools/adb');
const runId = randomBytes(16).toString('hex'), password = randomBytes(24).toString('hex');
const run = (command, args) => execFileSync(command, args, { cwd: root, env: process.env,
  encoding: 'utf8', timeout: 240_000, maxBuffer: 4 * 1024 * 1024 });
mkdirSync(output);
let failure, transcript, cases;
try {
  resetDisposableLocalApps(adb, serial);
  installDisposableTestApks({ adb, serial, android, run });
  transcript = run(adb, ['-s', serial, 'shell', 'am', 'instrument', '-w', '-e', 'timeout_msec', '180000',
    '-e', 'class', 'be.sportgreenmoove.app.ui.VehicleMapLayoutTest', `be.sportgreenmoove.app.local.test/${disposableTestRunner}`]);
  writeFileSync(resolve(output, 'VehicleMapLayoutTest-instrumentation.txt'), transcript, { flag: 'wx' });
  assertInstrumentationPassed(transcript, 2);
  collectLocalUiEvidence({ adb, serial, evidenceDir: output, phase: 'vehicle-map-layout', runId, password });
  cases = ['narrow', 'stale'].map((name) => {
    const marker = JSON.parse(readFileSync(resolve(output, `vehicle-map-layout-${name}.json`)));
    assert.equal(marker.scope, 'native-component-layout-without-map-renderer-or-backend');
    assert.equal(marker.arrivalOutsideMap, true); assert.equal(marker.textWithinViewport, true);
    assert.equal(marker.mapSdkVerified, false); assert.equal(marker.physicalDevice, false);
    return marker;
  });
} catch (error) {
  failure = error;
  try { collectLocalUiEvidence({ adb, serial, evidenceDir: output, phase: 'failure-cleanup', runId, password }); }
  catch { console.warn('Partial diagnostic transfer unavailable; original failure is unchanged.'); }
}
try { resetDisposableLocalApps(adb, serial); }
catch (error) { failure = failure ? new AggregateError([failure, error], 'Layout and package cleanup failed') : error; }
if (failure) throw failure;
const paths = ['scripts/qa/run-vehicle-map-layout.mjs',
  'android/app/src/androidTest/java/be/sportgreenmoove/app/ui/VehicleMapLayoutTest.kt',
  'android/app/src/main/java/be/sportgreenmoove/app/ui/RideMonitorScreen.kt',
  'android/app/src/main/java/be/sportgreenmoove/app/ui/GoogleMapsRoutePreview.kt'];
const screenshots = Object.fromEntries(['narrow', 'stale'].map((name) => {
  const file = `local-native-startup-vehicle-map-${name}.png`;
  return [file, createHash('sha256').update(readFileSync(resolve(output, file))).digest('hex')];
}));
writeFileSync(resolve(output, 'layout-results.json'), JSON.stringify({
  scope: 'native-component-layout-without-map-renderer-or-backend', runId, testedAt: new Date().toISOString(),
  nativeCaseCount: 2, cases, screenshots, localPackagesRemoved: true, physicalDevice: false, mapSdkVerified: false,
  applicationBackendConnected: false, transcriptSha256: createHash('sha256').update(transcript).digest('hex'),
  sourceFiles: Object.fromEntries(paths.map((file) => [file, createHash('sha256').update(readFileSync(resolve(root, file))).digest('hex')]))
}, null, 2) + '\n', { flag: 'wx' });
