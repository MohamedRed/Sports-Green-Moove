import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {parseDocument} from 'yaml';
import {content} from '../partner-portal/content.mjs';
import {nativeLoginRecheck, nativeLoginRecheckProgress} from '../partner-portal/native-login-recheck.mjs';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const folder = 'docs/release/evidence/native-login-recheck-05cd3f7-2026-11-07/';
const dir = 'android/app/src/androidTest/java/be/sportgreenmoove/app/ui/';
const report = JSON.parse(read(nativeLoginRecheck.source));

test('original archives distinguish pre-installation Wi-Fi failure from the parent-home wait failure', () => {
  assert.equal(report.sourceCommit, '05cd3f7d6869c7bfc5286ca76fcfa740d839add9');
  assert.equal(report.runId, 42312780331);
  for (const record of report.records) assert.equal(sha(read(folder + record.file)), record.sha256, record.file);
  const archives = JSON.parse(read(folder + 'original-archives.json'));
  assert.deepEqual(archives.archives.map(row => row.id), [13549528101, 13549902155]);
  for (const member of archives.members) {
    assert.equal(Buffer.byteLength(read(folder + member.file)), member.bytes);
    assert.equal(sha(read(folder + member.file)), member.sha256);
  }
  for (const lane of ['matrix', 'ride']) {
    const job = JSON.parse(read(folder + lane + '/job.json'));
    assert.equal(job.status, 'completed'); assert.equal(job.conclusion, 'failure');
    assert.equal(job.sourceCommit, report.sourceCommit); assert.equal(job.runId, report.runId);
  }
  const network = JSON.parse(read(folder + 'matrix/network-readiness/outcome.json'));
  assert.equal(network.failureKind, 'wifi-prerequisite-deadline'); assert.equal(network.budgetMs, 180000);
  assert.equal(network.sampleCount, 59); assert.equal(network.testAppsAbsent, true); assert.equal(network.flowCompleted, false);
  const transcript = read(folder + 'ride/LocalRideObservationFlowTest-instrumentation.txt');
  assert.match(transcript, /Condition still not satisfied after 60000 ms/);
  assert.match(transcript, /LocalRideObservationFlowTest.kt:61/); assert.match(transcript, /Tests run: 1,  Failures: 1/);
  assert.equal(read(folder + 'baseline-ride-test.kt').split('\n')[60].trim(), 'waitFor(SgmTestTags.HomeScreen)');
  assert.match(read(folder + 'ride/LocalRideObservationFlowTest-exit-info.txt'), /due to finished inst/);
  assert.equal(JSON.parse(read(folder + 'ride/disposable-device-restore.json')).verified, true);
  assert.equal(JSON.parse(read(folder + 'ride/host-shutdown/complete.json')).targetExitObserved, true);
  for (const key of ['parentHomeObserved', 'rideObservationStarted', 'parentAuthenticationOutcomeKnown',
    'currentHeadAccepted', 'rootCauseConfirmed', 'nativeDiagnosticExecutionAccepted', 'physicalDeviceAccepted',
    'releaseComplete', 'newMediaPublished']) assert.equal(report[key], false, key);
});

test('failure-only pre-close observation preserves every original assertion, wait and success marker', () => {
  const baseline = read(folder + 'baseline-ride-test.kt');
  const candidate = baseline.replace('import androidx.test.platform.app.InstrumentationRegistry\n',
    'import androidx.test.platform.app.InstrumentationRegistry\nimport androidx.test.uiautomator.UiDevice\n')
    .replace('        ActivityScenario.launch(MainActivity::class.java).use { activity ->',
      '        LocalRideFailureObservation(context, UiDevice.getInstance(instrumentation), session).use { observation ->\n' +
      '        ActivityScenario.launch(MainActivity::class.java).useWithFailureObservation({ activity ->\n' +
      '            observation.retainFailure(activity.state.name)\n        }) { activity ->')
    .replace('            waitFor(SgmTestTags.AuthEmailAction)\n',
      '            waitFor(SgmTestTags.AuthEmailAction)\n            observation.phase(GuardianWindowPhase.ParentLogin)\n')
    .replace('            waitFor(SgmTestTags.HomeScreen)\n',
      '            waitFor(SgmTestTags.HomeScreen)\n            observation.phase(GuardianWindowPhase.ParentHomeObserved)\n')
    .replace('        File(directory, "local-ride-observation-device.json")', '        }\n        File(directory, "local-ride-observation-device.json")');
  const normalizeIndent = text => text.split('\n').map(line => line.trimStart()).join('\n');
  assert.equal(normalizeIndent(read(dir + 'LocalRideObservationFlowTest.kt')), normalizeIndent(candidate));
  const observer = read(dir + 'LocalRideFailureObservation.kt');
  for (const guard of ['BuildConfig.DEBUG && BuildConfig.SGM_USE_FIREBASE_EMULATOR', 'be.sportgreenmoove.app.local',
    'demo-sgm-local-qa', 'disposableEmulator', 'getprop ro.kernel.qemu', 'check(!file.exists())',
    'ActivityWindowObservation(MainActivity::class.java)', 'observer.snapshot()', 'observer.close()',
    'put("parentAuthenticated", FirebaseAuth.getInstance().currentUser?.uid == "sgm-qa-parent")']) assert(observer.includes(guard));
  assert.doesNotMatch(observer, /getString\("(?:password|parent|driver)"\)|takeScreenshot|captureToImage|fetchSemantics|dumpWindowHierarchy|Socket|URL\(|signIn|signOut/);
  const host = read('scripts/qa/local-ride-observation-ui.mjs');
  for (const helper of ['LocalRideFailureObservation.kt', 'ActivityWindowObservation.kt', 'SessionFailureObservation.kt']) assert(host.includes(helper));
  assert(host.indexOf('assertInstrumentationPassed(transcript, 1)') < host.indexOf('marker = JSON.parse'));
  assert.match(read(dir + 'SessionFailureObservation.kt'), /failure.addSuppressed\(diagnostic\)/);
  assert.match(read(folder + 'candidate-build.txt'), /BUILD SUCCESSFUL/);
  assert.match(read(folder + 'candidate-build.txt'), /:app:compileDebugAndroidTestKotlin/);
});

test('the public note preserves a failed tracking attempt without exposing diagnostic content', () => {
  assert.deepEqual(content.nativeLoginRecheck, nativeLoginRecheck);
  assert.deepEqual(content.updates.filter(row => row.source === nativeLoginRecheckProgress.source), [nativeLoginRecheckProgress]);
  assert.doesNotMatch(nativeLoginRecheckProgress.title + nativeLoginRecheckProgress.text, /Firebase|BrowserStack|SDK|Compose|CI\b/i);
  for (const name of ['native-ci', 'web-integration-smoke']) {
    const workflow = parseDocument(read('.github/workflows/' + name + '.yml')).toJSON();
    for (const event of ['push', 'pull_request']) {
      assert(workflow.on[event].paths.includes('tests/native-login-recheck.mjs'));
      assert(workflow.on[event].paths.includes(folder + '**'));
    }
    assert(Object.values(workflow.jobs).some(job => job.steps.some(step => step.run?.includes('tests/guardian-window-observation.test.mjs'))));
  }
});
