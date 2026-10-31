import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { assertEvidenceBundleChecksums } from './evidence-bundle-checksums.mjs';
import { assertRetainedSourceFiles } from './retained-source-evidence.mjs';
import { teamPhonePhases, verifyManualTeamCheckpoint } from './manual-team-phone-checkpoints.mjs';

export const teamRestartDirectory = 'docs/release/evidence/phone-team-enrollment-restart-2026-10-28';
export const teamRestartCapturePhases = teamPhonePhases.slice(2).map(([phase]) => phase);
const packageName = 'be.sportgreenmoove.app.local';
const time = item => { const value = Date.parse(item.observedAt ?? item.recordedAt); assert(Number.isFinite(value)); return value; };

export function assertTeamProcessRestart({ run, session, observations, checkpoints, pairs, cleanup, removal, approval, captures, consoleText }) {
  assert.equal(run.scope, 'physical-android-team-enrollment-seven-process-restarts-not-release-proof');
  assert.equal(run.projectId, 'demo-sgm-local-qa'); assert.match(run.runId, /^[a-f0-9]{32}$/);
  assert.match(run.sourceCommit, /^[a-f0-9]{40}$/); assert.match(run.sourceApkSha256, /^[a-f0-9]{64}$/);
  assert.equal(run.device.physical, true); assert.equal(run.device.count, 1); assert.equal(run.device.os, 'Android 15');
  assert.equal(run.completedCheckpoints, 7); assert.equal(run.verifiedProcessRestarts, 7);
  for (const flag of ['fullEnrollmentJourneyObserved', 'allDocumentPairsUnchanged', 'guardianRelationPreparedAsFixture'])
    assert.equal(run[flag], true, flag);
  for (const flag of ['installedBytesIndependentlyVerified', 'guardianReviewUiVerifiedThisRun', 'physicalInternetLossProven',
    'trackingVerified', 'paymentExercised', 'pushDeliveryVerified', 'productionWrites', 'releaseEvidenceAccepted',
    'nativeScreenshotExportAccepted', 'videoAccepted']) assert.equal(run[flag], false, flag);
  for (const report of [session, cleanup, removal]) {
    assert.equal(report.runId, run.runId); assert.equal(report.projectId, run.projectId);
  }
  assert.equal(session.scope, 'manual-team-persisted-checkpoints-not-ui-or-release-proof');
  assert.equal(session.testedAt, run.testedAt); assert.equal(session.completed, true);
  assert.equal(session.fixtureCleanupVerified, true); assert.equal(session.productionWrites, false);
  assert.equal(session.physicalUiProvenByThisReport, false);
  assert.equal(session.checkpoints.length, 7); assert.equal(checkpoints.length, 7); assert.equal(pairs.length, 7);
  const observation = phase => {
    const rows = observations.filter(row => row.phase === phase); assert.equal(rows.length, 1, phase); return rows[0];
  };
  const identity = checkpoints[0].identity, sequence = [observation('initial-process').pid];
  for (const [index, checkpoint] of checkpoints.entries()) {
    const [phase, selfStatus, selfRevision, childStatus, childRevision] = teamPhonePhases[index];
    assert.equal(checkpoint.phase, phase); assert.deepEqual(checkpoint.identity, identity);
    assert.equal(checkpoint.runId, run.runId); assert.equal(checkpoint.projectId, run.projectId);
    assert.deepEqual(session.checkpoints[index], verifyManualTeamCheckpoint(phase, checkpoint.state, identity));
    const before = observation(phase + '-process-before-stop'), stop = observation(phase + '-native-stop');
    const absent = observation(phase + '-process-stopped'), home = observation(phase + '-home-restored');
    const restored = observation(phase + '-restored'), after = observation(phase + '-process-restarted');
    assert.equal(stop.appInfoName, 'SPORTS GREEN-mOOVe');
    assert.equal(stop.androidForceStopConfirmed ?? stop.androidForceStopConfirmationClicked, true);
    assert.equal(before.package, packageName); assert.equal(after.package, packageName);
    assert(Number.isInteger(before.pid) && before.pid > 0); assert(Number.isInteger(after.pid) && after.pid > 0);
    assert.notEqual(before.pid, after.pid); assert.equal(absent.processAbsent, true);
    assert.equal(absent.command, 'dumpsys meminfo ' + packageName);
    assert.equal(home.homeSeen, true); assert.equal(home.credentialsReentered, false);
    assert.equal(restored.credentialsReentered, false); assert.notEqual(restored.newRequestSubmitted, true);
    for (const [earlier, later] of [[before, stop], [stop, absent], [absent, home], [home, restored], [restored, after]])
      assert(time(earlier) <= time(later), phase + ' observation order');
    if (index) assert.equal(before.pid, sequence.at(-1));
    sequence.push(before.pid, after.pid);
    const labels = {requested: 'En attente', refused: 'Inscription refusée', approved: 'Inscription approuvée', withdrawn: 'Inscription retirée'};
    if (childRevision) {
      assert.equal(restored.childStatus, labels[childStatus]); assert.equal(restored.parentStatus, labels[selfStatus]);
    } else assert.equal(restored.status, labels[selfStatus]);
    const [first, last] = pairs[index];
    for (const snapshot of [first, last]) {
      assert.equal(snapshot.scope, 'read-only-original-isolated-enrollment-snapshot-not-ui-proof');
      assert.equal(snapshot.projectId, run.projectId); assert.equal(snapshot.runId, run.runId);
      assert.equal(snapshot.documents.length, childRevision ? 2 : 1);
      for (const [id, subject, kind, status, revision] of [
        [identity.selfEnrollmentId, identity.parentId, 'member', selfStatus, selfRevision],
        [identity.childEnrollmentId, identity.childId, 'child', childStatus, childRevision],
      ]) {
        if (!revision) continue;
        const document = snapshot.documents.find(row => row.name === `projects/${run.projectId}/databases/(default)/documents/teamEnrollments/${id}`);
        assert(document); assert.equal(document.fields.subjectId.stringValue, subject);
        assert.equal(document.fields.subjectKind.stringValue, kind); assert.equal(document.fields.status.stringValue, status);
        assert.equal(document.fields.revision.integerValue, String(revision));
        assert.equal(document.fields.teamInstanceId.stringValue, identity.teamInstanceId);
      }
    }
    // The first two UI notes were recorded just after the document read.
    assert(time(first) <= time(stop)); assert(time(last) >= time(home));
    assert.deepEqual(first.documents, last.documents, 'No writes or replacement during restoration');
  }
  const pids = [...consoleText.matchAll(/MEMINFO in pid (\d+) \[be\.sportgreenmoove\.app\.local\]/g)].map(match => Number(match[1]));
  assert.deepEqual(pids, sequence);
  assert.equal(consoleText.split('No process found for: ' + packageName).length - 1, 7);
  for (const phase of ['self-refused-manager', 'self-approved-manager', 'child-approved-manager'])
    assert.equal(observation(phase).confirmationThroughUi, true);
  for (const phase of ['manager-signed-out', 'parent-signed-out']) assert.equal(observation(phase).blankLoginFormObserved, true);
  assert.equal(observation('phone-session-released').idleDashboardObserved, true);
  assert.equal(removal.command, 'dumpsys package ' + packageName);
  assert.equal(removal.output, 'Unable to find package: ' + packageName);
  assert.equal(removal.initialNativeRemovalCompleted, false); assert.equal(removal.providerUninstallAcknowledged, true);
  assert.equal(removal.packageAbsenceIndependentlyObserved, true);
  for (const flag of ['listenerIdentityObservedBeforeStop', 'processGroupExited', 'endpointsClosed', 'privateSessionAbsent',
    'runtimeAbsent', 'helperDirectoryAbsent', 'previewStopRequested']) assert.equal(cleanup[flag], true, flag);
  assert.equal(cleanup.runtimeExitCode, 130); assert.equal(cleanup.helperExitCode, 130);
  assert.equal(cleanup.observerExitCode, 0); assert.equal(cleanup.previewExitCode, 1);
  assert.deepEqual(cleanup.ports, [5001, 8080, 9000, 9099, 5174].map(port => ({port, available: true})));
  assert(time(cleanup) >= time(observation('phone-session-released')));
  assert.equal(approval.approved, true); assert.equal(approval.nativeExportClaimAllowed, false);
  assert.equal(approval.scope, 'session-window-captures-for-progress-website-not-native-exports');
  assert.equal(approval.publicAudienceUnchanged, true);
  assert.equal(run.publicCaptureMethod, 'browser-session-window-not-native-export');
  assert.equal(run.publicCaptureCount, 5); assert.equal(captures.length, 5);
  assert.deepEqual(captures.map(row => row.phase), teamRestartCapturePhases);
  for (const capture of captures) {
    assert.equal(capture.original, observation(capture.phase + '-restored').capture);
    assert.deepEqual(capture.crop, approval.deviceRectangle);
    assert.equal(capture.method, run.publicCaptureMethod);
    assert.equal(capture.reviewedSyntheticContentOnly, true);
  }
  return run;
}

