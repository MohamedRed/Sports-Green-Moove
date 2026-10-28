import assert from 'node:assert/strict';
import {readFileSync, readdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {assertEvidenceBundleChecksums} from './evidence-bundle-checksums.mjs';
import {parseAndroidJUnitTranscript} from './android-junit-transcript.mjs';
import {assertInstrumentationPassed} from './android-instrumentation-result.mjs';
import {assertChatNetworkReceipt, assertTransportRequestSetup} from './chat-network-evidence.mjs';
import {assertNetworkStartReceipt} from './network-start-evidence.mjs';
import {assertRetainedSourceFiles} from './retained-source-evidence.mjs';

export const nativeGateFolder = 'docs/release/evidence/native-gate-94e8e78-2026-10-28/';
export const nativeGateHead = '94e8e78a8fc38c65c3516053cd108bd5e7ad3b67';
const focused = ['emergency-identity', 'ride-observation', 'native-startup', 'remote-ride-stop', 'session-restoration',
  'session-disconnect', 'team-conversation', 'team-access', 'team-draft', 'team-read-components', 'chat-network-recovery'];

export function validateNativeGateRecheck(root, reference) {
  assert.deepEqual(reference, {source: nativeGateFolder + 'summary.json', checkedAt: '2026-10-28', checksums: nativeGateFolder + 'artifact-sha256.json'});
  const base = resolve(root, nativeGateFolder); assertEvidenceBundleChecksums(base);
  const read = file => readFileSync(resolve(base, file), 'utf8'), json = file => JSON.parse(read(file));
  const summary = json('summary.json'), ci = json('native-run.json');
  assert.equal(summary.scope, 'complete-enabled-native-ci-not-physical-or-release-acceptance');
  assert.equal(summary.checkedAt, '2026-10-28');
  assert.equal(summary.sourceCommit, nativeGateHead); assert.equal(summary.ciRunId, 40758810301);
  for (const key of ['physicalDeviceAccepted', 'productionWrites', 'releaseComplete', 'earlierTransportRootCauseConfirmed',
    'realPaymentsExercised', 'safetyAuditAccepted', 'newMediaAccepted']) assert.equal(summary[key], false, key);
  assert.equal(ci.headSha, nativeGateHead); assert.equal(ci.databaseId, summary.ciRunId);
  assert.equal(ci.status, 'completed'); assert.equal(ci.conclusion, 'success');
  for (const name of ['Android native UI tests', 'Android native unit tests', 'Native UI flow coverage',
    'Android focused safety UI tests / Isolated safety flows', ...focused.map(id => 'Android focused safety UI tests / Isolated ' + id)]) {
    const jobs = ci.jobs.filter(job => job.name === name); assert.equal(jobs.length, 1, name);
    assert.equal(jobs[0].status, 'completed'); assert.equal(jobs[0].conclusion, 'success');
  }
  assert.equal(ci.jobs.find(job => job.name === 'Android native UI tests').databaseId, 123064831508);
  const pr = json('pr-checks.json'); assert.equal(pr.headRefOid, nativeGateHead);
  assert.equal(pr.statusCheckRollup.length, 27);
  assert(pr.statusCheckRollup.every(check => check.status === 'COMPLETED' && ['SUCCESS', 'SKIPPED'].includes(check.conclusion)));
  assert.deepEqual(pr.statusCheckRollup.filter(check => check.conclusion === 'SKIPPED').map(check => check.name).sort(), [
    'Android approved real-map UI integration', 'Android approved vehicle-map UI', 'Android approved parent search and booking',
    'iOS native checks', 'iOS native UI tests'].sort());
  const artifact = json('artifact.json'); assert.equal(artifact.id, 12848947199);
  assert.equal(artifact.workflow_run.id, ci.databaseId); assert.equal(artifact.workflow_run.head_sha, nativeGateHead);
  const ordinary = parseAndroidJUnitTranscript(read('ordinary-instrumentation.txt')), stored = json('ordinary-results.json');
  for (const [key, value] of Object.entries(ordinary)) assert.deepEqual(stored[key], value);
  assert.deepEqual(summary.ordinary, {passed: 187, skipped: 54, failed: 0});
  assert.equal(ordinary.caseCount, 241); assert.equal(ordinary.passed, 187); assert.equal(ordinary.skipped, 54); assert.equal(ordinary.failed, 0);
  const observations = ordinary.cases.filter(row => row.className.endsWith('.LocalNetworkCapabilitySnapshotTest'));
  assert.equal(observations.length, 4); assert(observations.every(row => row.status === 'passed'));
  const replay = json('replay/results.json'); assert.equal(replay.runId, '6e0e5edb6a387fe4460836d6b488b1ef');
  assert.equal(replay.projectId, 'demo-sgm-local-qa'); assert.equal(replay.scope, 'local-ui-not-physical-device');
  assert.equal(replay.testCount, 37); assert.equal(replay.nativeCaseCount, 40);
  const baseline = json('baseline-artifact.json'); assert.equal(baseline.id, 12847326599);
  assert.equal(baseline.workflow_run.id, 40754791471);
  assert.equal(baseline.workflow_run.head_sha, '7417e22703e3b89d69850248380c3223b98e1700');
  assert.deepEqual(replay.steps, json('baseline-7417e22-results.json').steps);
  assert.equal(replay.steps.length, 37); assert(replay.steps.every(step => step.status === 'passed'));
  assert.equal(replay.adminClientClosed, true); assert.equal(replay.firestoreClientTerminated, true);
  const transcripts = readdirSync(resolve(base, 'replay')).filter(file => file.endsWith('-instrumentation.txt'));
  assert.equal(transcripts.length, 32);
  let cases = 0;
  for (const file of transcripts) {
    const count = file.startsWith('LocalAppFlowTest-') ? 9 : 1;
    assertInstrumentationPassed(read('replay/' + file), count); cases += count;
  }
  assert.equal(cases, 40);
  const copies = readdirSync(resolve(base, 'replay')).filter(file => file.startsWith('adb-pull-'));
  assert.equal(copies.length, 17);
  for (const file of copies) {
    const copy = json('replay/' + file); assert.equal(copy.runId, replay.runId);
    assert.equal(file, 'adb-pull-' + copy.phase + '.json'); assert.notEqual(copy.phase, 'failure-cleanup');
    assert.equal(copy.completed, true); assert.equal(copy.status, 0); assert.equal(copy.errorCode, null); assert.equal(copy.signal, null);
  }
  assert.deepEqual(json('native-suite-status.json'), {scope: 'native-suite-exit-status-not-flow-verification', ordinaryTests: 0, componentEvidence: 0, localReplay: 0});
  const restore = json('device-restoration.json'); assert.equal(restore.case, 'full-matrix');
  assert.equal(restore.restored, true); assert.equal(restore.verified, true); assert.equal(restore.observed.continuousGuardVerified, true);
  for (const key of ['authorizationRemoved', 'componentRemoved', 'originalPolicyRestored']) assert.equal(restore.restoration.installAdmin[key], true);
  const network = json('replay/local-chat-network-ui.json'); assert.equal(network.runId, replay.runId);
  assertChatNetworkReceipt(network); assertTransportRequestSetup(network); assertNetworkStartReceipt(network);
  const offline = network.network.find(row => row.phase === 'offline').capabilityObservation;
  assert.equal(offline.atomicObservation, false); assert.equal(offline.active, null); assert.deepEqual(offline.available, []);
  assertRetainedSourceFiles(root, json('source-sha256.json'));
  const prior = json('previous/native-run.json'); assert.equal(prior.databaseId, 40756230929);
  assert.equal(prior.headSha, '9da2228effc8bcba3dbb88a09caff9caf4cae136'); assert.equal(prior.conclusion, 'failure');
  const priorOrdinary = parseAndroidJUnitTranscript(read('previous/ordinary-instrumentation.txt'));
  for (const [key, value] of Object.entries(priorOrdinary)) assert.deepEqual(json('previous/ordinary-results.json')[key], value);
  assert.equal(priorOrdinary.passed, 187); assert.equal(priorOrdinary.failed, 0); assert.equal(priorOrdinary.skipped, 54);
  const failedCopy = json('previous/primary-copy.json'); assert.equal(failedCopy.phase, 'trip-change-parent-confirmation');
  assert.equal(failedCopy.completed, false); assert.equal(failedCopy.status, 1);
  assert.equal(json('previous/failure-cleanup-copy.json').completed, true);
  assert.deepEqual(json('previous/native-suite-status.json'), {scope: 'native-suite-exit-status-not-flow-verification', ordinaryTests: 0, componentEvidence: 0, localReplay: 1});
  const remote = json('previous/remote-job.json'); assert.equal(remote.id, 123055767962); assert.equal(remote.conclusion, 'failure');
  assert.match(read('previous/remote-startup-excerpt.txt'), /adb: device offline/);
  assert.equal(json('previous/device-restoration.json').verified, true);
  return summary;
}
