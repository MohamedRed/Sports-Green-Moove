import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { assertRetainedSourceFiles } from './retained-source-evidence.mjs';

export function validateRetainedTeamConversation(root, source) {
  const base = dirname(resolve(root, source)), json = name => JSON.parse(readFileSync(resolve(base, name), 'utf8'));
  const run = json('run.json'), services = json('services.json');
  assert.equal(run.scope, 'local-team-conversation-services-not-native-or-phone-ui');
  assert.equal(services.scope, 'local-emulated-services-not-phone-ui');
  assert.equal(services.coverage, run.scope);
  for (const name of ['projectId', 'runId', 'testedAt']) assert.equal(services[name], run[name]);
  assert.equal(run.projectId, 'demo-sgm-local-qa'); assert.match(run.runId, /^[a-f0-9]{32}$/);
  assert.deepEqual(services.steps, run.steps); assert.equal(run.steps.length, 18);
  assert.equal(new Set(run.steps.map(item => item.id)).size, 18);
  assert(run.steps.every(item => item.status === 'passed'));
  for (const name of ['physicalDevice', 'nativeUiExecuted', 'productionWrites', 'notificationsVerified']) assert.equal(run[name], false);
  assert.equal(run.providerRequests, 0);
  for (const name of ['protectedBaselinePreserved', 'adminClientClosed', 'isolatedEnvironmentDestroyed']) assert.equal(run[name], true);
  assert.deepEqual(run.emulatorEndpoints, { host: '127.0.0.1', ports: [9099, 8080, 9000, 5001], closed: true });
  for (const required of ['active-club-member-without-team-approval-denied',
    'verified-parent-joins-approved-child-team-without-earlier-history', 'concurrent-retry-commits-once-and-different-content-is-rejected',
    'direct-client-document-read-cannot-bypass-admission-filter', 'guardian-revocation-denies-read-pagination-send-and-replay',
    'new-parent-verification-starts-new-history-and-invalidates-old-cursor', 'child-club-rejoining-resets-parent-history',
    'current-child-profile-denied-despite-stale-adult-token', 'child-login-link-cannot-be-bypassed-with-adult-roles',
    'second-independently-verified-parent-is-included-with-its-own-history-boundary',
    'manager-team-revocation-removes-parent-and-adult-access', 'adult-team-reapproval-does-not-recover-prior-history',
    'child-token-cannot-be-bypassed-with-mixed-adult-roles', 'oversized-team-is-rejected-without-partial-audience-or-new-message',
    'recreated-child-does-not-inherit-team-parent-authorization', 'recreated-team-cannot-inherit-old-enrollment-or-message-history'])
    assert(run.steps.some(item => item.id === required));
  assertRetainedSourceFiles(root, run.sourceFiles);
  const hashes = json('artifact-sha256.json');
  for (const name of ['run.json', 'services.json', 'README.md'])
    assert.equal(createHash('sha256').update(readFileSync(resolve(base, name))).digest('hex'), hashes[name], name);
  return run;
}
