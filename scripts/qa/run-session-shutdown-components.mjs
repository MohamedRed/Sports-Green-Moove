import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash, randomBytes} from 'node:crypto';
import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {isAbsolute, resolve} from 'node:path';
import {disposableAndroidShell} from './disposable-android-shell.mjs';
import {installationGuardArguments, disposableTestRunner} from './install-disposable-test-apks.mjs';
import {assertContinuousDevice} from './preinstalled-disposable-apks.mjs';
import {assertLocalApkIdentity} from './local-apk-identity.mjs';
import {assertInstrumentationPassed} from './android-instrumentation-result.mjs';
import {collectLocalUiEvidence} from './collect-local-ui-evidence.mjs';

const [receiptPath, directory] = process.argv.slice(2), root = resolve(import.meta.dirname, '../..');
assert(isAbsolute(receiptPath ?? '') && isAbsolute(directory ?? '') && !existsSync(directory));
const setup = JSON.parse(readFileSync(receiptPath)), device = disposableAndroidShell();
assert.equal(setup.case, 'team-read-components'); assert.equal(process.env.SGM_FOCUSED_UI_CASE, setup.case);
assert.equal(process.env.SGM_PREINSTALLED_TEST_APKS_RECEIPT, receiptPath);
const adb = resolve(process.env.ANDROID_HOME, 'platform-tools/adb'), runId = randomBytes(16).toString('hex');
const sources = ['scripts/qa/run-session-shutdown-components.mjs', 'scripts/qa/run-local-team-read-components-ui.mjs',
  'scripts/qa/collect-local-ui-evidence.mjs', 'android/app/src/androidTest/java/be/sportgreenmoove/app/ui/SessionShutdownFlowTest.kt',
  'android/app/src/androidTest/java/be/sportgreenmoove/app/ui/LocalUiCapture.kt',
  ...['AppAccessGate.kt', 'SessionShutdownState.kt', 'AppSessionShutdown.kt'].map(file => 'android/app/src/main/java/be/sportgreenmoove/app/ui/' + file)];
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const snapshot = () => Object.fromEntries(sources.map(file => [file, sha(readFileSync(resolve(root, file)))]));
const sourceFiles = snapshot(); mkdirSync(directory);
assertLocalApkIdentity(resolve(root, 'android'), process.env.ANDROID_HOME); assertContinuousDevice(device, setup);
let transcript;
try {
  transcript = execFileSync(adb, ['-s', device.serial, 'shell', 'am', 'instrument', '-w', '-e', 'timeout_msec', '180000',
    ...installationGuardArguments(), '-e', 'class', 'be.sportgreenmoove.app.ui.SessionShutdownFlowTest',
    `be.sportgreenmoove.app.local.test/${disposableTestRunner}`], {encoding: 'utf8', timeout: 8 * 60_000, maxBuffer: 4 * 1024 * 1024});
  writeFileSync(resolve(directory, 'instrumentation.txt'), transcript, {flag: 'wx'});
  assertInstrumentationPassed(transcript, 3);
  collectLocalUiEvidence({adb, serial: device.serial, evidenceDir: directory, phase: 'session-shutdown', runId, password: randomBytes(24).toString('hex')});
  const screenshots = Object.fromEntries(['session-exit-narrow.png', 'session-exit-wide-dark.png']
    .map(file => [file, sha(readFileSync(resolve(directory, file)))]));
  assert.deepEqual(snapshot(), sourceFiles); assertContinuousDevice(device, setup);
  writeFileSync(resolve(directory, 'session-shutdown-results.json'), JSON.stringify({scope: 'isolated-session-exit-components-not-phone-or-delivery',
    projectId: 'demo-sgm-local-qa', runId, testedAt: new Date().toISOString(), componentCaseCount: 3, nativeUiExecuted: true,
    sourceFiles, screenshots, transcriptSha256: sha(Buffer.from(transcript)), setupReceiptSha256: sha(readFileSync(receiptPath)),
    physicalDevice: false, productionWrites: false, realMessagingSdkCalls: 0, pushDeliveryVerified: false,
    cleanupOwner: 'focused-shell-independent-restoration-receipt-required'}, null, 2) + '\n', {flag: 'wx'});
} catch (error) {
  if (!transcript && error.stdout) writeFileSync(resolve(directory, 'instrumentation-failed.txt'), String(error.stdout), {flag: 'wx'});
  throw error;
}
