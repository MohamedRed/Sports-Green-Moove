import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync, readdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {tripDraftPhonePhases} from './trip-draft-phone-checkpoints.mjs';
import {assertRetainedSourceFiles} from './retained-source-evidence.mjs';

export const scheduleDraftPhoneFolder = 'docs/release/evidence/schedule-draft-phone-2026-10-28/';

export function assertScheduleDraftPhoneScope(report, review) {
  assert.equal(report.projectId, 'demo-sgm-local-qa');
  assert.equal(report.scope, 'independent-private-trip-draft-records-not-storage-or-process-proof');
  assert.match(report.runId, /^[a-f0-9]{32}$/); assert.equal(review.runId, report.runId);
  for (const key of ['completed', 'adminClientClosed', 'firestoreClientTerminated']) assert.equal(report[key], true);
  for (const key of ['physicalUiProvenByThisReport', 'wholeProcessRestartProvenByThisReport', 'draftStorageProvenByThisReport',
    'productionWrites', 'proposalCreated', 'realPaymentExercised']) assert.equal(report[key], false);
  assert.equal(report.providerRequests, 0);
  assert.deepEqual(report.checkpoints.map(row => row.phase), tripDraftPhonePhases);
  for (const row of report.checkpoints) {
    assert.equal(row.status, 'passed');
    for (const key of ['sharedRecordsUnchanged', 'accountClaimsUnchanged', 'liveDataUnchanged']) assert.equal(row[key], true);
    for (const key of ['proposalCreated', 'physicalUiProvenByThisCheckpoint', 'processStopProvenByThisCheckpoint',
      'draftStorageProvenByThisCheckpoint']) assert.equal(row[key], false);
  }
  assert.equal(report.fixture.draftKind, 'schedule'); assert.notEqual(report.fixture.tripId, report.fixture.otherTripId);
  assert.equal(report.fixture.preparationMethod, 'authenticated-local-service');
  assert.deepEqual(report.fixture.schedule, {originalDepartureAt: '2026-10-29T09:00:00.000Z',
    draftDepartureAt: '2026-10-30T11:00:00.000Z', draftArrivalBy: '2026-10-30T12:00:00.000Z'});
  assert.equal(review.scope, 'manual-physical-schedule-draft-not-native-export-or-pid-proof');
  assert.equal(review.checkedAt, '2026-10-28'); assert.equal(report.testedAt.slice(0, 10), review.checkedAt);
  assert.equal(review.device, 'Google Pixel 9 Pro'); assert.equal(review.androidVersion, '15.0');
  assert.equal(review.selectedApkSource, '1518a8bdf193e99d27921699fcdcf24544b1aa2c');
  assert.equal(review.selectedApkSha256, '12bd492f7fe4f8360e5c0e70d18e45e633c26cf8c687a0def4451aa5b9c4666f');
  assert.deepEqual(review.originalDisplay, {date: '29/10/2026', departure: '10:00', arrivalSelected: false});
  assert.deepEqual(review.restoredDisplay, {date: '30/10/2026', departure: '12:00', arrival: '13:00', arrivalSelected: true});
  assert.equal(review.displayTimezone, 'Europe/Brussels');
  for (const key of ['physicalDevice', 'productionAndroidSourceDiffEmpty', 'driverSignInObserved', 'nativeDateAndTimePickersUsed',
    'draftReturnedBeforeStopObserved', 'androidAppInfoTargetVerified', 'nativeForceStopConfirmed', 'forceStopDisabledObserved',
    'reopenedFromAndroidAppInfo', 'sessionRetainedWithoutCredentialEntry', 'draftAfterStopObserved',
    'otherTripCleanBeforeAndAfterStopObserved', 'draftReturnedAfterOtherTripObserved', 'signOutToBlankLoginObserved',
    'uninstallAcknowledged', 'sessionStopped', 'scopedHelperProcessGroupStopped', 'privateHandoffDirectoryRemoved']) assert.equal(review[key], true);
  for (const key of ['processPidsIndependentlyMeasured', 'packageAbsenceIndependentlyProven', 'installedBytesIndependentlyHashed',
    'proposalSubmitted', 'productionWrites', 'realPayment', 'realMaps', 'crossAccountDraftTested', 'crossDeviceTested',
    'iosTested', 'releaseAccepted', 'newVideoAccepted', 'nativeCaptureExportAccepted']) assert.equal(review[key], false);
  assert.equal(review.providerRequests, 0); assert.deepEqual(review.publishedCaptures, []);
  assert.match(review.recordComparisonExclusion, /updatedAt/);
  assert.equal(review.firstAttempt.completed, false); assert.equal(review.firstAttempt.retainedCheckpoints, 3);
  assert.match(review.firstAttempt.failure, /ENOSPC/);
}

