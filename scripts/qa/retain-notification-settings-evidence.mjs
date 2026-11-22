import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, resolve } from 'node:path';
import net from 'node:net';
import { XMLParser } from 'fast-xml-parser';

const [trial, apk, destination] = process.argv.slice(2);
assert([trial, apk, destination].every(path => isAbsolute(path ?? ''))); assert(!existsSync(destination));
mkdirSync(destination, {recursive: true});
const bytes = file => readFileSync(file), sha = data => createHash('sha256').update(data).digest('hex');
const write = (file, value) => { mkdirSync(dirname(resolve(destination, file)), {recursive: true});
  writeFileSync(resolve(destination, file), JSON.stringify(value, null, 2) + '\n'); };
const copy = (source, file) => { mkdirSync(dirname(resolve(destination, file)), {recursive: true}); copyFileSync(source, resolve(destination, file)); };
const session = JSON.parse(bytes(resolve(trial, 'checkpoints/session-results.json')));
assert.equal(session.completed, true); assert.equal(session.originalRecordCount, 158);
for (const file of readdirSync(resolve(trial, 'checkpoints'))) copy(resolve(trial, 'checkpoints', file), 'phone/' + file);
for (const [file, hash] of Object.entries(session.sourceFiles)) { assert.equal(sha(bytes(file)), hash); copy(file, 'source/' + file); }
const captures = ['profile-blocked', 'os-blocked', 'os-allowed', 'profile-allowed', 'options-allowed', 'os-restored', 'options-blocked', 'profile-restored'];
for (const name of captures) copy(resolve(trial, name + '.jpg'), 'captures/' + name + '.jpg');
for (const file of ['recording-unavailable.jpg', 'cleanup-signed-out.jpg', 'cleanup-uninstall-acknowledged.jpg', 'cleanup-launcher-absent.jpg', 'cleanup-session-stopped.jpg'])
  copy(resolve(trial, file), 'phone/' + file);
const sources = ['android/app/src/test/java/be/sportgreenmoove/app/ui/NotificationSettingsStateTest.kt',
  'android/app/src/androidTest/java/be/sportgreenmoove/app/ui/NotificationSettingsFlowTest.kt',
  'android/app/src/androidTest/java/be/sportgreenmoove/app/services/AndroidNotificationSettingsTest.kt',
  'tests/notification-settings-contract.test.mjs'];
for (const file of sources) copy(file, 'source/' + file);
for (const file of ['ui/ProfileScreen.kt', 'ui/OptionsScreen.kt']) {
  const path = 'android/app/src/main/java/be/sportgreenmoove/app/' + file;
  const original = execFileSync('git', ['show', 'HEAD:' + path]);
  mkdirSync(dirname(resolve(destination, 'red/' + file)), {recursive: true}); writeFileSync(resolve(destination, 'red/' + file), original);
}
copy('/private/tmp/sgm-notification-settings-red-20261023.txt', 'red/contract-transcript.txt');
copy('/private/tmp/sgm-notification-settings-build-20261023.txt', 'validation/android-build.txt');
copy('/private/tmp/sgm-notification-settings-local-build-20261023.txt', 'validation/local-apk-build.txt');
for (const name of ['contract-tests', 'root-tests', 'root-tests-after-cleanup']) copy(resolve(trial, name + '.txt'), 'validation/' + name + '.txt');
const parser = new XMLParser({ignoreAttributes: false}), units = [];
const unitDir = 'android/app/build/test-results/testDebugUnitTest';
for (const file of readdirSync(unitDir).filter(name => name.endsWith('.xml'))) {
  const suite = parser.parse(bytes(resolve(unitDir, file))).testsuite;
  units.push({file, tests: Number(suite['@_tests']), failures: Number(suite['@_failures']), errors: Number(suite['@_errors']), skipped: Number(suite['@_skipped'])});
  copy(resolve(unitDir, file), 'validation/unit/' + file);
}
assert.equal(units.reduce((n, row) => n + row.tests, 0), 504);
assert(units.every(row => row.failures === 0 && row.errors === 0 && row.skipped === 0));
write('validation/unit-results.json', units);
assert(!existsSync(resolve(trial, 'session.json')));
const ports = [5001, 8080, 9000, 9099, 45690, 45691];
for (const port of ports) await new Promise((done, reject) => {
  const socket = net.connect({port, host: '127.0.0.1'});
  socket.once('connect', () => {socket.destroy(); reject(new Error('Owned test endpoint remains open'));});
  socket.once('error', error => error.code === 'ECONNREFUSED' ? done() : reject(error));
});
write('cleanup.json', {checkedAt: new Date().toISOString(), backendExitCode: 130, helperExitCode: 130,
  credentialRemoved: true, helperDirectoryRemoved: true, portsClosed: ports, phoneSignedOut: true,
  appUninstallAcknowledged: true, launcherAbsenceObserved: true, phoneSessionStopped: true,
  notificationAllowedInitially: false, notificationAllowedFinally: false, notificationFlagsMeasured: false,
  globalPhoneSettingsChanged: false, administrationPolicyChanged: false, chromeRestarted: false});
