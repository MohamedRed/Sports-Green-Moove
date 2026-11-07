import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import {imageSize} from 'image-size';
import {assertEvidenceBundleChecksums} from './evidence-bundle-checksums.mjs';
import {assertRetainedSourceFiles} from './retained-source-evidence.mjs';
import {cancellationPhonePhases, normalizeCancellationProfiles, verifyCancellationPhoneCheckpoint} from './trip-cancellation-phone-checkpoints.mjs';

export const cancellationEvidenceDirectory = 'docs/release/evidence/trip-cancellation-phone-2026-10-28';
export const cancellationCaptureNames = ['01-cancellation-preview', '02-cancellation-recorded',
  '04-reopened-cancelled-history', '05-parent-child-reservations', '06-parent-notice',
  '07-second-parent-reservation', '08-second-parent-notice'];

export function assertCancellationPhoneEvidence({summary, session, baseline, checkpoints, review, cleanup, process}) {
  assert.equal(summary.scope, 'physical-android-whole-trip-cancellation-not-concurrent-race-or-release-proof');
  assert.equal(summary.projectId, 'demo-sgm-local-qa'); assert.match(summary.runId, /^[a-f0-9]{32}$/);
  assert.match(summary.sourceBaselineCommit, /^[a-f0-9]{40}$/); assert.match(summary.sourceApkSha256, /^[a-f0-9]{64}$/);
  assert.equal(summary.device, 'Google Pixel 9 Pro / Android 15'); assert.equal(summary.physicalDeviceCount, 1);
  assert.equal(summary.completedCheckpoints, 12); assert.equal(summary.publicCaptureMethod, 'browser-session-window-not-native-export');
  assert.equal(summary.publicCaptureCount, cancellationCaptureNames.length);
  assert.deepEqual(summary.publicCaptures, cancellationCaptureNames);
  for (const flag of ['installedBytesIndependentlyVerified', 'concurrentRaceProven', 'refundDeliveryVerified',
    'pushDeliveryVerified', 'productionWrites', 'productionDeployed', 'releaseComplete', 'videoAccepted',
    'nativeScreenshotExportAccepted']) assert.equal(summary[flag], false, flag);
  assert.equal(summary.providerMapRequests, 0); assert.equal(summary.realPaymentExercised, false);
  assert.equal(session.scope, 'independent-whole-trip-cancellation-records-not-phone-ui-or-race-proof');
  assert.equal(session.completed, true); assert.equal(session.failure, null); assert.equal(session.testedAt, summary.testedAt);
  for (const flag of ['adminClientClosed', 'firestoreClientTerminated']) assert.equal(session[flag], true);
  for (const flag of ['physicalUiProven', 'wholeProcessRestartProven', 'concurrentRaceProven',
    'pushDeliveryVerified', 'productionWrites', 'realPaymentExercised']) assert.equal(session[flag], false);
  assert.equal(session.providerRequests, 0); assert.deepEqual(session.fixture, baseline.fixture);
  assert.deepEqual(baseline.fixture.parentUids, ['sgm-qa-parent', 'sgm-qa-cancel-parent-two']);
  assert.equal(baseline.fixture.syntheticPaidMetadata, false); assert.equal(baseline.fixture.realPaymentExercised, false);
  const booking = id => baseline.baseline.documents.bookings.find(row => row.id === id)?.data;
  const approved = booking(baseline.fixture.approvedBookingId), pending = booking(baseline.fixture.pendingBookingId);
  assert(approved && pending); assert.equal(approved.status, 'approved'); assert.equal(approved.seats, 2);
  assert.equal(approved.childId, 'sgm-qa-child-lina'); assert.equal(approved.parentUserId, 'sgm-qa-parent');
  assert.equal(pending.status, 'requested'); assert.equal(pending.seats, 1); assert(!pending.childId);
  assert.equal(pending.parentUserId, 'sgm-qa-cancel-parent-two');
  assert.equal(booking(baseline.fixture.alreadyClosedBookingId)?.status, 'cancelled');
  for (const row of [session, baseline, cleanup, ...checkpoints]) {
    assert.equal(row.projectId, summary.projectId); assert.equal(row.runId, summary.runId);
  }
  assert.equal(checkpoints.length, 12); assert.equal(session.checkpoints.length, 12);
  let previous;
  for (const [index, row] of checkpoints.entries()) {
    assert.equal(row.result.phase, cancellationPhonePhases[index]);
    const result = verifyCancellationPhoneCheckpoint(row.result.phase, baseline.baseline, row.state, baseline.fixture);
    assert.deepEqual(row.result, result); assert.deepEqual(session.checkpoints[index], result);
    if (index > 4) {
      // Profile initialization timestamps may change across the three explicitly tested accounts.
      assert.deepEqual(normalizeCancellationProfiles(row.state, baseline.fixture), normalizeCancellationProfiles(previous, baseline.fixture));
    }
    previous = row.state;
  }
  assert.equal(review.scope, 'manual-review-of-session-window-ui-separate-from-independent-stored-checkpoints');
  assert.equal(review.accountsTested, 3); assert.equal(review.syntheticContentOnly, true);
  assert.equal(review.sessionCapturesApproved, true); assert.equal(review.publicAudienceUnchanged, true);
  assert.equal(review.stopMethod, 'provider-kill-apps-with-independent-package-process-measurements');
  for (const flag of ['blankReasonConfirmationDisabled', 'dismissalKeptTrip', 'reasonConfirmed',
    'cancelledAcknowledgement', 'cancelledTripHasNoCancelAction', 'cancelledTripRestoredAfterNewProcess',
    'firstParentChildTwoSeatsCancelled', 'firstParentOlderClosedBookingVisible', 'firstParentNoticeVisible',
    'secondParentOnlyOwnOneSeatCancelled', 'secondParentOnlyOwnNoticeVisible', 'blankLoginAfterSignOut',
    'uninstallAcknowledgementObserved', 'idleDashboardAfterStop']) assert.equal(review[flag], true, flag);
  const pids = process.before.match(/MEMINFO in pid (\d+) \[be\.sportgreenmoove\.app\.local\]/);
  const restarted = process.reopened.match(/MEMINFO in pid (\d+) \[be\.sportgreenmoove\.app\.local\]/);
  assert(pids && restarted); assert.notEqual(pids[1], restarted[1]);
  assert.match(process.stopped, /No process found for: be\.sportgreenmoove\.app\.local/);
  assert.match(process.removed, /Unable to find package: be\.sportgreenmoove\.app\.local/);
  assert.equal(cleanup.observerExitCode, 0); assert.equal(cleanup.runtimeExitCode, 130); assert.equal(cleanup.helperExitCode, 130);
  for (const flag of ['listenerIdentityObservedBeforeStop', 'ownedProcessesAbsent', 'runtimeAbsent',
    'helperDirectoryAbsent', 'privateSessionAbsent']) assert.equal(cleanup[flag], true, flag);
  assert.deepEqual(cleanup.ports, [5001, 8080, 9000, 9099, 45690, 45691].map(port => ({port, available: true})));
  return summary;
}

