import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {parseDocument} from 'yaml';
import {content} from '../partner-portal/content.mjs';
import {androidNodeReadiness, androidNodeReadinessProgress} from '../partner-portal/android-node-readiness.mjs';
import {androidReadinessRecheck, androidReadinessRecheckProgress} from '../partner-portal/android-readiness-recheck.mjs';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const sha = value => createHash('sha256').update(value).digest('hex');
const dir = 'android/app/src/androidTest/java/be/sportgreenmoove/app/ui/';
const folder = 'docs/release/evidence/android-node-readiness-2026-11-04/';
const report = JSON.parse(read(androidNodeReadiness.source));

test('two actual readiness passes cannot accept the later incomplete ordinary command or lost parent interface', () => {
  const folder = 'docs/release/evidence/android-node-readiness-2026-11-04/a226b3e/';
  const proof = JSON.parse(read(androidReadinessRecheck.source));
  assert.equal(proof.runId, 41920203762); assert.equal(proof.jobId, 126890385415);
  assert.equal(proof.sourceCommit, 'a226b3e265c78f58d56af892a666ae2778afc50b');
  assert.equal(proof.conclusion, 'failure'); assert.equal(proof.readinessCases.passed, 2);
  const packets = read(folder + 'readiness-cases.txt');
  assert.equal((packets.match(/^INSTRUMENTATION_STATUS_CODE: 0$/gm) ?? []).length, 2);
  for (const name of proof.readinessCases.cases) assert(packets.includes('INSTRUMENTATION_STATUS: test=' + name));
  assert.equal(proof.ordinary.complete, false); assert.equal(proof.ordinary.elapsedMs, 720003);
  assert.equal(proof.ordinary.lastStartedIndex, 319); assert.equal(proof.ordinary.discoveredCases, 351);
  assert.equal(proof.ordinary.completeParserRejection, 'One complete runner result is required');
  assert.equal(proof.replay.failureAt, 'openGuardians:81 performScrollTo');
  assert.equal(proof.replay.underlyingRootAbsenceCause, 'unknown');
  assert.equal(proof.focusedLanesPassed, 12);
  assert.equal(JSON.parse(read(folder + 'host-disposal.json')).finalState, 'gone');
  for (const entry of proof.provenance.records) assert.equal(sha(read(folder + entry.file)), entry.sha256);
  for (const key of ['fullGateAccepted', 'priorRootCauseConfirmed', 'physicalDeviceAccepted', 'newMediaPublished', 'releaseComplete']) assert.equal(proof[key], false);
  assert.deepEqual(content.androidReadinessRecheck, androidReadinessRecheck);
  assert.deepEqual(content.updates.filter(item => item.source === androidReadinessRecheckProgress.source), [androidReadinessRecheckProgress]);
});

