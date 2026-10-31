import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';
import { imageSize } from 'image-size';
import { disposableAndroidShell } from './disposable-android-shell.mjs';
import { requireFocusedDeviceApproval, preparePinnedApks, assertContinuousDevice } from './preinstalled-disposable-apks.mjs';
import { restoreContinuousDevice } from './continuous-disposable-device.mjs';
import { parseAndroidJUnitTranscript } from './android-junit-transcript.mjs';
import { collectPrimaryCaptureDiagnostics } from './collect-primary-capture-diagnostics.mjs';

const [setupFile, directory, mode] = process.argv.slice(2);
assert([setupFile, directory].every(path => isAbsolute(path ?? '')));
assert(['baseline', 'candidate'].includes(mode)); assert(!existsSync(directory));
requireFocusedDeviceApproval(process.env);
assert.equal(process.env.SGM_FOCUSED_UI_CASE, 'trip-change-components');
assert.equal(process.env.SGM_PREINSTALLED_TEST_APKS_RECEIPT, setupFile);
assert.equal(process.env.SGM_PRIMARY_CAPTURE_DIAGNOSTICS, 'true');
const root = resolve(import.meta.dirname, '../..'), device = disposableAndroidShell(), { serial } = device;
const setupBytes = readFileSync(setupFile), setup = JSON.parse(setupBytes);
assert.equal(setup.case, 'trip-change-components'); assert.equal(setup.serial, serial);
const adb = resolve(process.env.ANDROID_HOME, 'platform-tools/adb'), errors = [];
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const paths = ['scripts/qa/run-capture-window-probe.mjs', 'scripts/qa/primary-capture-diagnostic-schema.mjs',
  ...['PrimaryCaptureProbe.kt', 'PrimaryCaptureDiagnostics.kt', 'PrimaryCaptureDiagnosticsTest.kt',
    'PrimaryCaptureWindowCalibrationTest.kt', 'LocalUiCapture.kt', 'TripChangeFlowTest.kt']
    .map(file => 'android/app/src/androidTest/java/be/sportgreenmoove/app/ui/' + file)];
mkdirSync(directory); mkdirSync(resolve(directory, 'sources'));
const save = (name, value) => writeFileSync(resolve(directory, name), typeof value === 'string' ? value : JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
const sourceFiles = Object.fromEntries(paths.map(file => {
  const hash = sha(readFileSync(resolve(root, file)));
  copyFileSync(resolve(root, file), resolve(directory, 'sources', hash + '.txt'), 1);
  return [file, hash];
}));
save('device-setup.json', setupBytes.toString());
const method = 'largeTextParentSeesBothVersionsAndAcceptsWithoutApplying';
const selected = ['PrimaryCaptureWindowCalibrationTest', 'PrimaryCaptureDiagnosticsTest', `TripChangeFlowTest#${method}`];
let report, preparation, restore, diagnostic, primaryCopy;
try {
  preparation = preparePinnedApks({ android: resolve(root, 'android'), serial, device });
  const result = spawnSync(adb, ['-s', serial, 'shell', 'am', 'instrument', '-w', '-r', '-e', 'timeout_msec', '180000',
    '-e', 'sgmBlockInstallations', 'true', '-e', 'sgmPrimaryCaptureDiagnostics', 'true', '-e', 'class',
    selected.map(name => 'be.sportgreenmoove.app.ui.' + name).join(','),
    'be.sportgreenmoove.app.test/be.sportgreenmoove.app.ui.DisposableAndroidJUnitRunner'],
  { encoding: 'utf8', timeout: 6 * 60_000, maxBuffer: 4 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });
  save('instrumentation.txt', result.stdout ?? '');
  assert.equal(result.status, 0); assert.equal(result.signal, null); assert(!result.error);
  report = parseAndroidJUnitTranscript(result.stdout);
  assert.equal(report.caseCount, 8); assert.equal(report.skipped, 0);
  assert.equal(report.failed, mode === 'baseline' ? 2 : 0);
  const calibration = report.cases.filter(row => row.className.endsWith('.PrimaryCaptureWindowCalibrationTest'));
  assert.equal(calibration.length, 2); assert(calibration.every(row => row.status === (mode === 'baseline' ? 'failed' : 'passed')));
  assert(report.cases.filter(row => !calibration.includes(row)).every(row => row.status === 'passed'));
  assertContinuousDevice(device, setup);
} catch (failure) { errors.push(failure); }
for (const action of [
  () => {
    const target = resolve(directory, 'images'); mkdirSync(target);
    const result = spawnSync(adb, ['-s', serial, 'pull', '/sdcard/Android/data/be.sportgreenmoove.app/files/local-ui-evidence/.', target],
      { timeout: 30_000, maxBuffer: 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });
    primaryCopy = { scope: 'single-primary-component-file-copy-not-flow-proof', status: result.status,
      signal: result.signal ?? null, errorCode: result.error ? 'COPY_PROCESS_ERROR' : null, files: {} };
    save('primary-copy.json', primaryCopy);
    assert.equal(result.status, 0); assert.equal(result.signal, null); assert(!result.error);
    const expected = ['trip-change-parent-review-large-text', 'trip-change-parent-accepted']
      .flatMap(name => [name + '.png', name + '-window.png']);
    assert.deepEqual(readdirSync(target).sort(), expected.sort());
    for (const name of expected) {
      const bytes = readFileSync(resolve(target, name)), size = imageSize(bytes);
      assert.equal(size.type, 'png'); assert(size.width < size.height);
      primaryCopy.files[name] = { sha256: sha(bytes), width: size.width, height: size.height };
    }
    save('primary-files.json', primaryCopy.files);
  },
  () => { diagnostic = collectPrimaryCaptureDiagnostics({ adb, serial, directory, ordinaryPassed: false }); assert.equal(diagnostic.ok, true); },
  () => { restore = restoreContinuousDevice(device, setup); },
]) { try { action(); } catch (failure) {
  if (failure.receipt?.scope === 'single-case-device-restoration-not-flow-proof') restore = failure.receipt;
  errors.push(failure);
} }
for (const [file, hash] of Object.entries(sourceFiles)) {
  try { assert.equal(sha(readFileSync(resolve(root, file))), hash); } catch (failure) { errors.push(failure); }
}
save('device-restored.json', restore ?? { verified: false });
save('results.json', { scope: 'controlled-observer-calibration-and-one-component-not-full-matrix-proof',
  mode, testedAt: new Date().toISOString(), completed: errors.length === 0, allTestsPassed: report?.failed === 0,
  report: report ?? null, sourceFiles, apkPreparation: preparation ?? null, diagnostic: diagnostic ?? null,
  deviceRestorationVerified: restore?.verified === true, failureCategories: errors.map(error => error.name),
  realCiFailureReproduced: false, rootCauseProven: false, backendConnected: false, physicalDevice: false,
  productionWrites: false, fullGateAccepted: false, newPublicMediaAccepted: false });
if (errors.length) throw new AggregateError(errors, 'Capture-window trial failed; original outcome and cleanup retained');
console.log(mode === 'baseline' ? 'Two controlled observation gaps reproduced; the actual component passes.' :
  'Two controlled observation cases, five wrapper cases and one actual component pass; no CI root cause accepted.');
