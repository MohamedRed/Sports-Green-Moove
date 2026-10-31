import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

export const teamChatNativeScope = 'local-native-team-conversation-with-sdk-peers-not-physical-or-push';
export const teamChatNativeChecks = ['approved-team-discovery', 'no-pre-admission-parent-history', 'driver-sdk-message-received',
  'parent-ui-message-independently-read', 'draft-survives-activity-recreation', 'revocation-in-background-hides-thread-on-return',
  'revoked-team-not-discoverable', 'driver-account-does-not-recover-parent-draft', 'driver-ui-send-after-account-switch'];
export function validateTeamChatNativeDevice(marker, receipt, runId, read) {
  assert.equal(marker.scope, teamChatNativeScope); assert.equal(marker.projectId, 'demo-sgm-local-qa'); assert.equal(marker.runId, runId);
  assert.equal(receipt.completed, true); assert.equal(receipt.phase, 'team-conversation'); assert.equal(receipt.runId, runId);
  assert.deepEqual(marker.checks, teamChatNativeChecks.map(id => ({ id, status: 'passed' })));
  for (const key of ['peerMessageId', 'parentMessageId']) assert.match(marker[key], /^[a-f0-9]{64}$/);
  assert.notEqual(marker.peerMessageId, marker.parentMessageId); assert.match(marker.guardianRevokeRequestId, /^[a-f0-9-]{36}$/);
  const names = ['parent', 'exchange', 'draft', 'revoked', 'driver'].flatMap(stem => [`.png`, '-window.png'].map(suffix => 'team-chat-native-' + stem + suffix));
  assert.deepEqual(Object.keys(marker.screenshots).sort(), names.sort());
  for (const [file, hash] of Object.entries(marker.screenshots)) assert.equal(createHash('sha256').update(read(file)).digest('hex'), hash, file);
}
