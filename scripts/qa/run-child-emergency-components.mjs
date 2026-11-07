import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomBytes, createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve, isAbsolute } from 'node:path';
import { disposableAndroidShell } from './disposable-android-shell.mjs';
import { activateDisposableInstallations } from './activate-disposable-installations.mjs';
import { installDisposableTestApks, installationGuardArguments, disposableTestRunner } from './install-disposable-test-apks.mjs';
import { resetDisposableLocalApps } from './reset-disposable-local-apps.mjs';
import { restoreDisposableAndroid } from './restore-disposable-android.mjs';
import { collectLocalUiEvidence } from './collect-local-ui-evidence.mjs';
import { assertInstrumentationPassed } from './android-instrumentation-result.mjs';

const [receiptPath, directory] = process.argv.slice(2);
assert(isAbsolute(receiptPath) && isAbsolute(directory) && !existsSync(directory));
const setup = JSON.parse(readFileSync(receiptPath));
const device = disposableAndroidShell(), { serial } = device;
assert.equal(setup.serial, serial); assert.equal(setup.scope, 'disposable-emulator-without-home-navigation');
const root = resolve(import.meta.dirname, '../..'), android = resolve(root, 'android');
const adb = process.env.ANDROID_HOME ? `${process.env.ANDROID_HOME}/platform-tools/adb` : 'adb';
const run = (cmd, args) => execFileSync(cmd, args, { encoding: 'utf8', timeout: 120_000, stdio: 'pipe' });
const runId = randomBytes(16).toString('hex'), redaction = randomBytes(24).toString('hex');
const sources = ['scripts/qa/run-child-emergency-components.mjs', 'scripts/qa/collect-local-ui-evidence.mjs',
  'android/app/src/androidTest/java/be/sportgreenmoove/app/ui/ChildRideEmergencyFlowTest.kt',
  'android/app/src/androidTest/java/be/sportgreenmoove/app/ui/LocalUiCapture.kt',
  ...['ChildRideEmergencyRoute.kt', 'ChildRideEmergencyState.kt', 'EmergencyContactRoute.kt', 'EmergencyContactScreen.kt']
    .map((file) => 'android/app/src/main/java/be/sportgreenmoove/app/ui/' + file)];
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const sourceFiles = Object.fromEntries(sources.map((file) => [file, sha(readFileSync(resolve(root, file)))]));
const apkHashes = Object.fromEntries(['apk/debug/app-debug.apk', 'apk/androidTest/debug/app-debug-androidTest.apk']
  .map((file) => [file, sha(readFileSync(resolve(android, 'app/build/outputs', file)))]));
mkdirSync(directory); writeFileSync(resolve(directory, 'device-setup.json'), JSON.stringify(setup, null, 2) + '\n');
let transcript, failure, restored, screenshots;
try {
  const activated = activateDisposableInstallations(device, setup);
  writeFileSync(resolve(directory, 'device-activated.json'), JSON.stringify(activated, null, 2) + '\n');
  resetDisposableLocalApps(adb, serial); installDisposableTestApks({ adb, serial, android, run });
  transcript = execFileSync(adb, ['-s', serial, 'shell', 'am', 'instrument', '-w', '-e', 'timeout_msec', '180000',
    ...installationGuardArguments(), '-e', 'class', 'be.sportgreenmoove.app.ui.ChildRideEmergencyFlowTest',
    `be.sportgreenmoove.app.local.test/${disposableTestRunner}`], { encoding: 'utf8', timeout: 8 * 60_000, maxBuffer: 4 * 1024 * 1024 });
  writeFileSync(resolve(directory, 'instrumentation.txt'), transcript, { flag: 'wx' });
  assertInstrumentationPassed(transcript, 5);
  collectLocalUiEvidence({ adb, serial, evidenceDir: directory, phase: 'child-emergency-components', runId, password: redaction });
  const names = ['child-emergency-readonly-narrow', 'child-emergency-access-denied', 'child-emergency-landscape-changed']
    .flatMap((name) => [name + '.png', name + '-window.png']).sort();
  assert.deepEqual(readdirSync(directory).filter((file) => file.endsWith('.png')).sort(), names);
  screenshots = Object.fromEntries(names.map((name) => [name, sha(readFileSync(resolve(directory, name)))]));
  for (const [file, hash] of Object.entries(sourceFiles)) assert.equal(sha(readFileSync(resolve(root, file))), hash, 'Source changed during execution');
} catch (error) {
  failure = error;
  if (!transcript && error.stdout) writeFileSync(resolve(directory, 'instrumentation-failed.txt'), String(error.stdout), { flag: 'wx' });
  try { collectLocalUiEvidence({ adb, serial, evidenceDir: directory, phase: 'failure-cleanup', runId, password: redaction }); }
  catch { console.warn('Partial captures unavailable; original component failure preserved.'); }
}
try { resetDisposableLocalApps(adb, serial); }
catch (error) { failure = failure ? new AggregateError([failure, error], 'Component test and local package cleanup failed') : error; }
try {
  restored = restoreDisposableAndroid(device, setup);
  writeFileSync(resolve(directory, 'device-restored.json'), JSON.stringify(restored, null, 2) + '\n');
  assert.equal(restored.restored, true); assert.equal(restored.verified, true);
  assert.equal(restored.installAdmin?.authorizationRemoved, true); assert.equal(restored.installAdmin?.componentRemoved, true);
} catch (error) { failure = failure ? new AggregateError([failure, error], 'Component test and device restoration failed') : error; }
if (failure) throw failure;
writeFileSync(resolve(directory, 'results.json'), JSON.stringify({ projectId: 'demo-sgm-local-qa', runId,
  testedAt: new Date().toISOString(), scope: 'local-native-components-with-fixture-callbacks-not-child-signin-or-dialer',
  componentCaseCount: 5, actualChildSignIn: false, connectedBackend: false, dialerOpened: false,
  physicalDevice: false, productionWrites: false, devicePolicyRestored: true, localPackagesRemoved: true,
  transcriptSha256: sha(Buffer.from(transcript)), screenshots, sourceFiles, apkHashes }, null, 2) + '\n', { flag: 'wx' });
console.log('Five child-contact component cases passed; actual child sign-in, connected route and dialer remain unverified.');
