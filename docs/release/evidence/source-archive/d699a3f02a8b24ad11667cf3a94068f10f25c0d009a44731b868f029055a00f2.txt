import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

export const emergencyIdentityUiChecks = ['original-contact-saved-in-app', 'open-old-form-write-denied',
  'old-verification-read-denied', 'fresh-verification-does-not-inherit-contact', 'new-contact-restored-after-activity-recreation'];
export const emergencyIdentityUiImages = ['emergency-identity-original.png', 'emergency-identity-stale-denied.png',
  'emergency-identity-fresh-empty.png', 'emergency-identity-fresh-restored.png'];
export function validateEmergencyIdentityDevice(marker, receipt, runId, read) {
  assert.match(runId, /^[a-f0-9]{32}$/);
  assert.equal(marker.runId, runId); assert.equal(marker.projectId, 'demo-sgm-local-qa');
  assert.equal(marker.scope, 'local-recreated-child-contact-ui-not-own-child-account');
  assert.deepEqual(marker.checks, emergencyIdentityUiChecks.map((id) => ({ id, status: 'passed' })));
  assert.equal(marker.dialIntentCount, 0); assert.equal(marker.directCallIntentCount, 0); assert.equal(marker.physicalDevice, false);
  assert.equal(receipt.projectId, marker.projectId); assert.equal(receipt.runId, runId);
  assert.equal(receipt.scope, 'local-adb-file-sync-command-not-flow-verification'); assert.equal(receipt.phase, 'emergency-identity');
  assert.equal(receipt.completed, true); assert.equal(receipt.status, 0); assert.equal(receipt.signal, null); assert.equal(receipt.errorCode, null);
  assert.deepEqual(Object.keys(marker.screenshots).sort(), [...emergencyIdentityUiImages].sort());
  for (const [file, hash] of Object.entries(marker.screenshots)) {
    assert.match(hash, /^[a-f0-9]{64}$/); const bytes = read(file);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), hash);
    assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
    assert(bytes.length > 24); assert(bytes.readUInt32BE(16) > 0 && bytes.readUInt32BE(20) > bytes.readUInt32BE(16));
  }
}
