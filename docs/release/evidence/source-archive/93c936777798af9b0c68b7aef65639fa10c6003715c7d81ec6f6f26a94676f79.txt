import assert from 'node:assert/strict';
import { promisify } from 'node:util';
import { execFile, execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { deleteApp, getApp } from 'firebase-admin/app';
import { getDatabase } from 'firebase-admin/database';
import { seedLocalUiFixtures } from './local-ui-fixtures.mjs';
import { auth, db, call, signIn } from './local-flow-client.mjs';
import { snapshotSessionRestorationRecords, verifySessionRestorationRecords } from './session-restoration-records.mjs';
import { openSessionRestorationFaultProxy } from './session-restoration-fault-proxy.mjs';
import { resetDisposableLocalApps } from './reset-disposable-local-apps.mjs';
import { prepareDisposableTestApks, usePreinstalledTestApks, installationGuardArguments, disposableTestRunner, disposableApkSourceFiles } from './install-disposable-test-apks.mjs';
import { collectLocalUiEvidence } from './collect-local-ui-evidence.mjs';
import { collectNativeProcessFailure } from './native-process-failure-evidence.mjs';
import { assertInstrumentationPassed } from './android-instrumentation-result.mjs';

const root = resolve(import.meta.dirname, '../..'), android = resolve(root, 'android');
const serial = process.env.SGM_LOCAL_ANDROID_SERIAL; assert.match(serial, /^emulator-\d+$/);
const adb = process.env.ANDROID_HOME ? `${process.env.ANDROID_HOME}/platform-tools/adb` : 'adb';
const execute = promisify(execFile), directory = process.env.SGM_LOCAL_UI_OUTPUT;
const run = (cmd, args) => execFileSync(cmd, args, { cwd: root, env: process.env, stdio: 'inherit', timeout: 120_000 });
mkdirSync(directory, { recursive: true });
let session, marker, transcript, failure, isolation, apkPreparation, proxy;
try {
  session = await seedLocalUiFixtures();
  await call('initializeUserProfile', await signIn(session.parent));
  const baseline = await snapshotSessionRestorationRecords(db, auth, getDatabase());
  if (!usePreinstalledTestApks()) {
    const build = await execute(resolve(android, 'gradlew'), ['-p', android, ':app:assembleDebug', ':app:assembleDebugAndroidTest',
      '-PSGM_USE_FIREBASE_EMULATOR=true', '--no-daemon', '--max-workers=2'], { env: process.env, cwd: root, timeout: 20 * 60_000, maxBuffer: 4 * 1024 * 1024 });
    process.stdout.write(build.stdout); process.stderr.write(build.stderr);
  }
  apkPreparation = prepareDisposableTestApks({ adb, serial, android, run });
  run(process.execPath, [resolve(import.meta.dirname, 'install-local-ui-session.mjs'), serial, process.env.SGM_LOCAL_UI_SESSION_FILE]);
  proxy = await openSessionRestorationFaultProxy({ origin: process.env.FUNCTIONS_EMULATOR_ORIGIN,
    runId: session.runId, uid: 'sgm-qa-parent' }, { verifyIdentity: token => auth.verifyIdToken(token) });
  ({ stdout: transcript } = await execute(adb, ['-s', serial, 'shell', 'am', 'instrument', '-w', '-e', 'timeout_msec', '240000',
    ...installationGuardArguments(), '-e', 'class', 'be.sportgreenmoove.app.ui.LocalSessionRestorationTest',
    '-e', 'sessionFaultPort', String(proxy.port), `be.sportgreenmoove.app.local.test/${disposableTestRunner}`],
  { env: process.env, encoding: 'utf8', timeout: 8 * 60_000, maxBuffer: 4 * 1024 * 1024 }));
  transcript = transcript.replaceAll(session.password, '[REDACTED]'); console.log(transcript);
  writeFileSync(resolve(directory, 'LocalSessionRestorationTest-instrumentation.txt'), transcript, { flag: 'wx' });
  assertInstrumentationPassed(transcript, 1);
  collectLocalUiEvidence({ adb, serial, evidenceDir: directory, phase: 'session-restoration', runId: session.runId, password: session.password });
  marker = JSON.parse(readFileSync(resolve(directory, 'local-session-restoration-device.json')));
  assert.equal(marker.scope, 'local-session-restoration-ui-not-physical-network-loss');
  assert.equal(marker.runId, session.runId); assert.equal(marker.projectId, 'demo-sgm-local-qa');
  assert.equal(marker.uid, 'sgm-qa-parent'); assert.equal(marker.restorationAttempts, 4);
  for (const key of ['initialFailureVisible', 'failureSurvivedRotation', 'explicitRetryRecoveredSameParent',
    'healthyRotationRestoredSameParent', 'profileIdentityVerified', 'orientationRestored', 'parentSignedOut',
    'firestoreClientTerminated', 'completed']) assert.equal(marker[key], true, key);
  for (const key of ['physicalDevice', 'realNetworkLossVerified']) assert.equal(marker[key], false);
  assert.deepEqual(Object.keys(marker.screenshots).sort(), ['error', 'rotated-error', 'recovered', 'restored', 'identity']
    .map(id => `local-session-restoration-${id}.png`).sort());
  for (const [name, hash] of Object.entries(marker.screenshots))
    assert.equal(createHash('sha256').update(readFileSync(resolve(directory, name))).digest('hex'), hash);
  assert.equal(proxy.receipt.failed, undefined); assert.equal(proxy.receipt.phase, 'recover');
  assert.deepEqual(proxy.receipt.transitions, [{ from: 'reject', to: 'recover' }]);
  const restoration = proxy.receipt.attempts.filter(item => item.method === 'initializeUserProfile');
  assert.deepEqual(restoration.map(item => item.downstreamStatus), [503, 503, 200, 200]);
  assert(proxy.receipt.attempts.every(item => item.uid === 'sgm-qa-parent'));
  writeFileSync(resolve(directory, 'session-restoration-proxy.json'), JSON.stringify(proxy.receipt, null, 2) + '\n', { flag: 'wx' });
  isolation = verifySessionRestorationRecords(baseline, await snapshotSessionRestorationRecords(db, auth, getDatabase()));
} catch (error) {
  failure = error;
  if (session) {
    try { collectNativeProcessFailure({ adb, serial, directory, label: 'LocalSessionRestorationTest', password: session.password, runId: session.runId }); }
    catch { console.warn('Read-only diagnostics unavailable; original failure preserved.'); }
    if (spawnSync(adb, ['-s', serial, 'shell', 'test', '-d', '/sdcard/Android/data/be.sportgreenmoove.app.local/files/local-ui-evidence'], { timeout: 15_000 }).status === 0) {
      try { collectLocalUiEvidence({ adb, serial, evidenceDir: directory, phase: 'failure-cleanup', runId: session.runId, password: session.password }); }
      catch { console.warn('Partial evidence unavailable; original failure preserved.'); }
    }
    if (proxy) writeFileSync(resolve(directory, 'session-restoration-proxy-failed.json'), JSON.stringify(proxy.receipt, null, 2) + '\n');
  }
}
for (const [label, cleanup] of [
  ['proxy shutdown', async () => { if (proxy) await proxy.close(); }],
  ['admin shutdown', () => deleteApp(getApp())],
  ['local package cleanup', () => resetDisposableLocalApps(adb, serial)],
]) {
  try { await cleanup(); }
  catch (error) { failure = failure ? new AggregateError([failure, error], `Trial and ${label} failed`) : error; }
}
if (failure) throw failure;
const paths = [...disposableApkSourceFiles,
  ...['local-session-restoration-ui.mjs', 'run-local-session-restoration-ui.mjs', 'session-restoration-fault-proxy.mjs',
    'session-restoration-records.mjs', 'run-isolated-ride-ui.mjs', 'local-emulator-lifecycle.mjs', 'local-ui-fixtures.mjs']
    .map(file => 'scripts/qa/' + file),
  'functions/src/callables/adminUsers.ts',
  'android/app/src/main/java/be/sportgreenmoove/app/services/FirebaseAndroidRuntime.kt',
  ...['SessionRestoration.kt', 'SessionRestorationState.kt', 'SportsGreenMooveApp.kt', 'AppDataState.kt', 'AppSessionShutdown.kt']
    .map(file => 'android/app/src/main/java/be/sportgreenmoove/app/ui/' + file),
  ...['LocalSessionRestorationTest.kt', 'LocalUiCapture.kt'].map(file => 'android/app/src/androidTest/java/be/sportgreenmoove/app/ui/' + file)];
writeFileSync(resolve(directory, 'session-restoration-app-results.json'), JSON.stringify({ ...marker,
  testedAt: new Date().toISOString(), testCount: 1, nativeCaseCount: 1, steps: [{ id: 'session-restoration', status: 'passed' }],
  nativeUiExecuted: true, apkPreparation, primaryEvidencePhase: 'session-restoration',
  transcriptSha256: createHash('sha256').update(transcript).digest('hex'),
  cleanupMode: 'destroy-owned-local-environment', proxyClosed: true, adminClientClosed: true, localPackagesRemoved: true,
  fixtureIsolation: isolation, productionWrites: false, safetyAuditAccepted: false, storeReviewAccepted: false,
  sourceFiles: Object.fromEntries(paths.map(file => [file, createHash('sha256').update(readFileSync(resolve(root, file))).digest('hex')]))
}, null, 2) + '\n', { flag: 'wx' });
