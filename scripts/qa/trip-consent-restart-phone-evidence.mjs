import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {tripConsentPhonePhases, verifyTripConsentPhoneState} from './trip-consent-phone-checkpoints.mjs';
import {assertRetainedSourceFiles} from './retained-source-evidence.mjs';

export const consentRestartPhoneFolder = 'docs/release/evidence/trip-consent-restart-phone-2026-10-28/';
const forceStopPhases = ['proposed', 'first-parent-accepted', 'both-parents-accepted', 'declined', 'withdrawn'];

export function assertConsentRestartPhoneScope(report, review) {
  assert.equal(report.scope, 'independent-trip-consent-record-checkpoints-not-phone-ui-proof');
  assert.equal(report.projectId, 'demo-sgm-local-qa'); assert.match(report.runId, /^[a-f0-9]{32}$/);
  assert.equal(report.runId, review.runId); assert.equal(report.testedAt.slice(0, 10), review.checkedAt);
  for (const key of ['completed', 'adminClientClosed', 'firestoreClientTerminated']) assert.equal(report[key], true);
  for (const key of ['phoneUiProven', 'wholeProcessRestartProven', 'productionWrites', 'applicationExercised', 'realPaymentExercised'])
    assert.equal(report[key], false);
  assert.equal(report.routeProviderRequests, 0); assert.equal(report.protectedRecordCount, 187);
  assert.deepEqual(report.checkpoints.map(row => row.phase), tripConsentPhonePhases);
  for (const row of report.checkpoints) {
    for (const key of ['allBookingsUnchanged', 'tripTermsUnchanged', 'unrelatedRecordsUnchanged', 'allClaimsUnchanged', 'liveTripsUnchanged'])
      assert.equal(row[key], true);
    for (const key of ['applicationExercised', 'routeProviderExercised', 'paymentExercised', 'phoneUiProven']) assert.equal(row[key], false);
  }
  assert.equal(review.scope, 'manual-physical-consent-recovery-after-android-force-stop-not-independent-pid-proof');
  assert.equal(review.checkedAt, '2026-10-28'); assert.equal(review.device, 'Google Pixel 9 Pro'); assert.equal(review.androidVersion, '15.0');
  assert.equal(review.selectedApkSource, '1518a8bdf193e99d27921699fcdcf24544b1aa2c');
  assert.equal(review.selectedApkSha256, '12bd492f7fe4f8360e5c0e70d18e45e633c26cf8c687a0def4451aa5b9c4666f');
  assert.equal(review.originalPriceCents, 250); assert.equal(review.proposedPriceCents, 400);
  assert.deepEqual(review.forceStops.map(row => row.phase), forceStopPhases);
  assert.deepEqual(review.forceStops.map(row => row.account), ['driver', 'parent', 'second-parent', 'parent', 'driver']);
  assert.deepEqual(review.forceStops.map(row => row.restoredState), ['pending-0-of-2', 'pending-1-of-2-own-approval-recorded',
    'confirmed-2-of-2-not-applied', 'declined-history-and-review', 'withdrawn-history-and-review']);
  for (const key of ['physicalDevice', 'productionAndroidSourceDiffEmpty', 'allProposalsAndDecisionsFromPhoneUi',
    'privateDraftReturnedBeforeProposal', 'separateParentsAuthenticated', 'firstParentApprovalNotInheritedBySecond',
    'declinedBookingStillApprovedAtOriginalPrice', 'declinedHistoryEntryOpenedAfterStop', 'withdrawnHistoryEntryOpenedAfterStop',
    'terminalDecisionActionsAbsent', 'signOutToBlankLoginObserved', 'uninstallAcknowledged', 'sessionStopped',
    'eachForceStopTargetVerified', 'eachForceStopConfirmedInAndroidAppInfo', 'eachForceStopDisabledObserved',
    'eachReopenedFromAndroidAppInfo', 'eachSessionReturnedWithoutCredentialEntry']) assert.equal(review[key], true);
  for (const key of ['independentProcessPids', 'installedBytesIndependentlyHashed', 'packageAbsenceIndependentlyProven',
    'twoSimultaneousPhones', 'iosTested', 'productionWrites', 'applicationExercised', 'realPaymentExercised',
    'physicalGpsTested', 'releaseAccepted', 'newVideoAccepted', 'nativeCaptureExportAccepted']) assert.equal(review[key], false);
  assert.equal(review.routeProviderRequests, 0); assert.deepEqual(review.publishedCaptures, []);
  assert.equal(review.preparationFailure.completed, false); assert.equal(review.preparationFailure.checkpoints, 0);
}

