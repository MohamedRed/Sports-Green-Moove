import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname, resolve} from 'node:path';
import test from 'node:test';
import {latestNetworkRecheckIdentity as identity, validateLatestChatNetworkRecheck as validate} from '../scripts/qa/chat-network-latest-evidence.mjs';
import {networkRepeatIdentity, validateChatNetworkRepeat} from '../scripts/qa/chat-network-repeat-evidence.mjs';
import {content} from '../partner-portal/content.mjs';

const root = resolve(import.meta.dirname, '..'), folder = identity.folder;
const reference = {source: folder + 'chat-network-recovery-results.json', checkedAt: identity.date};
test('the later independent case binds one real radio-control trial, stored exchange, primary copy and complete disposal', () => {
  const result = validate(root, reference);
  assert.equal(result.testCount, 1); assert.equal(result.network.messageCount, 2);
  assert.equal(result.network.notificationCount, 2); assert.equal(result.network.duplicateMessages, 0);
  assert.equal(result.isolatedEnvironmentDestroyed, true); assert.equal(result.physicalDevice, false);
  assert.equal(result.sourceFiles['scripts/qa/local-network-validation-diagnostics.mjs'], undefined,
    'The collector added afterwards did not execute in this historical run');
});
for (const [file, mutate] of [
  ['chat-network-recovery-results.json', r => r.network.duplicateMessages++],
  ['chat-network-recovery-results.json', r => r.physicalDevice = true],
  ['chat-network-recovery-results.json', r => r.adminClientClosed = false],
  ['local-chat-network-ui.json', r => r.network[0].activeInternetTransports = ['cellular']],
  ['local-chat-network-ui.json', r => r.network[2].backendReachable = true],
  ['adb-pull-network-recovery.json', r => r.status = 1],
  ['disposable-device-restore.json', r => r.restoration.installAdmin.originalPolicyRestored = false],
  ['job.json', r => r.head_sha = '0'.repeat(40)],
  ['job.json', r => r.conclusion = 'failure'],
  ['artifact.json', r => r.workflow_run.id++],
]) test('latest replay rejects rehashed ' + file + ' corruption', t => {
  const temp = mkdtempSync(resolve(tmpdir(), 'sgm-chat-latest-')); t.after(() => rmSync(temp, {recursive: true, force: true}));
  const base = resolve(temp, folder); cpSync(resolve(root, folder), base, {recursive: true});
  const archive = resolve(temp, 'docs/release/evidence/source-archive'); mkdirSync(dirname(archive), {recursive: true});
  symlinkSync(resolve(root, 'docs/release/evidence/source-archive'), archive);
  const path = resolve(base, file), value = JSON.parse(readFileSync(path)); mutate(value);
  const bytes = JSON.stringify(value); writeFileSync(path, bytes);
  const manifest = resolve(base, 'artifact-sha256.json'), hashes = JSON.parse(readFileSync(manifest));
  hashes[file] = createHash('sha256').update(bytes).digest('hex'); writeFileSync(manifest, JSON.stringify(hashes));
  assert.throws(() => validate(temp, reference));
});
test('latest progress preserves the failed attempt and all older proof/media dates without passing the whole native gate', () => {
  const flow = content.flows.find(row => row.id === 'messages');
  assert.equal(flow.status, 'partial'); assert.equal(flow.checkedAt, '2026-10-30');
  assert.deepEqual(flow.networkRecoveryLatest, reference);
  assert.equal(flow.networkRecoveryRecheck.checkedAt, '2026-10-28');
  assert.equal(flow.networkRecovery.checkedAt, '2026-10-27');
  assert(flow.images.every(image => /27 octobre|17 octobre|16 octobre|15 octobre/.test(image.alt)));
  assert(content.updates.some(row => row.source === 'docs/release/evidence/chat-network-preparation-4714198/README.md'));
  const update = content.updates.find(row => row.flow === 'messages');
  assert.equal(update.source, networkRepeatIdentity.folder + 'README.md');
  assert.match(update.text, /En simulation/);
  assert(content.updates.some(row => row.source === 'docs/release/evidence/child-booking-receipt-recheck-2026-10-30/README.md' && /avant la coupure/.test(row.text)));
  assert(content.updates.some(row => row.flow === 'messages' && row.source === folder + 'README.md' && /essai local/.test(row.text)));
  assert.doesNotMatch(update.text, /BrowserStack|Firebase|SDK|Android/);
});
test('the later repeated radio trial has its own retained proof and predates the passive prerequisite', () => {
  const reference = {source: networkRepeatIdentity.folder + 'chat-network-recovery-results.json', checkedAt: networkRepeatIdentity.date};
  const run = validateChatNetworkRepeat(root, reference);
  assert.equal(run.network.messageCount, 2); assert.equal(run.network.duplicateMessages, 0);
  assert.equal(run.physicalDevice, false); assert.equal(run.isolatedEnvironmentDestroyed, true);
  assert.deepEqual(content.flows.find(row => row.id === 'messages').networkRecoveryRepeat, reference);
  assert(content.blockers.some(row => row.id === 'chat-send-stability'));
});