test('positive readiness allows zero roots only while waiting for an actual matching node', () => {
  const helper = read(dir + 'ComposeNodeReadiness.kt');
  assert.match(helper, /waitUntil\(timeoutMillis\)/);
  assert.match(helper, /onAllNodes\(matcher\)\.fetchSemanticsNodes\(atLeastOneRootRequired = false\)\.isNotEmpty\(\)/);
  assert.doesNotMatch(helper, /catch|runCatching|retry|Thread.sleep|waitUntilAtLeastOneExists/);
  assert.equal((helper.match(/waitUntil\(/g) ?? []).length, 1);
  const regression = read(dir + 'ComposeNodeReadinessTest.kt');
  assert.equal((regression.match(/@Test fun /g) ?? []).length, 2);
  assert.match(regression, /assertThrows\(ComposeTimeoutException::class.java\)/);
  assert.match(regression, /waitForComposeNode\(hasTestTag\("missing-root"\), 50\)/);
  assert.match(regression, /handler.postDelayed\(attach, 100\)/);
  assert.match(regression, /finally \{\s+handler.removeCallbacks\(attach\)/);
  assert.match(regression, /onNodeWithTag\("late-root"\)\.assertExists\(\)/);
  assert.match(regression, /onAllNodes\(isRoot\(\)\)\.fetchSemanticsNodes\(atLeastOneRootRequired = false\)\.isEmpty\(\)/);
  assert.equal((regression.match(/assertNoComposition\(\)/g) ?? []).length, 3);
  assert.doesNotMatch(regression, /@Ignore|Assume\.|runCatching|retry/);
});

test('the recorded migration preserves the baseline expressions without changing production code or deadlines', () => {
  const source = JSON.parse(read(androidNodeReadiness.checksums));
  assert.equal(source.baselineCommit, '3e7cd40e62798ba503c383e044e25231dc3072bd');
  const callers = source.files.filter(item => !item.new);
  assert.equal(callers.length, 71);
  assert.equal(new Set(callers.map(item => item.path)).size, 71);
  assert.equal(callers.reduce((sum, item) => sum + item.waits, 0), 101);
  for (const item of callers) {
    assert(item.path.startsWith(dir));
    assert.equal(item.fullFileTransformationMatches, true);
    assert.match(item.baselineSha256, /^[a-f0-9]{64}$/);
    assert.match(item.candidateSha256, /^[a-f0-9]{64}$/);
    assert(read(item.path).includes('compose.waitForComposeNode('));
  }
  assert.equal(report.candidate.originalDeadlinesPreserved, true);
  assert.equal(report.candidate.productionAppChanged, false);
  assert.equal(report.candidate.changedCallerFiles, 71);
  assert.equal(report.candidate.positiveWaits, 101);
});

test('the original ordinary timeout, absent parent interface and missing copy directory remain rejected', () => {
  const failure = report.retainedFailure;
  assert.equal(failure.runId, 41907489530);
  assert.equal(failure.jobId, 126845938435);
  assert.equal(failure.sourceCommit, '0d502700fbbcbf66682912b0f44557c6f4feeaba');
  assert.equal(failure.conclusion, 'failure');
  assert.equal(failure.fullOrdinaryResult, false);
  assert.equal(failure.lastCompletedCase, 335);
  assert.equal(failure.lastStartedCase, 336);
  assert.equal(failure.focusedLanesPassed, 11);
  assert.equal(failure.underlyingRootAbsenceCause, 'unknown');
  assert.equal(failure.ordinarySlownessCause, 'unknown');
  const ordinary = JSON.parse(read(folder + 'ordinary-process.json'));
  assert.equal(ordinary.errorCode, 'ETIMEDOUT');
  assert.equal(ordinary.elapsedMs, 720007);
  assert.equal(ordinary.status, null);
  assert.match(read(folder + 'guardian-instrumentation.txt'), /No compose hierarchies found/);
  assert.match(read(folder + 'guardian-instrumentation.txt'), /Tests run: 1,  Failures: 1/);
  const sync = JSON.parse(read(folder + 'sync-diagnostics.json'));
  assert.match(sync.observations.find(item => item.id === 'directory-stat').stderr, /No such file or directory/);
  assert.equal(sync.observations.find(item => item.id === 'sync-listing').value.entryCount, 0);
  assert.deepEqual(JSON.parse(read(folder + 'native-suite-status.json')), {
    scope: 'native-suite-exit-status-not-flow-verification', ordinaryTests: 1, componentEvidence: 0, localReplay: 1
  });
  for (const item of report.provenance.records) assert.equal(sha(read(folder + item.file)), item.sha256);
});

test('the APK compilation and DEX inspection do not accept execution, media, provider or release readiness', () => {
  assert.equal(report.candidate.build.exitCode, 0);
  assert.equal(sha(read(folder + report.candidate.build.log)), report.candidate.build.sha256);
  assert.match(read(folder + report.candidate.build.log), /BUILD SUCCESSFUL/);
  assert.equal(report.candidate.regressionCases, 2);
  assert(report.candidate.apk.dexMembers.includes('absentCompositionStillFailsAtItsDeadline'));
  assert(report.candidate.apk.dexMembers.includes('aLaterCompositionMustContainTheRequestedNode'));
  for (const key of ['nativeRegressionExecutionAccepted', 'fullGateAccepted', 'physicalTrackingAccepted',
    'releaseComplete', 'newNativeMediaPublished']) assert.equal(report[key], false);
  for (const key of ['providerRequests', 'productionWrites', 'newPhoneSessions']) assert.equal(report[key], 0);
  assert.deepEqual(content.androidNodeReadiness, androidNodeReadiness);
  assert.deepEqual(content.updates.filter(item => item.source === androidNodeReadinessProgress.source), [androidNodeReadinessProgress]);
  assert.doesNotMatch(androidNodeReadinessProgress.title + androidNodeReadinessProgress.text, /Compose|Firebase|BrowserStack|Android|SDK|Kotlin|CI\b/);
});

test('the subsequent native baseline pass is distinct from the unexecuted readiness candidate', () => {
  const baseline = JSON.parse(read(folder + report.separateBaselineRun.source));
  assert.equal(baseline.runId, 41911782130);
  assert.equal(baseline.sourceCommit, report.baselineCommit);
  assert.equal(baseline.conclusion, 'success');
  assert.equal(baseline.candidateReadinessPresent, false);
  assert.equal(baseline.priorRootCauseConfirmed, false);
  assert.deepEqual(baseline.ordinary, {complete: true, caseCount: 349, passed: 294, skipped: 55, failed: 0});
  for (const item of baseline.records) assert.equal(sha(read(folder + item.file)), item.sha256);
  const suite = JSON.parse(read(folder + 'baseline-suite-status.json'));
  assert.equal(suite.ordinaryTests, 0); assert.equal(suite.componentEvidence, 0); assert.equal(suite.localReplay, 0);
  assert.equal(JSON.parse(read(folder + 'baseline-guardian-results.json')).checks.length, 8);
  assert.equal(JSON.parse(read(folder + 'baseline-host-disposal.json')).finalState, 'gone');
  for (const key of ['physicalDeviceAccepted', 'newMediaPublished', 'releaseAccepted']) assert.equal(baseline[key], false);
});

test('both web and native events include the new readiness contract without changing native execution budgets', () => {
  const path = 'tests/compose-node-readiness.test.mjs';
  for (const file of ['.github/workflows/native-ci.yml', '.github/workflows/web-integration-smoke.yml']) {
    const workflow = parseDocument(read(file)).toJSON();
    for (const event of ['push', 'pull_request']) {
      assert(workflow.on[event].paths.includes(path));
      assert(workflow.on[event].paths.includes(folder + '**'));
    }
    assert(Object.values(workflow.jobs).some(job => job.steps.some(step => step.run?.includes(path))));
  }
});