export function validateCancellationPhoneEvidence(root, source = cancellationEvidenceDirectory + '/summary.json') {
  const base = dirname(resolve(root, source)), json = name => JSON.parse(readFileSync(resolve(base, name + '.json')));
  assertEvidenceBundleChecksums(base);
  const read = name => readFileSync(resolve(base, name), 'utf8');
  const report = {summary: json('summary'), session: json('phone/checkpoints/session-results'), baseline: json('phone/checkpoints/baseline'),
    checkpoints: cancellationPhonePhases.map(phase => json('phone/checkpoints/' + phase)), review: json('phone/ui-review'),
    cleanup: json('phone/runtime-disposal'), process: {before: read('phone/process-before-stop-ax.txt'),
      stopped: read('phone/process-stopped-ax.txt'), reopened: read('phone/process-reopened-ax.txt'), removed: read('phone/package-removed-ax.txt')}};
  assertCancellationPhoneEvidence(report); assertRetainedSourceFiles(root, report.session.sourceFiles);
  assertRetainedSourceFiles(root, json('native-build-sources'));
  assert.deepEqual(json('build-configuration'), {applicationId: 'be.sportgreenmoove.app.local',
    usesIsolatedServices: true, emulatorHost: 'localhost', sourceApkNotInstalledByteProof: true});
  assert.match(read('gradle.txt'), /BUILD SUCCESSFUL/);
  for (const phase of cancellationPhonePhases) {
    const original = json('phone/checkpoints/observed-' + phase), retained = json('phone/checkpoints/' + phase);
    assert.equal(original.phase, phase); assert.equal(original.runId, report.summary.runId);
    assert.deepEqual(original.state, retained.state);
  }
  for (const name of cancellationCaptureNames) {
    const image = imageSize(readFileSync(resolve(base, 'captures', name + '.jpg')));
    assert.equal(image.type, 'jpg'); assert.equal(image.width, 244); assert.equal(image.height, 540);
  }
  return report.summary;
}
