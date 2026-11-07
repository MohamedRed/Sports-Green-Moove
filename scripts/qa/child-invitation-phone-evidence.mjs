import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { assertRetainedSourceFiles } from './retained-source-evidence.mjs';
import { invitationPhonePhases, verifyInvitationPhoneCheckpoint } from './child-invitation-phone-checkpoints.mjs';

export function validateInvitationPhoneArtifacts(root, metadata) {
  const folder = dirname(metadata.source), bytes = file => readFileSync(resolve(root, folder, file));
  const read = file => JSON.parse(bytes(file));
  assert.equal(metadata.checkedAt, '2026-10-26'); assert.equal(metadata.checksums, folder + '/artifact-sha256.json');
  const manifest = read('artifact-sha256.json');
  assert.deepEqual(Object.keys(manifest).sort(), ['README.md', 'ui-review.json', 'invitation-records.json', 'session-results.json',
    'fixture-ready.json', 'runtime-cleanup.json', 'captures/invitation-created.png', 'captures/invitation-revoked.png'].sort());
  for (const [file, hash] of Object.entries(manifest)) assert.equal(createHash('sha256').update(bytes(file)).digest('hex'), hash);
  const report = read('session-results.json'), fixture = read('fixture-ready.json'), review = read('ui-review.json');
  assert.equal(report.scope, 'independent-invitation-phone-records-not-system-share-proof');
  assert.equal(report.completed, true); assert.equal(report.projectId, 'demo-sgm-local-qa');
  assert.equal(report.runId, fixture.runId); assert.equal(report.projectId, fixture.projectId);
  assert.equal(report.testedAt.slice(0, 10), metadata.checkedAt); assert.equal(review.checkedAt, metadata.checkedAt);
  for (const key of ['systemShareProvenByThisReport', 'signupProven', 'parentApprovalProven', 'productionWrites']) assert.equal(report[key], false);
  assert.deepEqual(report.checkpoints.map(row => row.phase), invitationPhonePhases);
  for (const row of report.checkpoints) {
    assert.equal(row.status, 'passed');
    for (const key of ['accountClaimsUnchanged', 'protectedRecordsUnchanged']) assert.equal(row[key], true);
    for (const key of ['systemShareProvenByThisCheckpoint', 'signupProven', 'parentApprovalProven']) assert.equal(row[key], false);
  }
  for (const value of [report, fixture]) {
    assertRetainedSourceFiles(root, value.sourceFiles);
    for (const key of ['adminClientClosed', 'firestoreClientTerminated']) assert.equal(value[key], true);
  }
  assert.equal(fixture.childAccountProvisionedByFixture, true); assert.equal(fixture.accountLinkPreseeded, false);
  const records = read('invitation-records.json');
  assert.equal(records.scope, 'sanitized-independent-invitation-record-projections-not-ui-proof');
  assert.deepEqual(records.observations.map(row => row.phase), invitationPhonePhases);
  const states = records.observations.map(row => ({ documents: { childAccountInvitations: row.invitations,
    childAccountInvitationOwners: row.owners }, claims: [], liveData: null }));
  states.forEach((state, index) => verifyInvitationPhoneCheckpoint(invitationPhonePhases[index], states[0], state, fixture.fixture, states[index - 1]));
  assert.equal(review.scope, 'manual-physical-invitation-ui-review-not-recipient-delivery-or-signup');
  assert.equal(review.systemChooserObserved, true); assert.equal(review.systemPackage, 'com.android.intentresolver');
  assert.equal(review.headline, 'Sharing link'); assert.equal(review.recordHashMatched, true);
  assert.equal(review.sharedOrigin, 'https://sports-green-moove-prod.web.app'); assert.equal(review.sharedPath, '/child-invitation');
  assert.equal(review.sharedTokenSha256, records.observations[2].invitations[0].id);
  for (const key of ['externalDeliveryProven', 'signupProven', 'parentApprovalProven', 'productionWrites', 'videoAccepted', 'packageAbsenceIndependentlyProven'])
    assert.equal(review[key], false);
  assert.equal(review.publicLanding.childSignupAvailable, false); assert.equal(review.publicLanding.observedHeading, 'Admin console');
  assert.equal(review.publicLanding.credentialsEntered, false); assert.equal(review.publicLanding.invitationTokenEntered, false);
  assert.equal(review.uninstallAcknowledged, true); assert.equal(review.sessionStopped, true); assert.equal(review.providerRequests, 0);
  for (const file of review.capturesReviewed) {
    const png = bytes(file); assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
    assert.equal(png.readUInt32BE(16), 960); assert.equal(png.readUInt32BE(20), 2142);
  }
  const cleanup = read('runtime-cleanup.json'); assert.equal(cleanup.failed, false);
  for (const key of ['processGroupExited', 'privateSessionAbsent', 'runtimeAbsent', 'endpointsClosed']) assert.equal(cleanup[key], true);
}
