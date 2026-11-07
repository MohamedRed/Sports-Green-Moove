import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { assertEvidenceBundleChecksums } from './evidence-bundle-checksums.mjs';
import { assertRetainedSourceFiles } from './retained-source-evidence.mjs';
import { teamPhonePhases, verifyManualTeamCheckpoint } from './manual-team-phone-checkpoints.mjs';

export const teamConnectionRecoveryScope = 'physical-android-team-enrollment-connection-recovery-not-process-restart-proof';
export const teamConnectionRecoveryDirectory = 'docs/release/evidence/team-connection-recovery-phone-2026-10-28';

export function assertTeamConnectionRecovery(run, session, review, cleanup, helper, checkpoints, pairs) {
  assert.equal(run.scope, teamConnectionRecoveryScope);
  assert.equal(run.projectId, 'demo-sgm-local-qa'); assert.match(run.runId, /^[a-f0-9]{32}$/);
  assert.match(run.sourceCommit, /^[a-f0-9]{40}$/); assert.match(run.sourceApkSha256, /^[a-f0-9]{64}$/);
  assert.equal(run.persistedCheckpointsPassed, 2); assert.equal(run.plannedCheckpoints, teamPhonePhases.length);
  for (const flag of ['connectionRecoveryObserved', 'samePendingRequestRestored', 'managerRefusalObservedOnPhone'])
    assert.equal(run[flag], true, flag);
  for (const flag of ['installedBytesIndependentlyVerified', 'completeEnrollmentJourneyAccepted', 'fullProcessRestartProven',
    'physicalInternetLossProven', 'trackingVerified', 'paymentExercised', 'productionWrites', 'releaseEvidenceAccepted', 'newPublicMediaAdded'])
    assert.equal(run[flag], false, flag);
  for (const report of [session, review, cleanup]) {
    assert.equal(report.runId, run.runId); assert.equal(report.projectId, run.projectId);
  }
  assert.equal(session.scope, 'manual-team-persisted-checkpoints-not-ui-or-release-proof');
  assert.equal(session.testedAt, run.testedAt); assert.equal(session.completed, false);
  assert.equal(session.fixtureCleanupVerified, true); assert.equal(session.productionWrites, false);
  assert.equal(session.physicalUiProvenByThisReport, false); assert.equal(session.checkpoints.length, 2);
  assert.equal(review.scope, 'manual-physical-phone-observations-not-independent-process-or-release-proof');
  assert.equal(review.device.physical, true);
  for (const flag of ['parentLoginObserved', 'parentReconnectedWithoutCredentials', 'pendingEnrollmentSeenAgain',
    'clubRefusalConfirmedThroughManagementUi', 'clubRefusalSeenOnPhone', 'managerSignoutObserved', 'providerReturnedToIdleDashboard'])
    assert.equal(review[flag], true, flag);
  for (const flag of ['newEnrollmentRequestSentAfterInterruption', 'completeRestartTrialAccepted', 'providerKillCompletionObserved',
    'androidForceStopControlUsed', 'phoneSignoutObserved', 'uninstallAcknowledgementObserved',
    'packageAbsenceIndependentlyQueried', 'nativeScreenshotExportAccepted', 'videoAccepted', 'newPublicMediaAdded'])
    assert.equal(review[flag], false, flag);
  assert.equal(review.providerKillRequestCount, 2); assert.deepEqual(review.independentPidMeasurements, []);
  assert.equal(checkpoints.length, 2); assert.equal(pairs.length, 2);
  const identity = checkpoints[0].identity;
  for (const [index, checkpoint] of checkpoints.entries()) {
    const [phase, status, revision] = teamPhonePhases[index];
    assert.equal(checkpoint.phase, phase); assert.deepEqual(checkpoint.identity, identity);
    assert.equal(checkpoint.runId, run.runId); assert.equal(checkpoint.projectId, run.projectId);
    assert.deepEqual(session.checkpoints[index], verifyManualTeamCheckpoint(phase, checkpoint.state, identity));
    const [before, after] = pairs[index];
    for (const snapshot of [before, after]) {
      assert.equal(snapshot.scope, 'read-only-original-isolated-enrollment-snapshot-not-ui-proof');
      assert.equal(snapshot.projectId, run.projectId); assert.equal(snapshot.runId, run.runId);
      assert.equal(snapshot.documents.length, 1);
      const document = snapshot.documents[0];
      assert.equal(document.name, `projects/${run.projectId}/databases/(default)/documents/teamEnrollments/${identity.selfEnrollmentId}`);
      assert.equal(document.fields.status.stringValue, status); assert.equal(document.fields.revision.integerValue, String(revision));
      assert.equal(document.fields.teamInstanceId.stringValue, identity.teamInstanceId);
      assert.equal(document.fields.subjectId.stringValue, identity.parentId);
    }
    assert(Date.parse(before.recordedAt) <= Date.parse(after.recordedAt));
    assert.deepEqual(before.documents, after.documents, 'No new write during recovery observation');
  }
  assert.equal(helper.first.exitCode, 0); assert.equal(helper.first.ownerStopRequested, false);
  assert.equal(helper.first.acceptedAsExpectedShutdown, false); assert.equal(helper.first.causeConfirmed, false);
  assert.equal(helper.second.ownerStopRequested, true); assert.equal(helper.second.exitCode, 130);
  assert.equal(helper.inactivityTimeoutMinutes, 10); assert.equal(helper.unchangedNetworkRestrictions, true);
  assert.equal(helper.automaticReconnectAdded, false);
  assert.equal(cleanup.scope, 'independently-observed-owned-runtime-disposal-not-phone-process-proof');
  assert.equal(cleanup.runtimeExitCode, 130); assert.equal(cleanup.helperExitCode, 130);
  for (const flag of ['listenerIdentityObservedBeforeStop', 'processGroupExited', 'endpointsClosed', 'privateSessionAbsent',
    'runtimeAbsent', 'helperDirectoryAbsent', 'earlierHelperDirectoryAbsent']) assert.equal(cleanup[flag], true, flag);
  assert.deepEqual(cleanup.ports, [5001, 8080, 9000, 9099, 5174].map(port => ({port, available: true})));
  assert(Date.parse(cleanup.observedAt) >= Date.parse(review.reviewedAt));
  assert(Date.parse(review.reviewedAt) >= Date.parse(run.testedAt));
  return run;
}

export function validateTeamConnectionRecovery(root, source = teamConnectionRecoveryDirectory + '/summary.json') {
  const base = dirname(resolve(root, source)), json = file => JSON.parse(readFileSync(resolve(base, file)));
  assertEvidenceBundleChecksums(base);
  const run = json('summary.json'), session = json('session-results.json'), helper = json('helper-lifecycle.json');
  const phases = teamPhonePhases.slice(0, 2).map(([phase]) => phase);
  assertTeamConnectionRecovery(run, session, json('ui-review.json'), json('runtime-cleanup.json'), helper,
    phases.map(phase => json(phase + '.json')),
    phases.map(phase => [json(phase + '-before-stop.json'), json(phase + '-after-stop.json')]));
  assertRetainedSourceFiles(root, session.sourceFiles);
  assertRetainedSourceFiles(root, json('fixture-preflight.json').sourceFiles);
  for (const version of Object.values(helper.versions))
    assertRetainedSourceFiles(root, {'scripts/qa/scoped-browserstack-local.mjs': version.sha256});
  return run;
}
