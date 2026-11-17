import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { emergencyPhonePhases } from './manual-emergency-checkpoints.mjs';

export const emergencyOptionsPhoneScope = 'physical-phone-emergency-options-partial-isolated-backend';
export function validateEmergencyDialerPreflight(root, source, readFile = readFileSync) {
  const base = dirname(resolve(root, source)), read = name => readFile(resolve(base, name));
  const run = JSON.parse(read('results.json')), support = JSON.parse(read('support-observation.json'));
  assert.equal(run.scope, 'physical-system-dialer-prerequisite-blocked-before-app-flow');
  assert.equal(run.result, 'blocked'); assert.equal(run.recordedAt.slice(0, 10), '2026-10-21');
  assert.equal(run.sourceCommit, '92f74f48c5d29c1311bcc6bbd6d602ae05bedb6e');
  assert.equal(run.appSourceCommit, '70daee2173b5d75815d657dd4c4b847682aa67d7');
  assert.equal(run.apkSha256, '7f78f5a0e28111501131dd58d259adc54b3ea235d7a11559b37dbd443b20a4b9');
  assert.deepEqual(run.device, { model: 'Samsung Galaxy S24', os: 'Android 14', selection: 'No SIM' });
  for (const key of ['systemPhoneIconAttempted', 'systemPhoneIconReturnedHome', 'captureReviewed', 'appInstalled']) assert.equal(run[key], true);
  for (const key of ['appSignInPerformed', 'localBackendStarted', 'privateTunnelStarted', 'dialerHandoffAttemptedFromApp',
    'dialerHandoffVerified', 'rootCauseConfirmed', 'realCallsPlaced', 'contactDataEntered', 'devicePolicyChanged',
    'permissionsChanged', 'subscriptionChanged', 'productionWrites', 'storeReviewAccepted', 'releaseEvidenceAccepted']) assert.equal(run[key], false);
  assert.deepEqual(run.publishedCaptures, []); assert.equal(run.capture, 'home-after-phone.png');
  assert.equal(run.cleanup.providerUiUninstall, 'Succesfully uninstalled your app(s)!');
  assert.equal(run.cleanup.packageInventoryVerified, false); assert.equal(run.cleanup.phoneSessionStopped, true);
  assert.equal(run.cleanup.uploadedAppsDashboardVisible, true); assert.deepEqual(run.cleanup.loopbackPortsClosed, [5001, 8080, 9000, 9099]);
  assert.equal(support.scope, 'operator-observed-support-form-confirmation-not-ticket-api-or-email-proof');
  assert.equal(support.status, 'submitted-form-confirmation'); assert.equal(support.appAccessConsent, 'no');
  assert.deepEqual(support.observedConfirmation, ['Thank you', 'You will be hearing from us soon!']); assert.equal(support.ticketId, null);
  for (const key of ['emailDeliveryVerified', 'responseReceived', 'uploadedAppShared', 'attachmentsSent', 'planChangeRequested',
    'callingRequested', 'permissionChangeRequested', 'credentialsSent']) assert.equal(support[key], false);
  const png = read(run.capture); assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  assert.equal(png.readUInt32BE(16), 1080); assert.equal(png.readUInt32BE(20), 2340);
  const hashes = JSON.parse(read('artifact-sha256.json'));
  assert.deepEqual(Object.keys(hashes).sort(), ['README.md', 'diagnostic-excerpts.txt', 'home-after-phone.png', 'results.json', 'support-observation.json']);
  for (const [name, hash] of Object.entries(hashes)) assert.equal(createHash('sha256').update(read(name)).digest('hex'), hash, name);
  return run;
}

export function validateEmergencyPhoneArtifacts(root, source) {
  const base = dirname(resolve(root, source));
  const json = name => JSON.parse(readFileSync(resolve(base, name), 'utf8'));
  const run = json('results.json'), primary = json('checkpoints/session-results.json');
  assert.equal(run.scope, emergencyOptionsPhoneScope); assert.equal(run.projectId, 'demo-sgm-local-qa');
  assert.match(run.appSourceCommit, /^[a-f0-9]{40}$/); assert.match(run.apkSha256, /^[a-f0-9]{64}$/);
  for (const flag of ['completed', 'dialerHandoffProven', 'storeReviewAccepted',
    'releaseTrackingAccepted', 'productionWrites', 'realCallsPlaced', 'videoRecorded']) assert.equal(run[flag], false);
  for (const flag of ['fixtureCleanupVerified', 'localRuntimeStopped', 'tunnelStopped', 'phoneSessionStopped'])
    assert.equal(run[flag], true);
  assert.equal(primary.runId, run.runId); assert.equal(primary.projectId, run.projectId);
  assert.equal(primary.completed, false); assert.equal(primary.fixtureCleanupVerified, true);
  assert.deepEqual(primary.checkpoints.map(row => row.phase), emergencyPhonePhases.slice(0, 5));
  assert.equal(primary.dialerHandoffProvenByThisReport, false);
  const revoked = json('checkpoints/child-revoked.json');
  const recovery = phase => json(`recovery/sgm-phone-emergency-replay-20261021-${phase}.json`);
  const before = recovery('before-removal'), cancelled = recovery('cancelled-removal');
  for (const phase of ['before-removal', 'cancelled-removal', 'adult-removed', 'other-account-empty']) {
    const item = recovery(phase); assert.equal(item.phase, phase); assert.equal(item.runId, run.runId);
    assert.equal(item.projectId, run.projectId); assert.equal(item.childInstanceId, revoked.childInstanceId);
    assert.equal(item.guardianStatus, 'revoked');
    assert.equal(item.scope, 'independent-phone-contact-recovery-not-dialer-or-complete-primary-sequence');
    for (const flag of ['primarySequenceCompleted', 'dialerHandoffProven', 'storeReviewAccepted', 'releaseTrackingAccepted'])
      assert.equal(item[flag], false);
    assert.equal(item.adultRevision, phase.includes('removal') ? 1 : 2);
    assert.equal(item.operationCount, phase.includes('removal') ? 2 : 3);
  }
  assert.equal(before.stateDigest, cancelled.stateDigest); assert.equal(cancelled.unchangedSinceBeforeRemoval, true);
  const other = recovery('other-account-empty'); assert.equal(other.otherAccountSubjectId, 'sgm-qa-driver');
  assert.equal(other.otherAccountRevision, 0);
  assert.deepEqual(run.steps, [...emergencyPhonePhases.slice(0, 5), 'cancelled-removal', 'adult-removed', 'other-account-empty']);
  assert.deepEqual(run.captures, ['empty.png', 'saved.png', 'restored.png', 'child.png', 'revoked.png',
    'cancelled.png', 'removed.png', 'other-account.png']);
  const hashes = json('artifact-sha256.json');
  for (const name of ['results.json', 'README.md', 'first-interrupted-session.json', 'handoff-unresolved.png',
    'checkpoints/session-results.json', ...primary.checkpoints.map(row => `checkpoints/${row.phase}.json`),
    ...['before-removal', 'cancelled-removal', 'adult-removed', 'other-account-empty'].map(
      phase => `recovery/sgm-phone-emergency-replay-20261021-${phase}.json`), ...run.captures]) {
    assert.equal(createHash('sha256').update(readFileSync(resolve(base, name))).digest('hex'), hashes[name], name);
  }
  for (const name of run.captures) {
    const png = readFileSync(resolve(base, name));
    assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
    assert.equal(png.readUInt32BE(16), 1080); assert.equal(png.readUInt32BE(20), 2400);
  }
  return run;
}
