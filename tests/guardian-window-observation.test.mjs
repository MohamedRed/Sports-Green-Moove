import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {test} from 'node:test';
import {parseDocument} from 'yaml';
import {content} from '../partner-portal/content.mjs';
import {guardianWindowObservation} from '../partner-portal/guardian-window-observation.mjs';
import {iosPreparationTimeout, iosPreparationTimeoutProgress} from '../partner-portal/ios-preparation-timeout.mjs';
import {androidReadinessPass, androidReadinessPassProgress} from '../partner-portal/android-readiness-pass.mjs';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const sha = value => createHash('sha256').update(value).digest('hex');
const dir = 'android/app/src/androidTest/java/be/sportgreenmoove/app/ui/';
const folder = 'docs/release/evidence/guardian-window-observation-2026-11-04/';

test('the old post-instrumentation process log cannot establish why the parent interface disappeared', () => {
  const report = JSON.parse(read(guardianWindowObservation.source));
  assert.equal(report.baseline.runId, 41920203762);
  assert.equal(report.baseline.sourceCommit, 'a226b3e265c78f58d56af892a666ae2778afc50b');
  assert.equal(report.baseline.underlyingRootLossCause, 'unknown');
  assert.equal(sha(read(folder + report.baseline.log)), report.baseline.logSha256);
  assert.match(read(folder + report.baseline.log), /due to finished inst/);
  for (const key of ['nativeRegressionExecutionAccepted', 'parentFlowAccepted', 'rootCauseConfirmed',
    'wholeGateAccepted', 'newScreenshots', 'uiTextExported', 'releaseComplete']) assert.equal(report[key], false);
  assert.equal(report.newProviderRequests, 0); assert.equal(report.productionWrites, 0);
});

