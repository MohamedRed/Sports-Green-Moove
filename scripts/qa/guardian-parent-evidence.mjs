import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export const guardianParentChecks = ['parent-request-ui', 'cancel-without-write', 'stale-withdrawal-refused', 'manager-refusal-reopen',
  'manager-verified-visible', 'activity-recreation-fresh-read', 'parent-withdraw-reopen-manager-revoke', 'account-isolation'];
export const guardianParentScreenshots = ['guardian-parent-requested.png', 'guardian-parent-verified.png', 'guardian-parent-restored.png',
  'guardian-parent-revoked.png', 'guardian-parent-other-account.png'];

export function validateGuardianParentDevice(marker, receipt, runId, loadScreenshot) {
  assert.match(runId, /^[a-f0-9]{32}$/);
  assert.equal(receipt.projectId, 'demo-sgm-local-qa');
  assert.equal(receipt.scope, 'local-adb-file-sync-command-not-flow-verification');
  assert.equal(receipt.runId, runId); assert.equal(receipt.phase, 'guardian-parent-verification');
  assert.equal(receipt.completed, true); assert.equal(receipt.status, 0); assert.equal(receipt.signal, null); assert.equal(receipt.errorCode, null);
  assert.equal(marker.runId, runId); assert.equal(marker.projectId, 'demo-sgm-local-qa');
  assert.equal(marker.scope, 'local-native-parent-ui-with-local-sdk-manager-not-physical');
  assert.deepEqual(marker.checks.map((item) => item.id), guardianParentChecks);
  assert(marker.checks.every((item) => item.status === 'passed'));
  assert.deepEqual(Object.keys(marker.screenshots).sort(), [...guardianParentScreenshots].sort());
  for (const file of guardianParentScreenshots) {
    const bytes = loadScreenshot(file);
    assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
    assert.equal(createHash('sha256').update(bytes).digest('hex'), marker.screenshots[file], file);
  }
}

export function readGuardianParentDevice(directory, runId) {
  const marker = JSON.parse(readFileSync(resolve(directory, 'guardian-parent-device.json'), 'utf8'));
  const receipt = JSON.parse(readFileSync(resolve(directory, 'adb-pull-guardian-parent-verification.json'), 'utf8'));
  validateGuardianParentDevice(marker, receipt, runId, (file) => readFileSync(resolve(directory, file)));
  return marker;
}
