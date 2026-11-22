import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { childEmergencyPhonePhases } from './child-emergency-phone-checkpoints.mjs';
import { assertRetainedSourceFiles } from './retained-source-evidence.mjs';

export function assertChildEmergencyPhoneScope(report, review) {
  assert.equal(report.projectId, 'demo-sgm-local-qa'); assert.match(report.runId, /^[a-f0-9]{32}$/);
  assert.equal(report.scope, 'independent-child-contact-records-not-permission-or-dialer-proof');
  assert.equal(report.completed, true);
  for (const key of ['adminClientClosed', 'firestoreClientTerminated']) assert.equal(report[key], true);
  for (const key of ['physicalUiProvenByThisReport', 'locationPermissionProvenByThisReport', 'dialerHandoffProvenByThisReport',
    'productionWrites', 'signupProven', 'parentUiProven']) assert.equal(report[key], false);
  assert.deepEqual(report.checkpoints.map(row => row.phase), childEmergencyPhonePhases);
  for (const row of report.checkpoints) {
    assert.equal(row.status, 'passed');
    for (const key of ['recordsUnchanged', 'accountClaimsUnchanged', 'currentContactRead']) assert.equal(row[key], true);
    for (const key of ['physicalUiProvenByThisCheckpoint', 'locationPermissionProvenByThisCheckpoint', 'dialerHandoffProvenByThisCheckpoint'])
      assert.equal(row[key], false);
  }
  const fixture = report.fixture;
  assert.notEqual(fixture.childUid, fixture.parentUid); assert.notEqual(fixture.childUid, fixture.childId);
  assert.equal(fixture.accountProvisionedByFixture, true);
  assert.deepEqual(fixture.contact, { name: 'Contact enfant fictif QA', phone: '+12025550121' });
  for (const key of ['accountApprovalMethod', 'ridePreparationMethod', 'contactPreparationMethod'])
    assert.equal(fixture[key], 'authenticated-local-service');
  assert.equal(fixture.providerRequests, 0);
  for (const key of ['signupProven', 'parentUiProven', 'productionWrites']) assert.equal(fixture[key], false);
  assert.equal(review.scope, 'manual-physical-child-contact-with-denied-location-not-dialer-or-signup');
  assert.equal(review.checkedAt, '2026-10-26'); assert.equal(review.device, 'Google Pixel 9 Pro'); assert.equal(review.androidVersion, '15.0');
  assert.equal(review.selectedApkSource, '1518a8bdf193e99d27921699fcdcf24544b1aa2c');
  assert.equal(review.selectedApkSha256, '12bd492f7fe4f8360e5c0e70d18e45e633c26cf8c687a0def4451aa5b9c4666f');
  assert.equal(review.locationPermissionObserved, "Don't allow");
  for (const key of ['physicalDevice', 'childSignInObserved', 'currentChildContactObserved', 'contactAfterSettingsReturnObserved',
    'appDialerButtonAttempted', 'independentPhoneIconAttempted', 'appReturnObserved', 'signOutObserved',
    'uninstallAcknowledged', 'sessionStopped', 'scopedHelperProcessGroupStopped', 'privateHandoffDirectoryRemoved']) assert.equal(review[key], true);
  for (const key of ['dialerHandoffProven', 'callPlaced', 'rootCauseEstablished', 'wholeProcessRestartProven', 'signupProven',
    'parentUiProven', 'trackingProven', 'productionWrites', 'realPayment', 'releaseAccepted', 'videoAccepted',
    'packageAbsenceIndependentlyProven', 'locationPermissionChanged', 'deviceAdminGuardInstalled', 'installedBytesIndependentlyHashed'])
    assert.equal(review[key], false);
  assert.equal(review.providerRequests, 0);
  for (const key of ['appDialerAttemptResult', 'independentPhoneIconResult']) assert.equal(review[key], 'android-home-no-dialer-observed');
  assert.deepEqual(review.galleryCaptures, ['captures/contact-ready.png', 'captures/location-denied.png']);
  assert.deepEqual(review.retainedOnlyCaptures, ['captures/handoff-unresolved.png']);
  assert.deepEqual(review.capturesReviewed, [...review.galleryCaptures, ...review.retainedOnlyCaptures]);
}

export function validateChildEmergencyPhone(root, metadata) {
  const folder = dirname(metadata.source), bytes = file => readFileSync(resolve(root, folder, file));
  const read = file => JSON.parse(bytes(file));
  assert.equal(metadata.checkedAt, '2026-10-26'); assert.equal(metadata.checksums, folder + '/artifact-sha256.json');
  const manifest = read('artifact-sha256.json'), report = read('session-results.json'), review = read('ui-review.json');
  const expected = ['README.md', 'ui-review.json', 'contact-records.json', 'fixture-ready.json', 'session-results.json',
    'runtime-cleanup.json', ...childEmergencyPhonePhases.map(phase => phase + '.json'), ...review.capturesReviewed];
  assert.deepEqual(Object.keys(manifest).sort(), expected.sort());
  for (const [file, hash] of Object.entries(manifest)) assert.equal(createHash('sha256').update(bytes(file)).digest('hex'), hash);
  assertChildEmergencyPhoneScope(report, review); assertRetainedSourceFiles(root, report.sourceFiles);
  const fixture = read('fixture-ready.json');
  assert.equal(fixture.runId, report.runId); assert.equal(fixture.projectId, report.projectId); assert.deepEqual(fixture.fixture, report.fixture);
  let recordedAt = fixture.preparedAt;
  for (const [index, phase] of childEmergencyPhonePhases.entries()) {
    const row = read(phase + '.json');
    assert.equal(row.runId, report.runId); assert.equal(row.projectId, report.projectId);
    assert.deepEqual(row.result, report.checkpoints[index]); assert(row.recordedAt > recordedAt); recordedAt = row.recordedAt;
  }
  assert(report.testedAt >= recordedAt); assert.equal(report.testedAt.slice(0, 10), metadata.checkedAt);
  const records = read('contact-records.json');
  assert.equal(records.scope, 'sanitized-baseline-contact-projection-not-ui-or-full-record-replay');
  assert.equal(records.runId, report.runId); assert.equal(records.projectId, report.projectId);
  assert.equal(records.link.id, report.fixture.childUid); assert.equal(records.link.data.verifiedByUserId, report.fixture.parentUid);
  assert.equal(records.link.data.childId, report.fixture.childId); assert.equal(records.link.data.childInstanceId, report.fixture.childInstanceId);
  assert.equal(records.link.data.accountUserId, report.fixture.childUid); assert.equal(records.link.data.status, 'verified');
  assert.equal(records.contactView.accountUserId, report.fixture.childUid);
  const view = records.contactView.current; assert.equal(view.accountUserId, report.fixture.childUid);
  assert.equal(view.subjectId, report.fixture.childId); assert.equal(view.childInstanceId, report.fixture.childInstanceId);
  assert.equal(view.rideSessionId, report.fixture.rideSessionId); assert.deepEqual(view.contact, report.fixture.contact); assert.equal(view.revision, 1);
  assert.equal(records.claims.uid, report.fixture.childUid); assert.deepEqual(records.claims.claims, { roleKeys: ['child'] });
  for (const file of review.capturesReviewed) {
    const png = bytes(file); assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
    assert.equal(png.readUInt32BE(16), 960); assert.equal(png.readUInt32BE(20), 2142);
  }
  const cleanup = read('runtime-cleanup.json'); assert.equal(cleanup.failed, false);
  for (const key of ['processGroupExited', 'privateSessionAbsent', 'runtimeAbsent', 'endpointsClosed']) assert.equal(cleanup[key], true);
}