export function validateTeamProcessRestart(root, source = teamRestartDirectory + '/summary.json') {
  const base = dirname(resolve(root, source)), json = file => JSON.parse(readFileSync(resolve(base, file + '.json')));
  assertEvidenceBundleChecksums(base);
  const report = { run: json('summary'), session: json('checkpoints/session-results'), observations: json('ui-observations'),
    checkpoints: teamPhonePhases.map(([phase]) => json('checkpoints/' + phase)),
    pairs: teamPhonePhases.map(([phase]) => [json(phase + '-before-stop'), json(phase + '-after-stop')]),
    cleanup: json('runtime-cleanup'), removal: json('package-absence'), approval: json('session-capture-approval'),
    captures: json('public-captures'), consoleText: readFileSync(resolve(base, 'process-console-text.txt'), 'utf8') };
  assertTeamProcessRestart(report); assertRetainedSourceFiles(root, report.session.sourceFiles);
  for (const capture of report.captures) {
    assert.equal(createHash('sha256').update(readFileSync(resolve(base, capture.original))).digest('hex'), capture.originalSha256);
    assert.equal(capture.file, 'captures/' + capture.phase + '.png');
    const png = readFileSync(resolve(base, capture.file));
    assert.equal(png.subarray(1, 4).toString(), 'PNG');
    assert.equal(png.readUInt32BE(16), capture.crop.width); assert.equal(png.readUInt32BE(20), capture.crop.height);
  }
  return report.run;
}
