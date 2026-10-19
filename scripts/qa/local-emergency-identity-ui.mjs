import assert from 'node:assert/strict';
import { promisify } from 'node:util';
import { execFile, execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { deleteApp, getApp } from 'firebase-admin/app';
import { seedLocalUiFixtures } from './local-ui-fixtures.mjs';
import { prepareEmergencyIdentityFixture, recreateEmergencyIdentity, verifyEmergencyIdentityParent,
  verifyEmergencyIdentityStoredState } from './emergency-identity-fixture.mjs';
import { resetDisposableLocalApps } from './reset-disposable-local-apps.mjs';
import { installDisposableTestApks, installationGuardArguments, disposableTestRunner } from './install-disposable-test-apks.mjs';
import { collectLocalUiEvidence } from './collect-local-ui-evidence.mjs';
import { collectNativeProcessFailure } from './native-process-failure-evidence.mjs';
import { assertInstrumentationPassed } from './android-instrumentation-result.mjs';
import { runEmergencyIdentityExchange } from './emergency-identity-exchange.mjs';
import { validateEmergencyIdentityDevice } from './emergency-identity-ui-evidence.mjs';

const root = resolve(import.meta.dirname, '../..'), android = resolve(root, 'android');
const serial = process.env.SGM_LOCAL_ANDROID_SERIAL; assert.match(serial, /^emulator-\d+$/);
const adb = process.env.ANDROID_HOME ? `${process.env.ANDROID_HOME}/platform-tools/adb` : 'adb';
const execute = promisify(execFile), directory = process.env.SGM_LOCAL_UI_OUTPUT;
const run = (cmd, args) => execFileSync(cmd, args, { cwd: root, env: process.env, stdio: 'inherit', timeout: 120_000 });
mkdirSync(directory, { recursive: true });
let session, fixture, marker, transcript, failure, isolation;
try {
  session = await seedLocalUiFixtures(); fixture = await prepareEmergencyIdentityFixture();
  const build = await execute(resolve(android, 'gradlew'), ['-p', android, ':app:assembleDebug', ':app:assembleDebugAndroidTest',
    '-PSGM_USE_FIREBASE_EMULATOR=true', '--no-daemon', '--max-workers=2'], { env: process.env, cwd: root, timeout: 20 * 60_000, maxBuffer: 4 * 1024 * 1024 });
  process.stdout.write(build.stdout); process.stderr.write(build.stderr);
  resetDisposableLocalApps(adb, serial); installDisposableTestApks({ adb, serial, android, run });
  run(process.execPath, [resolve(import.meta.dirname, 'install-local-ui-session.mjs'), serial, process.env.SGM_LOCAL_UI_SESSION_FILE]);
  transcript = await runEmergencyIdentityExchange({ adb, serial, runId: session.runId,
    args: ['shell', 'am', 'instrument', '-w', '-e', 'timeout_msec', '360000', ...installationGuardArguments(), '-e', 'class',
      'be.sportgreenmoove.app.ui.LocalEmergencyIdentityFlowTest', '-e', 'emergencyVerificationId', fixture.verificationId,
      `be.sportgreenmoove.app.local.test/${disposableTestRunner}`],
    onRecreate: () => recreateEmergencyIdentity(fixture), onVerify: () => verifyEmergencyIdentityParent(fixture) });
  transcript = transcript.replaceAll(session.password, '[REDACTED]'); console.log(transcript);
  writeFileSync(resolve(directory, 'LocalEmergencyIdentityFlowTest-instrumentation.txt'), transcript, { flag: 'wx' });
  assertInstrumentationPassed(transcript, 1);
  const receipt = collectLocalUiEvidence({ adb, serial, evidenceDir: directory, phase: 'emergency-identity',
    runId: session.runId, password: session.password });
  marker = JSON.parse(readFileSync(resolve(directory, 'emergency-identity-device.json')));
  validateEmergencyIdentityDevice(marker, receipt, session.runId, (file) => readFileSync(resolve(directory, file)));
  isolation = await verifyEmergencyIdentityStoredState(fixture);
} catch (error) {
  failure = error;
  if (session && !transcript && typeof error.stdout === 'string' && error.stdout) {
    transcript = error.stdout.replaceAll(session.password, '[REDACTED]'); console.log(transcript);
    writeFileSync(resolve(directory, 'LocalEmergencyIdentityFlowTest-instrumentation.txt'), transcript, { flag: 'wx' });
  }
  if (session) {
    try { collectNativeProcessFailure({ adb, serial, directory, label: 'LocalEmergencyIdentityFlowTest', password: session.password, runId: session.runId }); }
    catch { console.warn('Read-only process diagnostics unavailable; original failure preserved.'); }
  }
}
try { await deleteApp(getApp()); }
catch (error) { failure = failure ? new AggregateError([failure, error], 'Trial and admin client shutdown failed') : error; }
try { resetDisposableLocalApps(adb, serial); }
catch (error) { failure = failure ? new AggregateError([failure, error], 'Trial and local package cleanup failed') : error; }
if (failure) throw failure;
const paths = ['scripts/qa/local-emergency-identity-ui.mjs', 'scripts/qa/run-local-emergency-identity-ui.mjs',
  'scripts/qa/run-isolated-ride-ui.mjs', 'scripts/qa/emergency-identity-fixture.mjs', 'scripts/qa/emergency-identity-exchange.mjs',
  'scripts/qa/emergency-identity-ui-evidence.mjs', 'scripts/qa/local-emergency-native-fixture.mjs',
  'functions/src/domain/emergencyContact.ts', 'functions/src/services/emergencyContactAuthority.ts',
  'functions/src/services/emergencyContact.ts', 'functions/src/services/guardianVerification.ts',
  ...['EmergencyContactRoute.kt', 'EmergencyContactState.kt', 'EmergencyContactScreen.kt', 'EmergencyContactDialogs.kt']
    .map((file) => 'android/app/src/main/java/be/sportgreenmoove/app/ui/' + file),
  ...['LocalEmergencyIdentityFlowTest.kt', 'LocalComposeRule.kt'].map((file) => 'android/app/src/androidTest/java/be/sportgreenmoove/app/ui/' + file)];
writeFileSync(resolve(directory, 'emergency-identity-app-results.json'), JSON.stringify({ ...marker, testedAt: new Date().toISOString(),
  testCount: 1, nativeCaseCount: 1, steps: [{ id: 'recreated-child-emergency-contact-ui', status: 'passed' }], nativeUiExecuted: true,
  primaryEvidencePhase: 'emergency-identity', transcriptSha256: createHash('sha256').update(transcript).digest('hex'),
  cleanupMode: 'destroy-owned-local-environment', adminClientClosed: true, localPackagesRemoved: true, fixtureIsolation: isolation,
  productionWrites: false, safetyAuditAccepted: false, storeReviewAccepted: false, childOwnAccountDialImplemented: false,
  fullProcessRestartProven: false, providerRequests: 0,
  sourceFiles: Object.fromEntries(paths.map((file) => [file, createHash('sha256').update(readFileSync(resolve(root, file))).digest('hex')]))
}, null, 2) + '\n', { flag: 'wx' });
