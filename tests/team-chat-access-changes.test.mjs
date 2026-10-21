import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { validateRetainedTeamChatAccess, validateTeamChatAccess } from '../scripts/qa/team-chat-access-evidence.mjs';
import { content } from '../partner-portal/content.mjs';
const source = 'docs/release/evidence/team-chat-access-2026-10-21/results.json';
const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('executed multi-child and cross-team services retain all eleven checkpoints and scoped cleanup', () => {
  const run = validateRetainedTeamChatAccess(process.cwd(), source);
  assert.equal(run.steps.length, 11); assert.equal(run.nativeUiExecuted, false);
  assert.equal(run.observed.teams.reduce((sum, row) => sum + row.committedMessages, 0), 59);
  const flow = content.flows.find(item => item.id === 'team-conversation');
  assert.equal(flow.accessChanges.source, source); assert.equal(flow.status, 'partial');
  assert.match(flow.verified, /En local : lectures, accès et messages séparés entre comptes et équipes/);
  assert.match(flow.remaining, /notifications/);
  assert.equal(flow.images.length, 42);
});
const changes = [
  x => x.completed = false, x => x.steps.pop(), x => x.steps[0].status = 'failed',
  x => x.nativeUiExecuted = true, x => x.physicalDevice = true, x => x.notificationsVerified = true,
  x => x.productionWrites = true, x => x.providerRequests = 1,
  x => x.isolation.originalClaimsUnchanged = false, x => x.isolation.protectedBaselinePreserved = false,
  x => x.emulatorEndpoints.closed = false, x => x.isolatedEnvironmentDestroyed = false,
  x => x.observed.teams[0].operations = 58,
];
for (const [index, change] of changes.entries()) test(`reject promoted or incomplete service evidence ${index + 1}`, () => {
  const run = JSON.parse(read(source)); change(run); assert.throws(() => validateTeamChatAccess(run));
});
test('smoke executes this isolated suite and the wrapper retains negative attempts before disposal', () => {
  const workflow = read('.github/workflows/web-integration-smoke.yml');
  assert(workflow.includes('npm run test:team-chat-access-changes'));
  assert(workflow.includes('tests/team-chat-access-changes.test.mjs'));
  const runner = read('scripts/qa/run-local-team-access-changes.mjs');
  assert(runner.includes('if (!report && existsSync(reportPath))'));
  assert(runner.includes('runtime.cleanup()')); assert(runner.includes('completed: report.completed && !failure'));
  assert(runner.includes('assertLocalEndpointsClosed(ports)'));
  const suite = read('scripts/qa/local-team-access-changes.mjs');
  for (const marker of ['originalRequest', 'oldPage.nextCursor', 'driverPage.nextCursor', 'await pending.approve()',
    'verifyTeamChatProtectedBaseline', 'await deleteApp(getApp())', 'operations.docs.map(row => row.id)']) assert(suite.includes(marker), marker);
});