export function validateScheduleDraftPhone(root, metadata) {
  assert.deepEqual(metadata, {checkedAt: '2026-10-28', source: scheduleDraftPhoneFolder + 'README.md',
    checksums: scheduleDraftPhoneFolder + 'artifact-sha256.json'});
  const folder = resolve(root, scheduleDraftPhoneFolder), read = file => JSON.parse(readFileSync(resolve(folder, file)));
  const report = read('completed/session-results.json'), review = read('ui-review.json');
  assertScheduleDraftPhoneScope(report, review); assertRetainedSourceFiles(root, report.sourceFiles);
  const fixture = read('completed/fixture-ready.json');
  assert.equal(fixture.runId, report.runId); assert.deepEqual(fixture.fixture, report.fixture);
  let previous = fixture.preparedAt;
  for (const [index, phase] of tripDraftPhonePhases.entries()) {
    const row = read('completed/' + phase + '.json');
    assert.equal(row.runId, report.runId); assert.equal(row.projectId, report.projectId);
    assert.deepEqual(row.result, report.checkpoints[index]); assert(row.recordedAt > previous); previous = row.recordedAt;
  }
  assert(report.testedAt >= previous);
  const earlier = read('attempt-1/session-results.json');
  assert.notEqual(earlier.runId, report.runId); assert.equal(earlier.runId, review.firstAttempt.runId);
  assert.equal(earlier.completed, false); assert.equal(earlier.checkpoints.length, 3);
  assert.deepEqual(earlier.checkpoints.map(row => row.phase), tripDraftPhonePhases.slice(0, 3));
  const firstFixture = read('attempt-1/fixture-ready.json'); assert.equal(firstFixture.runId, earlier.runId);
  for (const [index, phase] of tripDraftPhonePhases.slice(0, 3).entries()) {
    const row = read('attempt-1/' + phase + '.json'); assert.equal(row.runId, earlier.runId);
    assert.deepEqual(row.result, earlier.checkpoints[index]);
  }
  for (const attempt of ['attempt-1', 'completed']) {
    const cleanup = read(attempt + '/runtime-cleanup.json'); assert.equal(cleanup.failed, false);
    for (const key of ['processGroupExited', 'privateSessionAbsent', 'runtimeAbsent', 'endpointsClosed']) assert.equal(cleanup[key], true);
    assert.equal(cleanup.projectId, report.projectId);
  }
  const files = ['README.md', 'ui-review.json', ...['attempt-1', 'completed'].flatMap(dir =>
    readdirSync(resolve(folder, dir)).map(file => dir + '/' + file))];
  const manifest = read('artifact-sha256.json'); assert.deepEqual(Object.keys(manifest).sort(), files.sort());
  assert.equal(files.length, 20);
  for (const [file, expected] of Object.entries(manifest)) {
    assert.match(file, /^(README\.md|ui-review\.json|(attempt-1|completed)\/[a-z-]+\.json)$/);
    assert.equal(createHash('sha256').update(readFileSync(resolve(folder, file))).digest('hex'), expected);
  }
  return report;
}
