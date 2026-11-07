import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export const emergencyNativeChecks = ['adult-save-reload', 'activity-recreation-fresh-read', 'verified-parent-child-save',
  'revoked-parent-dial-denied', 'fresh-read-dialer-handoff-without-direct-call', 'return-from-dialer',
  'cancelled-removal-no-write', 'confirmed-removal-versioned', 'account-isolation'];
export const emergencyNativeScreenshots = ['emergency-self-saved.png', 'emergency-self-restored.png', 'emergency-child-saved.png',
  'emergency-child-revoked.png', 'emergency-dialer-opened.png', 'emergency-self-removed.png', 'emergency-other-account.png'];

export function validateEmergencyDevice(marker, receipt, runId, loadScreenshot) {
  assert.match(runId, /^[a-f0-9]{32}$/);
  assert.equal(receipt.projectId, 'demo-sgm-local-qa');
  assert.equal(receipt.scope, 'local-adb-file-sync-command-not-flow-verification');
  assert.equal(receipt.runId, runId); assert.equal(receipt.phase, 'emergency-contact');
  assert.equal(receipt.completed, true); assert.equal(receipt.status, 0); assert.equal(receipt.signal, null); assert.equal(receipt.errorCode, null);
  assert.equal(marker.projectId, 'demo-sgm-local-qa'); assert.equal(marker.runId, runId);
  assert.equal(marker.scope, 'local-native-contact-ui-with-sdk-and-dialer-not-physical');
  assert.deepEqual(marker.checks.map((item) => item.id), emergencyNativeChecks);
  assert(marker.checks.every((item) => item.status === 'passed'));
  assert.equal(marker.dialerActionObserved, 'android.intent.action.DIAL'); assert.equal(marker.directCallIntentCount, 0);
  assert.equal(marker.dialerNumberMatched, true);
  assert.match(marker.dialerPackage, /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/);
  assert(!marker.dialerPackage.startsWith('be.sportgreenmoove.app'));
  assert.match(marker.managerRevokeRequestId, /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/);
  assert.deepEqual(Object.keys(marker.screenshots).sort(), [...emergencyNativeScreenshots].sort());
  for (const file of emergencyNativeScreenshots) {
    const bytes = loadScreenshot(file);
    assert(bytes.length >= 24); assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
    assert(bytes.readUInt32BE(16) > 0 && bytes.readUInt32BE(20) > bytes.readUInt32BE(16));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), marker.screenshots[file], file);
  }
}

export function readEmergencyDevice(directory, runId) {
  const marker = JSON.parse(readFileSync(resolve(directory, 'emergency-contact-device.json'), 'utf8'));
  const receipt = JSON.parse(readFileSync(resolve(directory, 'adb-pull-emergency-contact.json'), 'utf8'));
  validateEmergencyDevice(marker, receipt, runId, (file) => readFileSync(resolve(directory, file)));
  return marker;
}
