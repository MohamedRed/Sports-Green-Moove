import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { seedLocalUiFixtures } from './local-ui-fixtures.mjs';
import { db, auth } from './local-flow-client.mjs';
import { withLocalAdminCleanup } from './local-admin-lifecycle.mjs';
import { assertInstrumentationPassed } from './android-instrumentation-result.mjs';
import { collectLocalUiEvidence } from './collect-local-ui-evidence.mjs';
import { resetDisposableLocalApps } from './reset-disposable-local-apps.mjs';
import { installDisposableTestApks, disposableTestRunner } from './install-disposable-test-apks.mjs';

const root = resolve(import.meta.dirname, '../..'), directory = process.env.SGM_LOCAL_UI_OUTPUT;
const serial = process.env.SGM_LOCAL_ANDROID_SERIAL;
assert(/^emulator-\d+$/.test(serial ?? ''));
const adb = `${process.env.ANDROID_HOME}/platform-tools/adb`;
const run = (command, args) => execFileSync(command, args, { env: process.env, encoding: 'utf8', timeout: 180_000, stdio: 'pipe' });
assert.equal(run(adb, ['-s', serial, 'shell', 'getprop', 'ro.kernel.qemu']).trim(), '1');
assert.equal(run(adb, ['-s', serial, 'emu', 'avd', 'name']).trim().split(/\r?\n/)[0], 'sgm_profile_city_20261024');
mkdirSync(directory);
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const sourcePaths = ['scripts/qa/profile-city-ui-suite.mjs', 'scripts/qa/run-profile-city-ui.mjs',
  'scripts/qa/collect-local-ui-evidence.mjs',
  'android/app/src/main/java/be/sportgreenmoove/app/data/ProfileCity.kt',
  'android/app/src/main/java/be/sportgreenmoove/app/services/FirebaseAndroidProfileCityGateway.kt',
  ...['State', 'Host', 'Dialog'].map(suffix => `android/app/src/main/java/be/sportgreenmoove/app/ui/ProfileCity${suffix}.kt`),
  ...['ProfileRoute.kt', 'ProfileScreen.kt', 'ProfileSettingsCard.kt', 'SportsGreenMooveApp.kt']
    .map(file => 'android/app/src/main/java/be/sportgreenmoove/app/ui/' + file),
  ...['FirebaseAndroidRuntime.kt', 'ProfileCityGateway.kt'].map(file => 'android/app/src/main/java/be/sportgreenmoove/app/services/' + file),
  ...['ProfileCityFlowTest.kt', 'LocalProfileCityFlowTest.kt'].map(file => 'android/app/src/androidTest/java/be/sportgreenmoove/app/ui/' + file)];
const sourceFiles = Object.fromEntries(sourcePaths.map(file => [file, sha(readFileSync(resolve(root, file)))]));
const apkHashes = Object.fromEntries(['apk/debug/app-debug.apk', 'apk/androidTest/debug/app-debug-androidTest.apk']
  .map(file => [file, sha(readFileSync(resolve(root, 'android/app/build/outputs', file)))]));
let result;
await withLocalAdminCleanup(async () => {
  const session = await seedLocalUiFixtures();
  const collections = ['users', 'children', 'clubs', 'teams', 'memberships', 'bookings', 'trips'];
  const snapshot = async () => Object.fromEntries(await Promise.all(collections.map(async name => [name,
    (await db.collection(name).get()).docs.map(doc => {
      const data = doc.data(); if (name === 'users') delete data.updatedAt;
      return { id: doc.id, data };
    }).sort((a, b) => a.id.localeCompare(b.id))])));
  const before = await snapshot();
  const claims = await Promise.all(['sgm-qa-parent', 'sgm-qa-driver'].map(async uid => (await auth.getUser(uid)).customClaims));
  let failure;
  try {
    resetDisposableLocalApps(adb, serial); installDisposableTestApks({ adb, serial, android: resolve(root, 'android'), run });
    run(process.execPath, [resolve(root, 'scripts/qa/install-local-ui-session.mjs'), serial, process.env.SGM_LOCAL_UI_SESSION_FILE]);
    for (const [name, cases] of [['ProfileCityFlowTest', 3], ['LocalProfileCityFlowTest', 1]]) {
      const transcript = run(adb, ['-s', serial, 'shell', 'am', 'instrument', '-w', '-r', '-e', 'timeout_msec', '120000',
        '-e', 'class', 'be.sportgreenmoove.app.ui.' + name, `be.sportgreenmoove.app.local.test/${disposableTestRunner}`]);
      writeFileSync(resolve(directory, name + '-instrumentation.txt'), transcript.replaceAll(session.password, '[REDACTED]'), { flag: 'wx' });
      assertInstrumentationPassed(transcript, cases);
    }
    collectLocalUiEvidence({ adb, serial, evidenceDir: directory, phase: 'profile-city', runId: session.runId, password: session.password });
    const marker = JSON.parse(readFileSync(resolve(directory, 'profile-city-device.json')));
    assert.equal(marker.runId, session.runId); assert.equal(marker.completed, true);
    const parent = (await db.collection('profileCities').doc('sgm-qa-parent').get()).data();
    const driver = (await db.collection('profileCities').doc('sgm-qa-driver').get()).data();
    assert.equal(parent.city, null); assert.equal(parent.revision, 2);
    assert.equal(driver.city, 'Namur'); assert.equal(driver.revision, 1);
    assert.deepEqual(await snapshot(), before);
    assert.deepEqual(await Promise.all(['sgm-qa-parent', 'sgm-qa-driver'].map(async uid => (await auth.getUser(uid)).customClaims)), claims);
    for (const [file, hash] of Object.entries(sourceFiles)) assert.equal(sha(readFileSync(resolve(root, file))), hash);
    const names = ['profile-city-editor-window.png', 'profile-city-editor.png', 'profile-city-saved.png', 'profile-city-restored.png',
      'profile-city-other-account.png', 'profile-city-removed.png'];
    result = { projectId: session.projectId, runId: session.runId, testedAt: new Date().toISOString(),
      scope: 'connected-isolated-android-profile-city-not-physical', connectedCases: 1, componentCases: 3,
      activityRecreation: true, fullProcessRestart: false, parentRevision: 2, driverRevision: 1,
      protectedRecordsUnchanged: true, claimsUnchanged: true, physicalDevice: false, productionWrites: false,
      providerRequests: 0, sourceFiles, apkHashes,
      screenshots: Object.fromEntries(names.map(name => [name, sha(readFileSync(resolve(directory, name)))])) };
  } catch (error) { failure = error; }
  finally {
    try { resetDisposableLocalApps(adb, serial); }
    catch (error) { failure = failure ? new AggregateError([failure, error], 'UI trial and package cleanup failed') : error; }
  }
  if (failure) throw failure;
}, { firestore: db });
writeFileSync(resolve(directory, 'results.json'), JSON.stringify({ ...result, localPackagesRemoved: true,
  adminClientClosed: true, firestoreClientTerminated: true, temporaryAdministrationUsed: false }, null, 2) + '\n', { flag: 'wx' });
console.log('Connected isolated profile-city case and three component cases passed; packages and clients closed.');
