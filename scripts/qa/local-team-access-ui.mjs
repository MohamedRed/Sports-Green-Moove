import assert from 'node:assert/strict';
import { promisify } from 'node:util';
import { execFile, execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { deleteApp, getApp } from 'firebase-admin/app';
import { seedLocalUiFixtures } from './local-ui-fixtures.mjs';
import { prepareTeamChatAccessUiFixture } from './team-chat-access-ui-fixture.mjs';
import { verifyTeamAccessNativeRecords } from './team-access-native-records.mjs';
import { validateTeamAccessNativeDevice } from './team-access-native-evidence.mjs';
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
let session, fixture, marker, transcript, failure, isolation, apkPreparation;
try {
  session = await seedLocalUiFixtures(); fixture = await prepareTeamChatAccessUiFixture();
  session.teamChat = { clubId: fixture.clubId, teamId: fixture.teamId, childId: fixture.childId, teamInstanceId: fixture.target.expectedTeamInstanceId };
  session.teamAccess = { secondChildId: fixture.secondChildId, otherTeamId: fixture.otherTeamId,
    otherTeamInstanceId: fixture.otherTarget.expectedTeamInstanceId };
  writeFileSync(process.env.SGM_LOCAL_UI_SESSION_FILE, JSON.stringify(session), { mode: 0o600 });
  if (!usePreinstalledTestApks()) {
    const build = await execute(resolve(android, 'gradlew'), ['-p', android, ':app:assembleDebug', ':app:assembleDebugAndroidTest',
      '-PSGM_USE_FIREBASE_EMULATOR=true', '--no-daemon', '--max-workers=2'], { env: process.env, cwd: root, timeout: 20 * 60_000, maxBuffer: 4 * 1024 * 1024 });
    process.stdout.write(build.stdout); process.stderr.write(build.stderr);
  }
  apkPreparation = prepareDisposableTestApks({ adb, serial, android, run });
  run(process.execPath, [resolve(import.meta.dirname, 'install-local-ui-session.mjs'), serial, process.env.SGM_LOCAL_UI_SESSION_FILE]);
  const result = await execute(adb, ['-s', serial, 'shell', 'am', 'instrument', '-w', '-e', 'timeout_msec', '480000',
    ...installationGuardArguments(), '-e', 'class', 'be.sportgreenmoove.app.ui.LocalTeamAccessFlowTest',
    `be.sportgreenmoove.app.local.test/${disposableTestRunner}`], { encoding: 'utf8', timeout: 10 * 60_000, maxBuffer: 4 * 1024 * 1024 });
  transcript = result.stdout.replaceAll(session.password, '[REDACTED]'); console.log(transcript);
  writeFileSync(resolve(directory, 'LocalTeamAccessFlowTest-instrumentation.txt'), transcript, { flag: 'wx' });
  assertInstrumentationPassed(transcript, 1);
  const receipt = collectLocalUiEvidence({ adb, serial, evidenceDir: directory, phase: 'team-access', runId: session.runId, password: session.password });
  marker = JSON.parse(readFileSync(resolve(directory, 'team-access-device.json')));
  validateTeamAccessNativeDevice(marker, receipt, session.runId, file => readFileSync(resolve(directory, file)));
  isolation = await verifyTeamAccessNativeRecords(fixture, marker);
} catch (error) {
  failure = new Error(String(error.message ?? 'Connected team access trial failed').replaceAll(process.env.SGM_QA_PASSWORD, '[REDACTED]'));
  if (session && !transcript && typeof error.stdout === 'string' && error.stdout) {
    transcript = error.stdout.replaceAll(session.password, '[REDACTED]');
    writeFileSync(resolve(directory, 'LocalTeamAccessFlowTest-instrumentation.txt'), transcript, { flag: 'wx' });
  }
  if (session) {
    try { collectLocalUiEvidence({ adb, serial, evidenceDir: directory, phase: 'failure-cleanup', runId: session.runId, password: session.password }); }
    catch { console.warn('Partial team access captures unavailable.'); }
    try { collectNativeProcessFailure({ adb, serial, directory, label: 'LocalTeamAccessFlowTest', password: session.password, runId: session.runId }); }
    catch { console.warn('Process diagnostics unavailable; original failure preserved.'); }
  }
}
try { await deleteApp(getApp()); }
catch (error) { failure = failure ? new AggregateError([failure, error], 'Trial and admin client shutdown failed') : error; }
try { resetDisposableLocalApps(adb, serial); }
catch (error) { failure = failure ? new AggregateError([failure, error], 'Trial and local package cleanup failed') : error; }
if (failure) throw failure;
const paths = [...disposableApkSourceFiles, 'scripts/qa/local-team-access-ui.mjs', 'scripts/qa/run-local-team-access-ui.mjs',
  'scripts/qa/run-isolated-ride-ui.mjs', 'scripts/qa/team-chat-access-ui-fixture.mjs', 'scripts/qa/team-conversation-ui-fixture.mjs',
  'scripts/qa/team-access-native-records.mjs', 'scripts/qa/team-access-native-evidence.mjs',
  'functions/src/services/teamConversation.ts', 'functions/src/services/teamConversationAuthority.ts',
  'functions/src/services/teamConversationOptions.ts', 'functions/src/services/guardianVerification.ts',
  ...['TeamConversationDirectory.kt', 'TeamConversationRoute.kt', 'TeamConversationScreen.kt', 'TeamConversationState.kt']
    .map(file => 'android/app/src/main/java/be/sportgreenmoove/app/ui/' + file),
  'android/app/src/main/java/be/sportgreenmoove/app/services/FirebaseAndroidTeamConversationGateway.kt',
  'android/app/src/main/java/be/sportgreenmoove/app/services/TeamConversationWire.kt',
  ...['LocalTeamAccessFlowTest.kt', 'LocalTeamChatPeer.kt', 'LocalTeamChatUi.kt', 'NativeTeamMessageInput.kt', 'InputWindowReadiness.kt', 'LocalComposeRule.kt']
    .map(file => 'android/app/src/androidTest/java/be/sportgreenmoove/app/ui/' + file)];
writeFileSync(resolve(directory, 'team-access-app-results.json'), JSON.stringify({ ...marker, testedAt: new Date().toISOString(),
  testCount: 1, nativeCaseCount: 1, steps: [{ id: 'team-access-connected-native-ui', status: 'passed' }], nativeUiExecuted: true,
  apkPreparation, primaryEvidencePhase: 'team-access', transcriptSha256: createHash('sha256').update(transcript).digest('hex'),
  cleanupMode: 'destroy-owned-local-environment', adminClientClosed: true, localPackagesRemoved: true, fixtureIsolation: isolation,
  productionWrites: false, physicalDevice: false, notificationsVerified: false, fullProcessRestartProven: false, externalSdkTrafficVerified: false,
  guardianRenewalThroughSdkNotUi: true,
  sourceFiles: Object.fromEntries(paths.map(file => [file, createHash('sha256').update(readFileSync(resolve(root, file))).digest('hex')]))
}, null, 2) + '\n', { flag: 'wx' });