test('the observer uses bounded typed window data and never inspects displayed content or changes the device', () => {
  const source = read(dir + 'ActivityWindowObservation.kt');
  for (const fragment of ['task.get(2, TimeUnit.SECONDS)', 'events.size == 48', 'visited < 512',
    'handler.removeCallbacks(task)', 'task.cancel(false)', 'removeLifecycleCallback(lifecycle)',
    'removeOnAttachStateChangeListener(attachment)', 'removeOnWindowFocusChangeListener(focus)',
    'removeOnDrawListener(draw)', 'current.javaClass == target', 'ViewRootForTest']) assert(source.includes(fragment));
  assert.doesNotMatch(source, /getText\(|contentDescription|fetchSemantics|takeScreenshot|captureToImage|requestFocus|performClick|recreate\(|\.finish\(/);
  const local = read(dir + 'LocalGuardianWindowObservation.kt');
  for (const fragment of ['BuildConfig.DEBUG && BuildConfig.SGM_USE_FIREBASE_EMULATOR',
    'be.sportgreenmoove.app.local', 'demo-sgm-local-qa', 'disposableEmulator', 'getprop ro.kernel.qemu',
    'check(!file.exists())', 'put("flowAccepted", false)', 'put("repairAccepted", false)', 'put("captureAccepted", false)']) assert(local.includes(fragment));
  assert.doesNotMatch(local, /getString\("(?:password|parent|driver)"\)|FirebaseAuth|takeScreenshot|dumpWindowHierarchy/);
  assert(local.indexOf('fun retainFailure(') < local.indexOf('getExternalFilesDir(null)'));
});

test('the real parent failure is observed before close without replacing its original assertions or success marker', () => {
  const flow = read(dir + 'LocalGuardianVerificationFlowTest.kt');
  assert.match(flow, /ActivityScenario\.launch\(MainActivity::class.java\)\.useWithFailureObservation\(\{ activity ->\s+observation.retainFailure\(activity.state.name\)/);
  assert.equal((flow.match(/@Test fun /g) ?? []).length, 1);
  for (const fragment of ['activity.recreate()', 'captureLocalUi(compose, "guardian-parent-other-account.png")',
    'guardian-parent-device.json', 'parent-request-ui', 'account-isolation', 'compose.waitForComposeNode(matcher, 60_000)']) assert(flow.includes(fragment));
  assert.doesNotMatch(flow, /Thread.sleep|repeat\(|waitForTimeout/);
  const wrapper = read(dir + 'SessionFailureObservation.kt');
  assert.match(wrapper, /failure.addSuppressed\(diagnostic\)/); assert.match(wrapper, /throw failure/);
  const verifier = read('scripts/qa/local-guardian-parent-ui.mjs');
  assert(verifier.indexOf("instrument(['LocalGuardianVerificationFlowTest'], 1)") < verifier.indexOf('readGuardianParentDevice(directory, runId)'));
  for (const helper of ['ActivityWindowObservation.kt', 'LocalGuardianWindowObservation.kt', 'SessionFailureObservation.kt']) assert(verifier.includes(helper));
});

test('both actual test APKs compile the three regressions without accepting native execution', () => {
  const report = JSON.parse(read(guardianWindowObservation.source));
  assert.equal(report.candidate.nativeRegressionCases, 3);
  assert.deepEqual(report.candidate.builds.map(item => item.targetPackage), ['be.sportgreenmoove.app', 'be.sportgreenmoove.app.local']);
  for (const build of report.candidate.builds) {
    assert.equal(build.exitCode, 0); assert.equal(build.offline, true);
    assert.equal(sha(read(folder + build.log)), build.logSha256); assert.match(read(folder + build.log), /BUILD SUCCESSFUL/);
    assert(build.dexMembers.includes('anUnavailableMainThreadIsReportedWithoutWaitingForItToRecover'));
  }
  for (const entry of JSON.parse(read(guardianWindowObservation.checksums)).files) assert.equal(sha(read(entry.path)), entry.sha256, entry.path);
  const cases = read(dir + 'ActivityWindowObservationTest.kt');
  assert.equal((cases.match(/@Test fun /g) ?? []).length, 3);
  assert(cases.includes('assertSame(original, failure)')); assert(cases.includes('finally {'));
  assert(cases.includes('release.countDown(); handler.removeCallbacks(block)'));
  assert.doesNotMatch(cases, /@Ignore|Assume\.|takeScreenshot|Thread.sleep/);
  assert.deepEqual(content.guardianWindowObservation, guardianWindowObservation);
});

test('the terminal iPhone deadline preserves skipped UI/captures, successful disposal and the unchanged fifty-minute bound', () => {
  const proof = JSON.parse(read(iosPreparationTimeout.source));
  assert.equal(proof.runId, 41920203720); assert.equal(proof.jobId, 126890382856);
  assert.equal(proof.sourceCommit, 'a226b3e265c78f58d56af892a666ae2778afc50b');
  assert.equal(proof.status, 'completed'); assert.equal(proof.conclusion, 'cancelled');
  assert.equal(proof.configuredMinutes, 50); assert.match(proof.terminationAnnotation, /maximum execution time of 50m0s/);
  assert.equal(proof.steps.find(step => step.name.startsWith('Compile app')).conclusion, 'cancelled');
  assert.equal(proof.steps.find(step => step.name.startsWith('Run every built')).conclusion, 'skipped');
  assert.equal(proof.steps.find(step => step.name === 'Dispose isolated simulator').conclusion, 'success');
  assert.equal(proof.artifactCount, 0); assert.equal(proof.underlyingBuildSlownessCause, 'unknown');
  for (const key of ['sdkLinkedBuildAccepted', 'fixtureUiExecuted', 'newMediaPublished', 'releaseComplete']) assert.equal(proof[key], false);
  assert.deepEqual(content.iosPreparationTimeout, iosPreparationTimeout);
  assert.deepEqual(content.updates.filter(item => item.source === iosPreparationTimeoutProgress.source), [iosPreparationTimeoutProgress]);
  assert.doesNotMatch(iosPreparationTimeoutProgress.title + iosPreparationTimeoutProgress.text, /SDK|Firebase|BrowserStack|Swift|Xcode|CI\b/i);
});

test('both existing web and native checks run the observation contract without a new runtime or storage policy', () => {
  const path = 'tests/guardian-window-observation.test.mjs';
  for (const file of ['.github/workflows/native-ci.yml', '.github/workflows/web-integration-smoke.yml']) {
    const workflow = parseDocument(read(file)).toJSON();
    for (const event of ['push', 'pull_request']) assert(workflow.on[event].paths.includes(path));
    assert(Object.values(workflow.jobs).some(job => job.steps.some(step => step.run?.includes(path))));
  }
});

test('the separate 4582 native pass retains complete records without accepting the newer observer or physical release', () => {
  const proof = JSON.parse(read(androidReadinessPass.source));
  const base = androidReadinessPass.source.replace(/summary.json$/, '');
  assert.equal(proof.sourceCommit, '4582c3a45a107e59cc94185b1509fcc12b449935');
  assert.equal(proof.runId, 41924948641); assert.equal(proof.jobId, 126906772551);
  assert.equal(proof.status, 'completed'); assert.equal(proof.conclusion, 'success');
  for (const record of proof.records) assert.equal(sha(readFileSync(new URL('../' + base + record.file, import.meta.url))), record.sha256);
  const ordinary = JSON.parse(read(base + 'ordinary-results.json'));
  assert.equal(ordinary.complete, true); assert.equal(ordinary.guardConfirmed, true);
  assert.equal(ordinary.caseCount, 351); assert.equal(ordinary.passed, 296);
  assert.equal(ordinary.skipped, 55); assert.equal(ordinary.failed, 0);
  const readiness = ordinary.cases.filter(item => item.className.endsWith('ComposeNodeReadinessTest'));
  assert.equal(readiness.length, 2); assert(readiness.every(item => item.status === 'passed'));
  assert(!ordinary.cases.some(item => item.className.endsWith('ActivityWindowObservationTest')));
  const parent = JSON.parse(read(base + 'guardian-results.json'));
  const device = JSON.parse(read(base + 'guardian-device.json'));
  assert.equal(parent.runId, device.runId); assert.deepEqual(parent.checks, device.checks);
  assert.equal(parent.checks.length, 8); assert(parent.checks.every(item => item.status === 'passed'));
  assert.deepEqual(parent.screenshots, device.screenshots); assert.equal(Object.keys(parent.screenshots).length, 5);
  assert.equal(JSON.parse(read(base + 'ordinary-process.json')).status, 0);
  assert.deepEqual(JSON.parse(read(base + 'suite-status.json')), {
    scope: 'native-suite-exit-status-not-flow-verification', ordinaryTests: 0, componentEvidence: 0, localReplay: 0,
  });
  assert.equal(JSON.parse(read(base + 'host-disposal.json')).targetExitObserved, true);
  assert.equal(proof.focusedLanesPassed, 12); assert.equal(proof.sourceBoundGateAccepted, true);
  for (const key of ['observerExecutionAccepted', 'previousRootCauseConfirmed', 'physicalDeviceAccepted', 'newMediaPublished', 'releaseComplete'])
    assert.equal(proof[key], false);
  assert.deepEqual(content.androidReadinessPass, androidReadinessPass);
  assert.deepEqual(content.updates.filter(item => item.source === androidReadinessPassProgress.source), [androidReadinessPassProgress]);
  assert.doesNotMatch(androidReadinessPassProgress.title + androidReadinessPassProgress.text, /SDK|Firebase|BrowserStack|Android|Swift|Xcode|CI\b/i);
});
