import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {basename, resolve} from 'node:path';
import {assertEvidenceBundleChecksums} from './evidence-bundle-checksums.mjs';
import {assertRetainedSourceFiles} from './retained-source-evidence.mjs';
import {validateSessionDisconnectArtifactFiles, sessionDisconnectTranscripts} from './session-disconnect-retained-evidence.mjs';

export const disconnectRecheckFolder = 'docs/release/evidence/session-disconnect-recheck-2026-10-31/';
export function validateDisconnectRecheck(root) {
  const folder = resolve(root, disconnectRecheckFolder), bytes = file => readFileSync(resolve(folder, file));
  const json = file => JSON.parse(bytes(file)), sha = value => createHash('sha256').update(value).digest('hex');
  assertEvidenceBundleChecksums(folder);
  const report = validateSessionDisconnectArtifactFiles(root, disconnectRecheckFolder + 'passed/session-disconnect-results.json');
  assert.equal(report.runId, '0814f84568315ad652b1d4f66e26b33f'); assert.equal(report.testedAt.slice(0, 10), '2026-10-31');
  assert.equal(Object.hasOwn(report, 'transportObservations'), false);
  for (const [name, id, jobId, runId, head, digest, size] of [
    ['failed', 13043247915, 124540585301, 41202387345, '51c183e7af60a79c3096d55e65eb0b33ce1b0d26',
      'ff1e93b17e424142fdc16afeb8ee33131d7aaa0dc7973a888eac0d5d86d21acd', 11391],
    ['passed', 13043354303, 124543847357, 41203498719, 'c76c3cec419314838db1056bf27842a0750ada67',
      '602e863d5166a4bbd0b6287694f37b43b157ef4dcb7656425160a9bb59ee1937', 664380],
  ]) {
    const artifact = json(name + '/artifact.json'), job = json(name + '/job.json'), archive = json(name + '/archive-verification.json');
    assert.equal(artifact.id, id); assert.equal(artifact.workflow_run.id, runId); assert.equal(artifact.workflow_run.head_sha, head);
    assert.equal(artifact.digest, 'sha256:' + digest); assert.equal(artifact.size_in_bytes, size);
    assert.equal(job.id, jobId); assert.equal(job.run_id, runId); assert.equal(job.status, 'completed');
    assert.equal(job.conclusion, name === 'passed' ? 'success' : 'failure');
    assert.equal(job.name, 'Android focused safety UI tests / Isolated session-disconnect');
    for (const step of ['Compile isolated app before starting the device', 'Retain focused outcomes and independent cleanup'])
      assert.equal(job.steps.find(row => row.name === step).conclusion, 'success');
    assert.equal(job.steps.find(row => row.name === 'Run one isolated safety flow on its own phone').conclusion, job.conclusion);
    assert.equal(archive.providerDigestVerified, true); assert.equal(archive.originalArchivePublished, false);
    assert.equal(archive.digest, artifact.digest); assert.equal(archive.sizeBytes, size);
    assert.equal(Object.keys(archive.selectedMemberSha256).length, name === 'passed' ? 16 : 6);
    for (const [member, hash] of Object.entries(archive.selectedMemberSha256)) {
      const prefix = member.startsWith('local-ui-evidence/') ? 'local-ui-evidence/' +
        (name === 'passed' ? report.runId : 'db3c14fbbcd8ce43297b1662dfcb14be') + '/' : 'focused-safety-ui/session-disconnect/';
      assert.equal(member, prefix + basename(member)); assert.equal(sha(bytes(name + '/' + basename(member))), hash);
    }
  }
  const transcript = bytes('failed/' + sessionDisconnectTranscripts[0]).toString();
  assert.match(transcript, /Failed to connect to \/10\.0\.2\.2:9099/); assert.match(transcript, /Tests run: 1,\s+Failures: 1/);
  const proxy = json('failed/session-disconnect-proxy-failed.json'); assert.equal(proxy.runId, 'db3c14fbbcd8ce43297b1662dfcb14be');
  assert.equal(proxy.phase, 'reject'); assert.deepEqual(proxy.attempts, []); assert.deepEqual(proxy.transitions, []);
  assert.deepEqual(json('failed/session-disconnect-suite-status.json'), {scope: 'session-disconnect-command-status-not-flow-verification', status: 1});
  const restore = json('failed/disposable-device-restore.json'); assert.equal(restore.restored, true); assert.equal(restore.verified, true);
  assert.equal(restore.observed.continuousGuardVerified, true);
  assert.deepEqual(restore.restoration, {localPackagesRemoved: true, background: true, stopped: true, launcher: true,
    installAdmin: {authorizationRemoved: true, componentRemoved: true, originalPolicyRestored: true}});
  assert.deepEqual(json('failed/source-sha256.json'), report.sourceFiles); assertRetainedSourceFiles(root, report.sourceFiles);
  const review = json('review.json'); assert.equal(review.scope, 'failed-initial-auth-and-passing-two-process-disconnect-not-instability-repair');
  for (const [key, value] of Object.entries({sameBoundSourceFiles: true, originalArchiveDigestsVerified: true,
    failedInitialAuthAttempts: 1, passedNativeCases: 2, localDisconnectReplayAccepted: true})) assert.equal(review[key], value, key);
  for (const key of ['priorAuthFailureFixed', 'rootCauseConfirmed', 'newDiagnosticsExercised', 'fullNativeGateAccepted',
    'physicalDeviceAccepted', 'realNetworkLossVerified', 'productionWrites', 'releaseAccepted']) assert.equal(review[key], false, key);
  assert.deepEqual(review.publishedMedia, []);
  return {failedInitialAuthAttempts: 1, passedNativeCases: 2, localDisconnectReplayAccepted: true, releaseAccepted: false};
}
