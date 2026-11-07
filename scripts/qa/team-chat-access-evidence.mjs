import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';
import { assertRetainedSourceFiles } from './retained-source-evidence.mjs';

export const teamChatAccessScope = 'local-team-chat-multiple-grants-and-cross-team-services-not-native-ui';
export const teamChatAccessChecks = [
  'current-single-child-grant-excludes-pre-admission-history-across-pages',
  'second-approved-child-preserves-earlier-current-grant-but-invalidates-old-cursor',
  'revoking-one-child-keeps-other-grant-with-its-own-history-boundary',
  'removing-last-current-grant-denies-read-send-replay-and-discovery',
  'reapproved-second-child-starts-new-history-without-recovering-old-retry',
  'renewing-first-child-keeps-still-current-second-child-history',
  'revoking-second-child-retains-only-current-first-child-history',
  'same-club-parent-cannot-discover-read-or-send-to-another-team',
  'pending-child-team-request-does-not-open-another-conversation',
  'separate-team-approval-uses-separate-history-and-keeps-original-messages',
  'both-team-ledgers-contain-exactly-once-ordered-message-operations',
];
export function validateTeamChatAccess(run) {
  assert.equal(run.scope, teamChatAccessScope); assert.equal(run.projectId, 'demo-sgm-local-qa');
  assert.match(run.runId, /^[a-f0-9]{32}$/); assert(Number.isFinite(Date.parse(run.testedAt)));
  assert.equal(run.completed, true); assert.equal(run.failureCode, undefined);
  assert.deepEqual(run.steps, teamChatAccessChecks.map(id => ({ id, status: 'passed' })));
  for (const key of ['nativeUiExecuted', 'physicalDevice', 'notificationsVerified', 'productionWrites']) assert.equal(run[key], false);
  assert.equal(run.providerRequests, 0); assert.equal(run.adminClientClosed, true);
  assert.equal(run.isolatedEnvironmentDestroyed, true);
  assert.deepEqual(run.isolation, { protectedBaselinePreserved: true, originalClaimsUnchanged: true,
    expectedProfileTimestampUpdatesOnly: true, protectedRecordCount: 158 });
  assert.deepEqual(run.observed, { teams: [
    { teamId: 'zz-sgm-qa-chat-team', committedMessages: 57, operations: 57 },
    { teamId: 'zy-sgm-qa-other-chat-team', committedMessages: 2, operations: 2 },
  ] });
  assert.deepEqual(run.emulatorEndpoints, { host: '127.0.0.1', ports: [9099, 8080, 9000, 5001], closed: true });
  return run;
}
export function validateRetainedTeamChatAccess(root, source) {
  const folder = dirname(resolve(root, source)), read = file => readFileSync(resolve(folder, file));
  const run = validateTeamChatAccess(JSON.parse(read(basename(source))));
  assertRetainedSourceFiles(root, run.sourceFiles);
  const transcript = read('transcript.txt').toString();
  assert.match(transcript, /Passed 11 isolated team access-change service scenarios/);
  assert.match(transcript, /Script exited successfully \(code 0\)/);
  for (const [file, expected] of Object.entries(JSON.parse(read('artifact-sha256.json')))) {
    assert.equal(basename(file), file);
    assert.equal(createHash('sha256').update(read(file)).digest('hex'), expected, file);
  }
  return run;
}
