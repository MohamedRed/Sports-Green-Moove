import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { tripDraftPhonePhases } from './trip-draft-phone-checkpoints.mjs';
import { assertRetainedSourceFiles } from './retained-source-evidence.mjs';

export function assertTripDraftPhoneScope(report, review) {
  assert.equal(report.projectId, 'demo-sgm-local-qa'); assert.match(report.runId, /^[a-f0-9]{32}$/);
  assert.equal(report.scope, 'independent-private-trip-draft-records-not-storage-or-process-proof');
  for (const key of ['completed', 'adminClientClosed', 'firestoreClientTerminated']) assert.equal(report[key], true);
  for (const key of ['physicalUiProvenByThisReport', 'wholeProcessRestartProvenByThisReport', 'draftStorageProvenByThisReport',
    'productionWrites', 'proposalCreated', 'realPaymentExercised']) assert.equal(report[key], false);
  assert.equal(report.providerRequests, 0); assert.deepEqual(report.checkpoints.map(row => row.phase), tripDraftPhonePhases);
  for (const row of report.checkpoints) {
    assert.equal(row.status, 'passed');
    for (const key of ['sharedRecordsUnchanged', 'accountClaimsUnchanged', 'liveDataUnchanged']) assert.equal(row[key], true);
    for (const key of ['proposalCreated', 'physicalUiProvenByThisCheckpoint', 'processStopProvenByThisCheckpoint',
      'draftStorageProvenByThisCheckpoint']) assert.equal(row[key], false);
  }
  assert.equal(report.fixture.driverUid, 'sgm-qa-driver'); assert.notEqual(report.fixture.tripId, report.fixture.otherTripId);
  assert.equal(report.fixture.preparationMethod, 'authenticated-local-service');
  assert.equal(review.scope, 'manual-physical-private-draft-after-android-force-stop');
  assert.equal(review.checkedAt, '2026-10-26'); assert.equal(review.device, 'Google Pixel 9 Pro'); assert.equal(review.androidVersion, '15.0');
  assert.equal(review.selectedApkSource, '1518a8bdf193e99d27921699fcdcf24544b1aa2c');
  assert.equal(review.selectedApkSha256, '12bd492f7fe4f8360e5c0e70d18e45e633c26cf8c687a0def4451aa5b9c4666f');
  assert.deepEqual(review.restoredRawFields, { price: '4,', origin: 'rue du brouillon qa', destination: 'club du brouillon qa' });
  assert.deepEqual(review.processObservation, { command: 'dumpsys meminfo be.sportgreenmoove.app.local',
    beforePid: 16948, stoppedResult: 'No process found for: be.sportgreenmoove.app.local', reopenedPid: 1308,
    method: 'provider-supported-shell-ui-manual-observation-not-independent-process-receipt' });
  for (const key of ['physicalDevice', 'driverSignInObserved', 'draftBeforeStopObserved', 'otherTripCleanBeforeStopObserved',
    'nativeForceStopConfirmed', 'forceStopDisabledObserved', 'draftAfterStopObserved', 'otherTripCleanAfterStopObserved',
    'draftReturnedAfterOtherTripObserved', 'submitDisabledObserved', 'sessionRetainedWithoutCredentialEntry', 'signOutObserved',
    'uninstallAcknowledged', 'sessionStopped', 'scopedHelperProcessGroupStopped', 'privateHandoffDirectoryRemoved']) assert.equal(review[key], true);
  for (const key of ['scheduleDraftTested', 'otherAccountTested', 'crossDeviceTested', 'iosTested', 'mapSearched', 'proposalSubmitted',
    'productionWrites', 'realPayment', 'releaseAccepted', 'videoAccepted', 'packageAbsenceIndependentlyProven',
    'deviceAdminGuardInstalled', 'installedBytesIndependentlyHashed']) assert.equal(review[key], false);
  assert.equal(review.providerRequests, 0);
  assert.deepEqual(review.capturesReviewed, ['captures/draft-before-stop.png', 'captures/draft-after-stop.png', 'captures/other-trip-after-stop.png']);
}

export function validateTripDraftPhone(root, metadata) {
  const folder = dirname(metadata.source), bytes = file => readFileSync(resolve(root, folder, file));
  const read = file => JSON.parse(bytes(file));
  assert.equal(metadata.checkedAt, '2026-10-26'); assert.equal(metadata.checksums, folder + '/artifact-sha256.json');
  const report = read('session-results.json'), review = read('ui-review.json'), manifest = read('artifact-sha256.json');
  assertTripDraftPhoneScope(report, review); assertRetainedSourceFiles(root, report.sourceFiles);
  const expected = ['README.md', 'ui-review.json', 'trip-records.json', 'fixture-ready.json', 'session-results.json',
    'runtime-cleanup.json', ...tripDraftPhonePhases.map(phase => phase + '.json'), ...review.capturesReviewed];
  assert.deepEqual(Object.keys(manifest).sort(), expected.sort());
  for (const [file, hash] of Object.entries(manifest)) assert.equal(createHash('sha256').update(bytes(file)).digest('hex'), hash);
  const fixture = read('fixture-ready.json'); assert.equal(fixture.runId, report.runId); assert.equal(fixture.projectId, report.projectId);
  assert.deepEqual(fixture.fixture, report.fixture); let recordedAt = fixture.preparedAt;
  for (const [index, phase] of tripDraftPhonePhases.entries()) {
    const row = read(phase + '.json'); assert.equal(row.runId, report.runId); assert.equal(row.projectId, report.projectId);
    assert.deepEqual(row.result, report.checkpoints[index]); assert(row.recordedAt > recordedAt); recordedAt = row.recordedAt;
  }
  assert(report.testedAt >= recordedAt); assert.equal(report.testedAt.slice(0, 10), metadata.checkedAt);
  const records = read('trip-records.json'); assert.equal(records.runId, report.runId); assert.equal(records.projectId, report.projectId);
  assert.equal(records.scope, 'sanitized-baseline-trip-projection-not-ui-or-full-record-replay');
  assert.deepEqual(records.trips.map(row => row.id).sort(), [report.fixture.tripId, report.fixture.otherTripId].sort());
  assert.deepEqual(records.bookings.map(row => row.id).sort(), [...report.fixture.bookingIds].sort());
  for (const trip of records.trips) { assert.equal(trip.data.driverUserId, report.fixture.driverUid); assert.equal(trip.data.priceCents, 250); }
  for (const booking of records.bookings) assert(records.trips.some(row => row.id === booking.data.tripId));
  assert.equal(records.claims.uid, report.fixture.driverUid);
  for (const file of review.capturesReviewed) {
    const png = bytes(file); assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
    assert.equal(png.readUInt32BE(16), 960); assert.equal(png.readUInt32BE(20), 2142);
  }
  const cleanup = read('runtime-cleanup.json'); assert.equal(cleanup.failed, false);
  for (const key of ['processGroupExited', 'privateSessionAbsent', 'runtimeAbsent', 'endpointsClosed']) assert.equal(cleanup[key], true);
}
