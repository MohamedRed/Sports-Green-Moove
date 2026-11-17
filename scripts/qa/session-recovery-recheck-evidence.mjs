import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {basename, resolve} from 'node:path';
import {assertEvidenceBundleChecksums} from './evidence-bundle-checksums.mjs';
import {assertRetainedSourceFiles} from './retained-source-evidence.mjs';
import {assertInstrumentationPassed} from './android-instrumentation-result.mjs';
import {validateSessionRestorationDeviceBundle} from './session-restoration-retained-evidence.mjs';
import {validateSessionTransportObservations} from './session-transport-observations.mjs';
import {validateChatNetworkReplay} from './chat-network-replay-evidence.mjs';

export const recoveryRecheckFolder = 'docs/release/evidence/session-recovery-89fda8c-2026-10-31/';
export function validateRecoveryRecheck(root) {
  const folder = resolve(root, recoveryRecheckFolder), bytes = file => readFileSync(resolve(folder, file));
  const json = file => JSON.parse(bytes(file)), sha = data => createHash('sha256').update(data).digest('hex');
  const head = '89fda8c3f0555a3c77366a77af6e419ab92c5e42', workflow = 41244943224;
  assertEvidenceBundleChecksums(folder);
  const report = validateSessionRestorationDeviceBundle(root,
    recoveryRecheckFolder + 'restoration/session-restoration-results.json', 'transport-observed');
  assert.equal(report.runId, 'b197c7575d68ed9fd69375f586b8ce59');
  validateSessionTransportObservations(json('restoration/session-transport-observations.json'), report.runId, {complete:true});
  const artifact = json('restoration/artifact.json'), archive = json('restoration/archive-verification.json');
  assert.equal(artifact.id, 13059407179); assert.equal(artifact.workflow_run.id, workflow);
  assert.equal(artifact.workflow_run.head_sha, head);
  assert.equal(artifact.digest, 'sha256:7cb1a6dc310f5f019b79a43c6116f8bc53ba0595a20c630879bb078847b79e62');
  assert.equal(archive.providerDigestVerified, true); assert.equal(archive.originalArchivePublished, false);
  assert.equal(archive.sizeBytes, 1131639); assert.equal(archive.sizeBytes, artifact.size_in_bytes);
  assert.equal(archive.digest, artifact.digest); assert.equal(Object.keys(archive.selectedMemberSha256).length, 16);
  for (const [member, hash] of Object.entries(archive.selectedMemberSha256)) {
    const prefix = member.startsWith('local-ui-evidence/') ? 'local-ui-evidence/' + report.runId + '/' :
      'focused-safety-ui/session-restoration/';
    assert.equal(member, prefix + basename(member)); assert.equal(sha(bytes('restoration/' + basename(member))), hash);
  }
  const job = json('restoration/job.json');
  assert.equal(job.id, 124666311837); assert.equal(job.run_id, workflow); assert.equal(job.head_sha, head);
  assert.equal(job.status, 'completed'); assert.equal(job.conclusion, 'success');
  const comparison = json('compared-recovery-sources.json');
  assert.match(comparison.beforeCommit, /^86746f4[a-f0-9]{33}$/); assert.equal(comparison.afterCommit, head);
  assert.equal(comparison.wholeApkIdentityClaimed, false); assert.equal(Object.keys(comparison.files).length, 5);
  for (const [path, hash] of Object.entries(comparison.files)) assert.equal(hash, report.sourceFiles[path]);
  const chat = validateChatNetworkReplay(root, {folder: recoveryRecheckFolder + 'chat', date:'2026-10-31', head,
    runId:'989b4b522f4870e149d0915412aa2110', workflowId:workflow, jobId:124666311870, artifactId:13058602662});
  assert.equal(chat.json('local-chat-network-ui.json').privateDraftPersistenceVersion, 1);
  assert.equal(chat.json('local-chat-network-ui.json').parentDraftRestored, true);
  assert.equal(chat.run.network.parentDraftRestored, true);
  const main = json('main/job.json'), pull = json('main/adb-pull-trip-change-parent-confirmation.json');
  assert.equal(main.id, 124666311619); assert.equal(main.run_id, workflow); assert.equal(main.head_sha, head);
  assert.equal(main.status, 'completed'); assert.equal(main.conclusion, 'failure');
  assert.equal(pull.runId, 'b55a629b962f31d061cf4c38af080e27');
  assert.equal(pull.phase, 'trip-change-parent-confirmation'); assert.equal(pull.completed, false);
  assert.equal(pull.status, 1); assert.equal(pull.signal, null);
  assert.deepEqual(json('main/native-suite-status.json'), {scope:'native-suite-exit-status-not-flow-verification',
    ordinaryTests:0, componentEvidence:0, localReplay:1});
  assert.match(bytes('main/TEST-guarded-components.xml').toString(), /tests="273" failures="0" errors="0" skipped="54"/);
  const restored = json('main/disposable-store-restore.json');
  assert.equal(restored.verified, true); assert.equal(restored.restored, true);
  assert.deepEqual(restored.restoration, {localPackagesRemoved:true, background:true, stopped:true, launcher:true,
    installAdmin:{authorizationRemoved:true, componentRemoved:true, originalPolicyRestored:true}});
  const team = json('team-read/job.json'); assert.equal(team.id, 124666311917);
  assert.equal(team.run_id, workflow); assert.equal(team.head_sha, head); assert.equal(team.conclusion, 'failure');
  const boot = bytes('team-read/boot-failure-excerpt.txt').toString();
  assert.match(boot, /Available: 7003\.84 MB.*need 7372\.80 MB/);
  assert.match(boot, /Timeout waiting for emulator to boot/);
  const self = json('candidate-selftest/failure-observation-selftest.json');
  assert.equal(self.scope, 'android-instrumented-failure-observation-selftests-not-session-flow');
  assert.equal(self.nativeCases, 3); assert.equal(self.passed, 3); assert.equal(self.failed, 0);
  assert.equal(sha(bytes('candidate-selftest/failure-observation-instrumentation.txt')), self.transcriptSha256);
  assertInstrumentationPassed(bytes('candidate-selftest/failure-observation-instrumentation.txt').toString(), 3);
  assertRetainedSourceFiles(root, self.sourceFiles);
  for (const key of ['physicalDevice','backendUsed','sessionRecoveryAccepted','productionWrites','releaseAccepted'])
    assert.equal(self[key], false, key);
  const disposal = json('candidate-selftest/selftest-device-disposal.json');
  for (const key of ['emulatorProcessAbsent','adbDeviceAbsent','consolePortClosed','virtualDeviceDirectoryAbsent','uninstallCommandsSucceeded'])
    assert.equal(disposal[key], true, key);
  assert.equal(disposal.personalDeviceChanged, false); assert.equal(disposal.packageAbsenceIndependentlyMeasured, false);
  const preparation = json('candidate-selftest/local-replay-preparation.json');
  assert.equal(preparation.failedBeforeBoot, true); assert.equal(preparation.fullLocalSessionReplayStarted, false);
  assert.equal(preparation.backendStarted, false); assert.equal(preparation.androidImageAltered, false);
  assert.equal(preparation.virtualDeviceDirectoryAbsent, true); assert.equal(preparation.adbDeviceAbsent, true);
  const review = json('review.json');
  assert.equal(review.scope, 'passing-focused-session-and-chat-rechecks-not-release-or-instability-repair');
  assert.equal(review.sourceCommit, head); assert.equal(review.workflowRunId, workflow); assert.equal(review.sourceLayout, 'transport-observed');
  for (const key of ['restoredParentVerified','ownerDraftRestored','isolatedDriverDraftEmpty']) assert.equal(review[key], true, key);
  for (const key of ['priorSessionFailureFixed','rootCauseOfSessionFailureConfirmed','fullNativeGateAccepted',
    'newFailureCaptureExercisedDuringSessionFailure','diskGuardCiVerified','physicalDeviceAccepted',
    'realNetworkLossVerified','productionWrites','releaseAccepted']) assert.equal(review[key], false, key);
  assert.deepEqual(review.publishedMedia, []);
  return {passedRestorationCases:1, passedChatCases:1, passedDiagnosticCases:3, fullNativeGateAccepted:false, releaseAccepted:false};
}
