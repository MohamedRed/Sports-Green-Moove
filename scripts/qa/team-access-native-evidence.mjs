import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

export const teamAccessNativeScope = 'local-native-team-access-changes-with-sdk-peers-not-physical-or-push';
export const teamAccessNativeChecks = ['original-approved-team-visible-without-pre-admission-history',
  'pending-other-team-not-listed', 'second-child-grant-keeps-current-first-child-history',
  'first-revocation-keeps-only-remaining-grant-history', 'last-revocation-hides-content-and-composer',
  'no-team-listed-without-current-grant', 'renewed-guardian-starts-new-native-history',
  'pending-other-team-remains-hidden-after-renewal', 'separate-team-approval-excludes-old-and-other-team-history',
  'other-team-ui-reply-independently-read', 'return-to-original-team-does-not-merge-other-thread'];
export function validateTeamAccessNativeDevice(marker, receipt, runId, read) {
  assert.equal(marker.scope, teamAccessNativeScope); assert.equal(marker.projectId, 'demo-sgm-local-qa');
  assert.equal(marker.runId, runId); assert.match(runId, /^[a-f0-9]{32}$/);
  assert.equal(receipt.completed, true); assert.equal(receipt.phase, 'team-access'); assert.equal(receipt.runId, runId);
  assert.deepEqual(marker.checks, teamAccessNativeChecks.map(id => ({ id, status: 'passed' })));
  assert.deepEqual(Object.keys(marker.events).sort(), ['secondChildApproval', 'firstRevocation', 'secondRevocation', 'renewal', 'otherTeamApproval'].sort());
  for (const id of Object.values(marker.events)) assert.match(id, /^[a-f0-9-]{36}$/);
  assert.equal(new Set(Object.values(marker.events)).size, 5);
  assert.deepEqual(Object.keys(marker.messages).sort(), ['afterSecond', 'afterRenewal', 'otherIncoming', 'otherReply'].sort());
  for (const id of Object.values(marker.messages)) assert.match(id, /^[a-f0-9]{64}$/);
  assert.equal(new Set(Object.values(marker.messages)).size, 4);
  const names = ['initial', 'remaining', 'revoked', 'renewed', 'other', 'isolated'].flatMap(stem =>
    ['.png', '-window.png'].map(suffix => 'team-access-' + stem + suffix));
  assert.deepEqual(Object.keys(marker.screenshots).sort(), names.sort());
  for (const [file, hash] of Object.entries(marker.screenshots)) assert.equal(createHash('sha256').update(read(file)).digest('hex'), hash, file);
}
