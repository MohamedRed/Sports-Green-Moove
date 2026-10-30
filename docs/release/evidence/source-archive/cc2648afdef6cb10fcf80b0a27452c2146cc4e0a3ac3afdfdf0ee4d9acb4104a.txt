import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {createHash, randomBytes} from 'node:crypto';
import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {isAbsolute, resolve} from 'node:path';
import {disposableAndroidShell} from './disposable-android-shell.mjs';
import {requireFocusedDeviceApproval, preparePinnedApks, assertContinuousDevice} from './preinstalled-disposable-apks.mjs';
import {restoreContinuousDevice} from './continuous-disposable-device.mjs';
import {collectLocalUiEvidence} from './collect-local-ui-evidence.mjs';
import {parseAndroidJUnitTranscript} from './android-junit-transcript.mjs';
import {collectRejectedPrimaryBitmaps} from './rejected-primary-captures.mjs';

const [setupFile, directory] = process.argv.slice(2);
assert([setupFile, directory].every(path => isAbsolute(path ?? ''))); assert(!existsSync(directory));
requireFocusedDeviceApproval(process.env); assert.equal(process.env.SGM_FOCUSED_UI_CASE, 'team-chat-components');
assert.equal(process.env.SGM_PREINSTALLED_TEST_APKS_RECEIPT, setupFile);
assert.equal(process.env.SGM_PRIMARY_CAPTURE_DIAGNOSTICS, 'true');
const root = resolve(import.meta.dirname, '../..'), device = disposableAndroidShell(), {serial} = device;
const setupBytes = readFileSync(setupFile), setup = JSON.parse(setupBytes);
assert.equal(setup.case, 'team-chat-components'); assert.equal(setup.serial, serial);
const adb = resolve(process.env.ANDROID_HOME, 'platform-tools/adb'), errors = [];
const runId = randomBytes(16).toString('hex'), sha = bytes => createHash('sha256').update(bytes).digest('hex');
const paths = ['scripts/qa/run-rejected-capture-probe.mjs', 'scripts/qa/rejected-primary-captures.mjs',
  'scripts/qa/collect-ordinary-android-failure.mjs', ...['LocalUiCapture.kt', 'PrimaryCaptureDiagnostics.kt',
    'RejectedPrimaryBitmap.kt', 'RejectedPrimaryBitmapTest.kt', 'TeamConversationFlowTest.kt', 'TeamChatComponentCapture.kt']
    .map(file => 'android/app/src/androidTest/java/be/sportgreenmoove/app/ui/' + file)];
const sourceFiles = Object.fromEntries(paths.map(file => [file, sha(readFileSync(resolve(root, file)))]));
mkdirSync(directory); writeFileSync(resolve(directory, 'device-setup.json'), setupBytes, {flag: 'wx'});
let report, preparation, restore, diagnostic;
try {
  preparation = preparePinnedApks({android: resolve(root, 'android'), serial, device});
  const result = spawnSync(adb, ['-s', serial, 'shell', 'am', 'instrument', '-w', '-r', '-e', 'timeout_msec', '180000',
    '-e', 'sgmBlockInstallations', 'true', '-e', 'sgmPrimaryCaptureDiagnostics', 'true', '-e', 'class',
    ['RejectedPrimaryBitmapTest', 'TeamConversationFlowTest'].map(name => 'be.sportgreenmoove.app.ui.' + name).join(','),
    'be.sportgreenmoove.app.local.test/be.sportgreenmoove.app.ui.DisposableAndroidJUnitRunner'],
  {encoding: 'utf8', timeout: 8 * 60_000, maxBuffer: 4 * 1024 * 1024});
  writeFileSync(resolve(directory, 'instrumentation.txt'), result.stdout ?? '', {flag: 'wx'});
  assert.equal(result.status, 0); assert.equal(result.signal, null); assert(!result.error);
  report = parseAndroidJUnitTranscript(result.stdout); assert.equal(report.failed, 0); assert.equal(report.skipped, 0);
  assert.equal(report.caseCount, 7); assert.equal(report.passed, 7);
  for (const [name, count] of [['RejectedPrimaryBitmapTest', 4], ['TeamConversationFlowTest', 3]])
    assert.equal(report.cases.filter(row => row.className === 'be.sportgreenmoove.app.ui.' + name).length, count);
  assertContinuousDevice(device, setup);
} catch (failure) {errors.push(failure);}
for (const action of [
  () => collectLocalUiEvidence({adb, serial, runId, evidenceDir: directory, phase: 'team-chat-components', password: randomBytes(24).toString('hex')}),
  () => {diagnostic = collectRejectedPrimaryBitmaps({adb, serial, directory, packageName: 'be.sportgreenmoove.app.local'});
    assert.notEqual(diagnostic.collectionStatus, 'failed');},
  () => {restore = restoreContinuousDevice(device, setup);},
]) {try {action();} catch (failure) {
  if (failure.receipt?.scope === 'single-case-device-restoration-not-flow-proof') restore = failure.receipt;
  errors.push(failure);
}}
for (const [file, expected] of Object.entries(sourceFiles)) {
  try {assert.equal(sha(readFileSync(resolve(root, file))), expected, 'Source changed during probe');} catch (failure) {errors.push(failure);}
}
if (!errors.length && diagnostic.collectionStatus !== 'not-observed') errors.push(new Error('Passing probe retained an unexpected rejected capture'));
writeFileSync(resolve(directory, 'device-restored.json'), JSON.stringify(restore ?? {verified: false}, null, 2) + '\n', {flag: 'wx'});
writeFileSync(resolve(directory, 'results.json'), JSON.stringify({scope: 'rejected-bitmap-calibration-and-team-components-not-ci-root-cause-proof',
  testedAt: new Date().toISOString(), runId, completed: errors.length === 0, report: report ?? null,
  sourceFiles, apkPreparation: preparation ?? null, diagnosticCollection: diagnostic ?? null,
  failureCategories: errors.map(error => error.name),
  deviceRestorationVerified: restore?.verified === true, backendConnected: false, physicalDevice: false,
  rootCauseProven: false, realCiRejectionReproduced: false, productionWrites: false, newMediaAccepted: false,
}, null, 2) + '\n', {flag: 'wx'});
if (errors.length) throw new AggregateError(errors, 'Capture diagnostic probe failed; exact attempt retained');
console.log('Four diagnostic calibration cases and three unchanged team components passed; no rejected CI bitmap or root cause accepted.');
