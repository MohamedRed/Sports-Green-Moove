import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { XMLParser } from 'fast-xml-parser';
import { assertInstrumentationPassed } from './android-instrumentation-result.mjs';
import { assertEvidenceBundleChecksums } from './evidence-bundle-checksums.mjs';

export function validateNativeAdminClose(root, record) {
  const base = dirname(resolve(root, record.source)), bytes = name => readFileSync(resolve(base, name));
  const json = name => JSON.parse(bytes(name)), summary = json('summary.json'), run = json('native-run.json');
  assert.equal(record.checkedAt, summary.checkedAt); assert.equal(record.checkedAt, '2026-10-24');
  assert.equal(resolve(root, record.checksums), resolve(base, 'artifact-sha256.json'));
  assert.equal(summary.scope, 'completed-isolated-native-replay-and-client-closure-not-physical-release');
  assert.equal(run.databaseId, 40045976904); assert.equal(run.headSha, '13a5b1e27e63133c6e7dcebf53a75f25a93e852f');
  assert.equal(run.headSha, summary.sourceCommit); assert.equal(run.status, 'completed'); assert.equal(run.conclusion, 'success');
  assert.equal(run.jobs.find(row => row.databaseId === 120727679154).conclusion, 'success');
  const focused = run.jobs.filter(row => row.name.startsWith('Android focused safety UI tests / '));
  assert.equal(focused.length, 11); assert(focused.every(row => row.conclusion === 'success'));
  const artifact = json('artifact-metadata.json'); assert.equal(artifact.id, 12542505125); assert.equal(artifact.expired, false);
  assert.equal(artifact.workflow_run.head_sha, run.headSha);
  assert.deepEqual(json('native-suite-status.json'), { scope: 'native-suite-exit-status-not-flow-verification',
    ordinaryTests: 0, componentEvidence: 0, localReplay: 0 });
  const suite = new XMLParser({ignoreAttributes: false, isArray: tag => tag === 'testcase'}).parse(bytes('ordinary-suite.xml')).testsuite;
  assert.equal(suite['@_tests'], '211'); assert.equal(suite['@_skipped'], '52');
  assert.equal(suite['@_failures'], '0'); assert.equal(suite['@_errors'], '0'); assert.equal(suite.testcase.length, 211);
  const replay = json('native/results.json'); assert.equal(replay.runId, '865967d116e9deb9fd1027b65cd11025');
  assert.equal(replay.testCount, 37); assert.equal(replay.nativeCaseCount, 40); assert.equal(replay.steps.length, 37);
  assert(replay.steps.every(row => row.status === 'passed'));
  assert.equal(replay.adminClientClosed, true); assert.equal(replay.firestoreClientTerminated, true);
  const files = readdirSync(resolve(base, 'native')), transcripts = files.filter(name => name.endsWith('-instrumentation.txt'));
  assert.equal(transcripts.length, 32);
  for (const name of transcripts) assertInstrumentationPassed(bytes('native/' + name).toString(), name.startsWith('LocalAppFlowTest-') ? 9 : 1);
  const copies = files.filter(name => name.startsWith('adb-pull-')); assert.equal(copies.length, 17);
  for (const name of copies) {
    const receipt = json('native/' + name); assert.equal(receipt.runId, replay.runId);
    assert.equal(receipt.completed, true); assert.equal(receipt.status, 0);
  }
  const restore = json('device-restoration.json'); assert.equal(restore.verified, true);
  for (const key of ['localPackagesRemoved', 'background', 'stopped', 'launcher']) assert.equal(restore.restoration[key], true);
  for (const key of ['authorizationRemoved', 'componentRemoved', 'originalPolicyRestored']) assert.equal(restore.restoration.installAdmin[key], true);
  const host = json('host-observation.json'); assert.equal(host.finalState, 'gone'); assert.equal(host.targetExitObserved, true);
  for (const [key, expected] of Object.entries({nativeGroupsPassed: 37, nativeCasesPassed: 40, instrumentationTranscriptsPassed: 32,
    primaryCopiesPassed: 17, ordinaryCasesPassed: 159, ordinaryCasesSkipped: 52, focusedLanesPassed: 10})) assert.equal(summary[key], expected);
  assert.equal(summary.focusedAggregationPassed, true);
  assert.match(bytes('terminal-script-and-host.txt').toString(), /Script exited successfully \(code 0\)/);
  assert.match(bytes('terminal-script-and-host.txt').toString(), /CI host observation: gone/);
  for (const key of ['fullReplayAccepted', 'adminClientClosureAccepted', 'deviceRestorationVerified', 'hostExitVerified']) assert.equal(summary[key], true);
  for (const key of ['allScenarioArtifactsIndependentlyRevalidated', 'earlierTransportRootCauseConfirmed', 'earlierStartupCauseConfirmed',
    'newMediaAccepted', 'physicalTrackingAccepted', 'realPaymentsExercised', 'productionWrites', 'releaseComplete']) assert.equal(summary[key], false);
  assertEvidenceBundleChecksums(base); return summary;
}
