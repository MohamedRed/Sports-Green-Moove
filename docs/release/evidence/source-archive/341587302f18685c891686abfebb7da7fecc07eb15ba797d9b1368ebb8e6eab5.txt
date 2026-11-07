import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import * as client from './local-flow-client.mjs';
import { withLocalAdminCleanup } from './local-admin-lifecycle.mjs';
import { seedLocalUiFixtures } from './local-ui-fixtures.mjs';
import { seedChatNetworkHistory } from './chat-network-history-fixture.mjs';
import { seedChatNetworkUiFixture, verifyChatNetworkUi } from './local-chat-network-ui.mjs';
import { replayWithNetworkCleanup } from './local-network-replay.mjs';
import { resetDisposableLocalApps } from './reset-disposable-local-apps.mjs';
import { prepareDisposableTestApks, usePreinstalledTestApks, installationGuardArguments,
  disposableTestRunner, disposableApkSourceFiles } from './install-disposable-test-apks.mjs';
import { collectLocalUiEvidence } from './collect-local-ui-evidence.mjs';
import { collectNativeProcessFailure } from './native-process-failure-evidence.mjs';
import { assertInstrumentationPassed } from './android-instrumentation-result.mjs';

assert.equal(process.env.SGM_LOCAL_DISPOSABLE_EMULATOR, 'true');
assert.equal(process.env.SGM_FOCUSED_UI_CASE, 'chat-network-recovery');
const root = resolve(import.meta.dirname, '../..'), android = resolve(root, 'android');
const serial = process.env.SGM_LOCAL_ANDROID_SERIAL; assert.match(serial, /^emulator-\d+$/);
const adb = process.env.ANDROID_HOME ? `${process.env.ANDROID_HOME}/platform-tools/adb` : 'adb';
const directory = process.env.SGM_LOCAL_UI_OUTPUT;
const run = (command, args) => execFileSync(command, args,
  { cwd: root, env: process.env, stdio: 'inherit', timeout: 20 * 60_000 });
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
mkdirSync(directory, { recursive: true });
const result = await withLocalAdminCleanup(async () => {
  let session, apkPreparation, history, network, transcript, failure;
  const collect = phase => collectLocalUiEvidence({ adb, serial, evidenceDir: directory, phase,
    runId: session.runId, password: session.password });
  try {
    session = await seedLocalUiFixtures();
    history = await seedChatNetworkHistory(client);
    const fixture = await seedChatNetworkUiFixture();
    if (!usePreinstalledTestApks()) {
      run(resolve(android, 'gradlew'), ['-p', android, ':app:assembleDebug', ':app:assembleDebugAndroidTest',
        '-PSGM_USE_FIREBASE_EMULATOR=true', '--no-daemon', '--max-workers=2']);
    }
    apkPreparation = prepareDisposableTestApks({ adb, serial, android, run });
    run(process.execPath, [resolve(import.meta.dirname, 'install-local-ui-session.mjs'), serial,
      process.env.SGM_LOCAL_UI_SESSION_FILE]);
    replayWithNetworkCleanup(adb, serial, session.runId, (classes, expected) => {
      assert.deepEqual(classes, ['LocalChatNetworkFlowTest']); assert.equal(expected, 1);
      const command = spawnSync(adb, ['-s', serial, 'shell', 'am', 'instrument', '-w', '-e', 'timeout_msec', '240000',
        ...installationGuardArguments(), '-e', 'class', 'be.sportgreenmoove.app.ui.LocalChatNetworkFlowTest',
        `be.sportgreenmoove.app.local.test/${disposableTestRunner}`],
      { env: process.env, encoding: 'utf8', timeout: 12 * 60_000, maxBuffer: 4 * 1024 * 1024 });
      transcript = (command.stdout ?? '').replaceAll(session.password, '[REDACTED]');
      writeFileSync(resolve(directory, 'LocalChatNetworkFlowTest-instrumentation.txt'), transcript, { flag: 'wx' });
      writeFileSync(resolve(directory, 'LocalChatNetworkFlowTest-stderr.txt'),
        (command.stderr ?? '').replaceAll(session.password, '[REDACTED]'), { flag: 'wx' });
      assert(!command.error, 'Native network instrumentation command could not complete');
      assert.equal(command.status, 0); assert.equal(command.signal, null);
      assertInstrumentationPassed(transcript, expected);
    });
    collect('network-recovery');
    network = await verifyChatNetworkUi(fixture, directory);
  } catch (error) {
    failure = error;
    if (session) {
      try { collect('failure-cleanup'); }
      catch { console.warn('Partial network evidence unavailable; original failure preserved.'); }
      try { collectNativeProcessFailure({ adb, serial, directory, label: 'LocalChatNetworkFlowTest',
        password: session.password, runId: session.runId }); }
      catch { console.warn('Network process diagnostics unavailable; original failure preserved.'); }
    }
  }
  try { resetDisposableLocalApps(adb, serial); }
  catch (error) { failure = failure ? new AggregateError([failure, error], 'Network trial and package cleanup failed') : error; }
  if (failure) throw failure;
  return { projectId: session.projectId, runId: session.runId,
    scope: 'isolated-chat-network-ui-not-physical-network-loss', testedAt: new Date().toISOString(),
    testCount: 1, nativeCaseCount: 1, nativeUiExecuted: true,
    steps: [{ id: 'chat-network-recovery-ui', status: 'passed' }], history, network, apkPreparation,
    primaryEvidencePhase: 'network-recovery', transcriptSha256: sha(transcript),
    cleanupMode: 'destroy-owned-local-environment', localPackagesRemoved: true,
    productionWrites: false, physicalDevice: false, safetyAuditAccepted: false, storeReviewAccepted: false };
}, { firestore: client.db });
const sources = [...disposableApkSourceFiles,
  ...['local-chat-network-recovery-ui.mjs', 'run-local-chat-network-recovery-ui.mjs', 'chat-network-history-fixture.mjs',
    'local-chat-network-ui.mjs', 'local-network-replay.mjs', 'chat-network-evidence.mjs', 'network-start-evidence.mjs',
    'local-carrier-diagnostics.mjs', 'local-subscription-diagnostics.mjs', 'local-default-selection-diagnostics.mjs',
    'run-isolated-ride-ui.mjs', 'local-ui-fixtures.mjs'].map(file => 'scripts/qa/' + file),
  ...['LocalChatNetworkFlowTest.kt', 'LocalEmulatorNetwork.kt', 'LocalRequestedTransport.kt',
    'LocalInitialNetworkObservation.kt', 'LocalNetworkStartObservation.kt']
    .map(file => 'android/app/src/androidTest/java/be/sportgreenmoove/app/ui/' + file)];
writeFileSync(resolve(directory, 'chat-network-recovery-app-results.json'), JSON.stringify({ ...result,
  adminClientClosed: true, firestoreClientTerminated: true,
  sourceFiles: Object.fromEntries(sources.map(file => [file, sha(readFileSync(resolve(root, file)))]))
}, null, 2) + '\n', { flag: 'wx' });
