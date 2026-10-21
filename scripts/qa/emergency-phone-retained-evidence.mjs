import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { emergencyPhonePhases } from './manual-emergency-checkpoints.mjs';

export const emergencyOptionsPhoneScope = 'physical-phone-emergency-options-partial-isolated-backend';
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