export function validateConsentRestartPhone(root, metadata) {
  assert.deepEqual(metadata, {checkedAt: '2026-10-28', source: consentRestartPhoneFolder + 'README.md',
    checksums: consentRestartPhoneFolder + 'artifact-sha256.json'});
  const bytes = file => readFileSync(resolve(root, consentRestartPhoneFolder, file));
  const read = file => JSON.parse(bytes(file));
  const report = read('completed/session-results.json'), review = read('ui-review.json');
  assertConsentRestartPhoneScope(report, review); assertRetainedSourceFiles(root, report.sourceFiles);
  const {fixture, baseline, runId} = read('completed/baseline.json');
  assert.equal(runId, report.runId); assert.deepEqual(fixture, report.fixture);
  assert.equal(Object.values(baseline.documents).reduce((n, rows) => n + rows.length, 0), report.protectedRecordCount);
  for (const own of Object.values(fixture.fixtures)) {
    const {pendingChangeId, updatedAt, ...original} = baseline.documents.trips.find(row => row.id === own.tripId).data;
    assert.equal(pendingChangeId, undefined); assert.deepEqual(own.before, original);
  }
  let previous = '';
  for (const [index, phase] of tripConsentPhonePhases.entries()) {
    const row = read('completed/' + phase + '.json'); assert.equal(row.runId, report.runId); assert.equal(row.projectId, report.projectId);
    assert(row.recordedAt > previous); previous = row.recordedAt;
    assert.deepEqual(verifyTripConsentPhoneState(phase, fixture, row.state, baseline), report.checkpoints[index]);
    assert.deepEqual(row.result, report.checkpoints[index]);
    for (const {data: change} of row.state.documents.tripChanges ?? []) {
      const own = Object.values(fixture.fixtures).find(item => item.tripId === change.tripId); if (!own) continue;
      const trip = own.before; assert.deepEqual(change.originalTerms, {departureAt: trip.departureAt, arrivalBy: trip.arrivalBy ?? null,
        origin: trip.origin, destination: trip.destination, priceCents: trip.priceCents});
    }
  }
  assert(report.testedAt >= previous);
  const failed = read('preparation-failed/session-results.json'); assert.equal(failed.runId, review.preparationFailure.runId);
  assert.notEqual(failed.runId, report.runId); assert.equal(failed.completed, false); assert.deepEqual(failed.checkpoints, []);
  assertRetainedSourceFiles(root, failed.sourceFiles);
  assert.equal(failed.protectedRecordCount, 0);
  const cleanup = read('runtime-cleanup.json'); assert.equal(cleanup.runId, report.runId);
  assert.equal(cleanup.runtimeExitCode, 130); assert.equal(cleanup.helperExitCode, 130);
  for (const row of [cleanup, read('preparation-failed/runtime-cleanup.json')]) {
    assert.equal(row.failed, false); assert.equal(row.projectId, report.projectId);
    for (const key of ['processGroupExited', 'privateSessionAbsent', 'runtimeAbsent', 'endpointsClosed']) assert.equal(row[key], true);
  }
  assert.equal(cleanup.helperDirectoryAbsent, true);
  const expected = ['README.md', 'ui-review.json', 'runtime-cleanup.json', 'completed/baseline.json', 'completed/session-results.json',
    ...tripConsentPhonePhases.map(phase => 'completed/' + phase + '.json'),
    'preparation-failed/session-results.json', 'preparation-failed/runtime-cleanup.json'];
  const manifest = read('artifact-sha256.json'); assert.deepEqual(Object.keys(manifest).sort(), expected.sort());
  for (const [file, hash] of Object.entries(manifest)) assert.equal(createHash('sha256').update(bytes(file)).digest('hex'), hash);
  return report;
}
