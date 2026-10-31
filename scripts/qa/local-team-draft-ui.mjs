import assert from 'node:assert/strict';
import { promisify } from 'node:util';
import { execFile, execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { deleteApp, getApp } from 'firebase-admin/app';
import { seedLocalUiFixtures } from './local-ui-fixtures.mjs';
import { prepareTeamChatUiFixture } from './team-conversation-ui-fixture.mjs';
import { verifyTeamDraftRecords } from './team-draft-native-records.mjs';
import { validateTeamDraftBefore, validateTeamDraftRestart } from './team-draft-restart-evidence.mjs';
import { stopDisposableAppProcess } from './local-disposable-process-stop.mjs';
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
const read = name => readFileSync(resolve(directory, name)), json = name => JSON.parse(read(name));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
mkdirSync(directory, { recursive: true });
let session, fixture, marker, failure, isolation, apkPreparation, unsent, firstStop, secondStop;
const transcripts = {};
try {
  session = await seedLocalUiFixtures(); fixture = await prepareTeamChatUiFixture();
  session.teamChat = { clubId: fixture.clubId, teamId: fixture.teamId, teamInstanceId: fixture.target.expectedTeamInstanceId };
  writeFileSync(process.env.SGM_LOCAL_UI_SESSION_FILE, JSON.stringify(session), { mode: 0o600 });
  if (!usePreinstalledTestApks()) {
    const build = await execute(resolve(android, 'gradlew'), ['-p', android, ':app:assembleDebug', ':app:assembleDebugAndroidTest',
      '-PSGM_USE_FIREBASE_EMULATOR=true', '--no-daemon', '--max-workers=2'], { env: process.env, cwd: root, timeout: 20 * 60_000, maxBuffer: 4 * 1024 * 1024 });
    process.stdout.write(build.stdout); process.stderr.write(build.stderr);
  }
  apkPreparation = prepareDisposableTestApks({ adb, serial, android, run });
  run(process.execPath, [resolve(import.meta.dirname, 'install-local-ui-session.mjs'), serial, process.env.SGM_LOCAL_UI_SESSION_FILE]);
  async function instrument(method) {
    let stdout, commandFailure;
    try { ({ stdout } = await execute(adb, ['-s', serial, 'shell', 'am', 'instrument', '-w', '-e', 'timeout_msec', '480000',
      ...installationGuardArguments(), '-e', 'class', 'be.sportgreenmoove.app.ui.LocalTeamDraftRestartTest#' + method,
      `be.sportgreenmoove.app.local.test/${disposableTestRunner}`], { encoding: 'utf8', timeout: 10 * 60_000, maxBuffer: 4 * 1024 * 1024 })); }
    catch (error) { if (typeof error.stdout === 'string') { stdout = error.stdout; commandFailure = error; } else throw error; }
    const transcript = stdout.replaceAll(session.password, '[REDACTED]'); console.log(transcript);
    const file = `LocalTeamDraftRestartTest#${method}-instrumentation.txt`;
    writeFileSync(resolve(directory, file), transcript, { flag: 'wx' }); transcripts[file] = sha(transcript);
    if (commandFailure) throw commandFailure;
    assertInstrumentationPassed(transcript, 1);
  }
  await instrument('preparePrivateTeamDraft');
  unsent = await verifyTeamDraftRecords(fixture);
  writeFileSync(resolve(directory, 'team-draft-unsent-checkpoint.json'), JSON.stringify(unsent, null, 2) + '\n', { flag: 'wx' });
  firstStop = stopDisposableAppProcess({ adb, serial, runId: session.runId, outputDir: directory,
    beforeName: 'local-team-draft-before.json', validateBefore: validateTeamDraftBefore });
  await instrument('recoverAndSendPrivateDraftInNewProcess');
  secondStop = stopDisposableAppProcess({ adb, serial, runId: session.runId, outputDir: directory,
    beforeName: 'local-team-draft-sent-before.json', validateBefore: validateTeamDraftBefore });
  await instrument('acknowledgedDraftStaysEmptyInThirdProcess');
  collectLocalUiEvidence({ adb, serial, evidenceDir: directory, phase: 'team-draft', runId: session.runId, password: session.password });
  marker = json('team-draft-device.json');
  validateTeamDraftRestart(json('local-team-draft-before.json'), firstStop, json('local-team-draft-sent-before.json'), secondStop, marker, session.runId);
  for (const [file, hash] of Object.entries(marker.screenshots)) assert.equal(sha(read(file)), hash);
  isolation = await verifyTeamDraftRecords(fixture, marker.messageId);
} catch (error) {
  failure = new Error(String(error.message ?? 'Team draft restart failed').replaceAll(process.env.SGM_QA_PASSWORD, '[REDACTED]'));
  if (session) {
    try { collectLocalUiEvidence({ adb, serial, evidenceDir: directory, phase: 'failure-cleanup', runId: session.runId, password: session.password }); }
    catch { console.warn('Partial draft captures unavailable.'); }
    try { collectNativeProcessFailure({ adb, serial, directory, label: 'LocalTeamDraftRestartTest', password: session.password, runId: session.runId }); }
    catch { console.warn('Process diagnostics unavailable; original outcome preserved.'); }
  }
}
try { await deleteApp(getApp()); } catch (error) { failure = failure ? new AggregateError([failure, error], 'Trial and admin shutdown failed') : error; }
try { resetDisposableLocalApps(adb, serial); } catch (error) { failure = failure ? new AggregateError([failure, error], 'Trial and package cleanup failed') : error; }
if (failure) throw failure;
const sources = [...disposableApkSourceFiles, ...['local-team-draft-ui.mjs', 'run-local-team-draft-ui.mjs',
  'run-isolated-ride-ui.mjs', 'team-draft-restart-evidence.mjs', 'team-draft-native-records.mjs',
  'team-conversation-ui-fixture.mjs', 'local-disposable-process-stop.mjs'].map(file => 'scripts/qa/' + file),
  ...['TeamConversationRoute.kt', 'TeamConversationState.kt', 'ConversationComposerState.kt', 'TeamConversationDraftState.kt', 'TeamConversationDraftScreen.kt']
    .map(file => 'android/app/src/main/java/be/sportgreenmoove/app/ui/' + file),
  ...['TeamConversationDraftStorage.kt', 'SharedPreferencesTeamConversationDrafts.kt'].map(file => 'android/app/src/main/java/be/sportgreenmoove/app/services/' + file),
  ...['LocalTeamDraftRestartTest.kt', 'LocalTeamChatUi.kt', 'LocalTeamChatPeer.kt', 'NativeTeamMessageInput.kt', 'InputWindowReadiness.kt']
    .map(file => 'android/app/src/androidTest/java/be/sportgreenmoove/app/ui/' + file)];
writeFileSync(resolve(directory, 'team-draft-app-results.json'), JSON.stringify({ ...marker, testedAt: new Date().toISOString(),
  testCount: 1, nativeCaseCount: 3, nativeUiExecuted: true, steps: [{ id: 'team-draft-three-process-ui', status: 'passed' }],
  transcripts, apkPreparation, native: { firstStop, secondStop }, unsentCheckpoint: unsent, fixtureIsolation: isolation,
  cleanupMode: 'destroy-owned-local-environment', adminClientClosed: true, localPackagesRemoved: true,
  productionWrites: false, physicalDevice: false, notificationsVerified: false, fullProcessRestartProven: true,
  sourceFiles: Object.fromEntries(sources.map(file => [file, sha(readFileSync(resolve(root, file)))]))
}, null, 2) + '\n', { flag: 'wx' });
