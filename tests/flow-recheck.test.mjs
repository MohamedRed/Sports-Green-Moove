import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { content } from '../partner-portal/content.mjs';
import { validateCurrentNativeBlocker, validateFlowRecheck } from '../scripts/qa/flow-recheck-evidence.mjs';

test('terminal service success is separate from failed native replay and unstarted phone checkpoints', () => {
  const report = validateFlowRecheck(process.cwd(), content.flowRecheck);
  assert.equal(report.serviceGroupsPassed, 24); assert.equal(report.releaseComplete, false);
  assert.equal(content.flows.find(flow => flow.id === 'booking').status, 'partial');
  assert.equal(content.flows.find(flow => flow.id === 'booking').phone.checkedAt, '2026-10-18');
  const progress = content.updates[0]; assert.equal(progress.date, '2026-10-22');
  assert.match(progress.text, /interrompu/); assert.match(progress.text, /débloquer/);
});
test('current native blocker follows the latest failed replay, not an immutable historical gallery', () => {
  validateCurrentNativeBlocker(process.cwd(), content);
  for (const patch of [{source: content.nativeVerification.source}, {text: 'Tout passe'}, {next: ''}]) {
    const changed = structuredClone(content);
    Object.assign(changed.blockers.find(item => item.id === 'test-device-stability'), patch);
    assert.throws(() => validateCurrentNativeBlocker(process.cwd(), changed));
  }
  const missing = {...content, blockers: content.blockers.filter(item => item.id !== 'test-device-stability')};
  assert.throws(() => validateCurrentNativeBlocker(process.cwd(), missing));
});
for (const [file, mutate] of [
  ['summary.json', value => value.fullNativeReplayCompleted = true],
  ['summary.json', value => value.newPhoneFlowCompleted = true],
  ['summary.json', value => value.releaseComplete = true],
  ['summary.json', value => value.phoneHelperOutcome.rootCauseEstablished = true],
  ['web-run.json', value => value.conclusion = 'failure'],
  ['native-run.json', value => value.conclusion = 'success'],
  ['session-results.json', value => value.completed = true],
  ['cleanup.json', value => value.endpoints.closed = false],
]) test('rejects unsupported recheck state: ' + file + ' ' + mutate, t => {
  const root = mkdtempSync(resolve(tmpdir(), 'sgm-flow-recheck-'));
  t.after(() => rmSync(root, {recursive: true, force: true}));
  const directory = dirname(content.flowRecheck.source), target = resolve(root, directory);
  cpSync(resolve(process.cwd(), directory), target, {recursive: true});
  const path = resolve(target, file), value = JSON.parse(readFileSync(path)); mutate(value);
  writeFileSync(path, JSON.stringify(value));
  assert.throws(() => validateFlowRecheck(root, content.flowRecheck));
});
test('new phone controller contracts and retained results run in smoke without another provider request', () => {
  const workflow = readFileSync('.github/workflows/web-integration-smoke.yml', 'utf8');
  for (const file of ['tests/flow-recheck.test.mjs', 'tests/manual-booking-phone-checkpoints.test.mjs']) {
    assert.equal(workflow.split('"' + file + '"').length - 1, 2);
    assert(workflow.includes('node --test tests/booking-notice-atomicity.test.mjs tests/manual-booking-phone-checkpoints.test.mjs tests/flow-recheck.test.mjs'));
  }
});
