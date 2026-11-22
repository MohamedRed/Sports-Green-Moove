import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {assertEvidenceBundleChecksums} from './evidence-bundle-checksums.mjs';
import {assertRetainedSourceFiles} from './retained-source-evidence.mjs';
import {parseAndroidJUnitTranscript} from './android-junit-transcript.mjs';
export const nativeNetworkPreparationFolder = 'docs/release/evidence/native-network-preparation-e2bb5d2-2026-11-01/';
export function validateTeamPushNetworkGate(root, folder = nativeNetworkPreparationFolder) {
  const base = resolve(root, folder), read = file => readFileSync(resolve(base, file), 'utf8'), json = file => JSON.parse(read(file));
  assertEvidenceBundleChecksums(base); const run = json('run.json'), report = json('review.json');
  assert.equal(run.databaseId, 41319436417); assert.equal(run.headSha, 'e2bb5d264a158137624ed041300acdc370061103');
  assert.equal(run.status, 'completed'); assert.equal(run.conclusion, 'failure');
  assert.equal(report.scope, 'failed-network-preparation-not-chat-retry-or-release-proof');
  assert.equal(report.sourceCommit, run.headSha); assert.equal(report.testedAt, run.updatedAt);
  for (const [file, id] of [['main-artifact.json', 13089772806], ['chat-artifact.json', 13089610138]]) {
    const artifact = json(file); assert.equal(artifact.id, id); assert.equal(artifact.expired, false);
    assert.equal(artifact.workflow_run.id, run.databaseId); assert.equal(artifact.workflow_run.head_sha, run.headSha);
    assert.match(artifact.digest, /^sha256:[a-f0-9]{64}$/);
  }
  assert.equal(run.jobs.find(row => row.name === 'Android native UI tests').conclusion, 'success');
  const focused = run.jobs.filter(row => row.name.startsWith('Android focused safety UI tests / Isolated ') && !row.name.endsWith('/ Isolated safety flows'));
  assert.equal(focused.length, 11); assert.equal(focused.filter(row => row.conclusion === 'success').length, 10);
  assert.equal(focused.find(row => row.name.endsWith('/ Isolated chat-network-recovery')).conclusion, 'failure');
  assert.deepEqual(report.focused, {lanes: 11, passed: 10, failed: 1});
  for (const key of ['fullGatePassed', 'chatRetryOutcomeReached', 'rootCauseConfirmed', 'physicalDevice', 'runtimeCallbacksExecuted',
    'pushDeliveryVerified', 'releaseAccepted', 'rawArchiveDigestIndependentlyMatched']) assert.equal(report[key], false, key);
  for (const key of ['mainJobPassed', 'privateStorageCasePassed', 'wifiReadinessEarlierPassed']) assert.equal(report[key], true, key);
  assert.equal(report.failedPhase, 'network-preparation'); assert.equal(report.failedLine, 83);
  assert.equal(report.requestedCellularAvailableCallbacks, 0); assert.deepEqual(report.publishedCaptures, {});
  assertRetainedSourceFiles(root, report.sourceFiles);
  const ordinary = parseAndroidJUnitTranscript(read('main/ordinary-instrumentation.txt')), stored = json('main/ordinary-results.json');
  for (const [key, value] of Object.entries(ordinary)) assert.deepEqual(stored[key], value);
  assert.deepEqual(report.ordinary, {cases: 286, passed: 232, skipped: 54, failed: 0}); assert.equal(ordinary.failed, 0); assert.equal(ordinary.passed, 232);
  assert.equal(ordinary.cases.find(row => row.className.endsWith('.TeamPushPrivateStorageTest'))?.status, 'passed');
  assert.deepEqual(json('main/native-suite-status.json'), {scope: 'native-suite-exit-status-not-flow-verification', ordinaryTests: 0, componentEvidence: 0, localReplay: 0});
  const marker = json('chat/local-chat-network-ui.json'); assert.equal(marker.completed, false); assert.equal(marker.failedPhase, 'network-preparation');
  assert.deepEqual(marker.network, []); assert.equal(marker.preparationFailure.cellularAvailableCallbacks, 0);
  assert.equal(marker.preparationFailure.wifiAvailableCallbacks, 1); assert.equal(marker.preparationFailure.backendReachable, true);
  assert.equal(marker.cellularRequestReleased, true); assert.equal(marker.wifiRequestReleased, true);
  assert.equal(json('chat/network-readiness/outcome.json').ready, true);
  assert(read('chat/LocalChatNetworkFlowTest-instrumentation.txt').includes('Condition still not satisfied after 30000 ms'));
  assert(read('chat/LocalChatNetworkFlowTest-instrumentation.txt').includes('LocalChatNetworkFlowTest.kt:83'));
  assert.equal(json('chat/chat-network-recovery-suite-status.json').status, 1);
  assert.equal(json('chat/adb-pull-failure-cleanup.json').completed, true);
  for (const file of ['main/disposable-store-restore.json', 'chat/disposable-device-restore.json']) {
    const restore = json(file); assert.equal(restore.restored, true); assert.equal(restore.verified, true);
  }
  return report;
}
