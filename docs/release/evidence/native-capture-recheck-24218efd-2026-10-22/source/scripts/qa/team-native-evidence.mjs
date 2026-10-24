import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export const teamNativeChecks = ['cancel-without-write', 'parent-request-ui', 'manager-refusal-refresh', 'new-request-manager-approval',
  'activity-recreation-reselection-fresh-read', 'confirmed-owned-withdrawal', 'verified-parent-child-request-approval',
  'revoked-parent-stale-withdrawal-denied', 'manager-revoke-visible', 'account-isolation'];
export const teamNativeScreenshots = ['team-native-requested.png', 'team-native-approved.png', 'team-native-child-approved.png',
  'team-native-child-ineligible.png', 'team-native-other-account.png'];
export function validateTeamNativeDevice(marker, receipt, runId, load) {
  assert.match(runId, /^[a-f0-9]{32}$/);
  assert.equal(marker.runId, runId); assert.equal(marker.projectId, 'demo-sgm-local-qa');
  assert.equal(marker.scope, 'local-native-team-ui-with-sdk-manager-not-physical');
  assert.equal(receipt.runId, runId); assert.equal(receipt.projectId, 'demo-sgm-local-qa');
  assert.equal(receipt.scope, 'local-adb-file-sync-command-not-flow-verification');
  assert.equal(receipt.phase, 'team-enrollment'); assert.equal(receipt.status, 0); assert.equal(receipt.completed, true);
  assert.equal(receipt.signal, null); assert.equal(receipt.errorCode, null);
  assert.deepEqual(marker.checks.map((item) => item.id), teamNativeChecks); assert(marker.checks.every((item) => item.status === 'passed'));
  for (const id of [marker.selfEnrollmentId, marker.childEnrollmentId]) assert.match(id, /^[a-f0-9]{64}$/);
  assert.notEqual(marker.selfEnrollmentId, marker.childEnrollmentId);
  assert.match(marker.guardianRevokeRequestId, /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/);
  assert.deepEqual(Object.keys(marker.screenshots).sort(), [...teamNativeScreenshots].sort());
  for (const file of teamNativeScreenshots) {
    const raw = load(file); assert(raw.length >= 24); assert.equal(raw.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
    assert(raw.readUInt32BE(16) > 0 && raw.readUInt32BE(20) > raw.readUInt32BE(16));
    assert.equal(createHash('sha256').update(raw).digest('hex'), marker.screenshots[file], file);
  }
}
export function readTeamNativeDevice(directory, runId) {
  const marker = JSON.parse(readFileSync(resolve(directory, 'team-enrollment-device.json'), 'utf8'));
  const receipt = JSON.parse(readFileSync(resolve(directory, 'adb-pull-team-enrollment.json'), 'utf8'));
  validateTeamNativeDevice(marker, receipt, runId, (file) => readFileSync(resolve(directory, file)));
  return marker;
}