write('observations.json', {scope: 'operator-observed-physical-ui-not-an-automated-device-event-trace',
  steps: ['profile-blocked', 'open-app-notification-settings-from-profile', 'allow-on-test-phone', 'profile-resume-allowed',
    'options-allowed', 'open-app-notification-settings-from-options', 'block-on-test-phone', 'options-resume-blocked', 'profile-restored'],
  captureGeometry: {portrait: {x:649,y:112,width:254,height:559}, options: {x:660,y:464,width:230,height:132}},
  manualAppRestartRequested: false, processIdsMeasured: false, unrelatedAppsChanged: false});
const config = bytes('android/app/build/generated/source/buildConfig/debug/be/sportgreenmoove/app/BuildConfig.java').toString();
assert.match(config, /SGM_USE_FIREBASE_EMULATOR = true/); assert.match(config, /SGM_FIREBASE_EMULATOR_HOST = "localhost"/);
assert.match(config, /SGM_LOCAL_REAL_MAPS_UI = false/);
write('summary.json', {checkedAt: '2026-10-23', scope: 'physical-android-notification-permission-with-isolated-account',
  sourceBaseCommit: execFileSync('git', ['rev-parse', 'HEAD'], {encoding:'utf8'}).trim(), sourceWasDirtyDuringPhoneTrial: true,
  apkSha256: sha(bytes(apk)), device: 'Google Pixel 9 Pro', androidVersion: '15.0', projectId: session.projectId, runId: session.runId,
  accountIntegrityCheckpoints: 4, originalRecordsUnchanged: 158, unitsPassed: 504, notificationStateUnitsPassed: 7,
  nativeTestsAdded: 7, nativeTestApkBuilt: true, newNativeTestsExecuted: false, actualPhonePermissionFlowPassed: true,
  publishedCaptures: ['profile-blocked', 'os-blocked', 'os-allowed', 'profile-allowed', 'options-blocked', 'profile-restored'],
  appPermissionOnly: true, pushDeliveryAccepted: false, realNotificationSent: false, processSurvivalAccepted: false,
  iosAccepted: false, productionWrites: false, realPaymentExercised: false, videoAccepted: false, releaseComplete: false});
const hashes = {};
function hashFiles(folder = '') {
  for (const entry of readdirSync(resolve(destination, folder), {withFileTypes: true})) {
    const file = folder ? folder + '/' + entry.name : entry.name;
    if (entry.isDirectory()) hashFiles(file); else hashes[file] = sha(bytes(resolve(destination, file)));
  }
}
hashFiles(); write('artifact-sha256.json', hashes);
console.log('Notification permission trial retained with separate unit, build, phone and cleanup scopes.');
