import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname, resolve} from 'node:path';
import test from 'node:test';
import {currentChatNetworkIdentity as identity, validateCurrentChatNetwork as validate} from '../scripts/qa/chat-network-current-evidence.mjs';
import {content} from '../partner-portal/content.mjs';
import {partitionUpdates} from '../partner-portal/src/render.js';

const root = resolve(import.meta.dirname, '..'), folder = identity.folder;
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
test('exact successful archive binds radio handover, offline retry, durable draft, isolated exchange and independent disposal', () => {
  const run = validate(root);
  assert.equal(run.testCount, 1); assert.equal(run.network.messageCount, 2);
  assert.equal(run.network.notificationCount, 2); assert.equal(run.network.duplicateMessages, 0);
  assert.equal(run.isolatedEnvironmentDestroyed, true); assert.equal(run.physicalDevice, false);
});
for (const [file, mutate] of [
  ['archive-receipt.json', row => row.sha256 = '0'.repeat(64)],
  ['archive-receipt.json', row => row.members[0].bytes++],
  ['archive-receipt.json', row => row.members[0].member = 'other.json'],
  ['local-chat-network-ui.json', row => row.privateDraftPersistenceVersion = 0],
  ['local-chat-network-ui.json', row => row.parentDraftRestored = false],
  ['local-chat-network-ui.json', row => row.initialNetwork.hasDefaultDataSubscription = false],
  ['local-chat-network-ui.json', row => row.network[2].backendReachable = true],
  ['chat-network-recovery-results.json', row => row.network.duplicateMessages++],
  ['disposable-device-restore.json', row => row.restoration.installAdmin.originalPolicyRestored = false],
  ['host-shutdown.json', row => row.finalState = 'running'],
  ['host-shutdown.json', row => row.processSignalsRequested = true],
  ['job.json', row => row.conclusion = 'failure'],
]) test('rehashed current evidence rejects changed ' + file + ': ' + mutate.toString(), t => {
  const temp = mkdtempSync(resolve(tmpdir(), 'sgm-current-network-'));
  t.after(() => rmSync(temp, {recursive: true, force: true}));
  const destination = resolve(temp, folder); cpSync(resolve(root, folder), destination, {recursive: true});
  const archive = resolve(temp, 'docs/release/evidence/source-archive'); mkdirSync(dirname(archive), {recursive: true});
  symlinkSync(resolve(root, 'docs/release/evidence/source-archive'), archive);
  const path = resolve(destination, file), value = JSON.parse(readFileSync(path)); mutate(value);
  const bytes = JSON.stringify(value); writeFileSync(path, bytes);
  const manifest = resolve(destination, 'artifact-sha256.json'), hashes = JSON.parse(readFileSync(manifest));
  hashes[file] = sha(bytes); writeFileSync(manifest, JSON.stringify(hashes));
  assert.throws(() => validate(temp));
});
test('historical local results stay intact while newer message work can occupy the overview', () => {
  const before = JSON.parse(readFileSync(resolve(root, folder, 'portal-before.json')));
  assert.equal(before.updates.length, 448);
  for (const row of before.flows) assert.equal(sha(JSON.stringify(content.flows.find(flow => flow.id === row.id))), row.sha256);
  for (const hash of before.updates) assert(content.updates.some(row => sha(JSON.stringify(row)) === hash));
  assert.equal(sha(JSON.stringify(content.blockers)), before.blockers);
  const {recent, previous} = partitionUpdates(content.updates);
  const news = previous.find(row => row.source === folder + 'README.md');
  const historical = previous.find(row => row.source === 'docs/release/evidence/native-network-959-comparison-2026-11-06/README.md');
  assert(historical);
  const current = recent.find(row => [row.flow, ...(row.coversFlows ?? [])].includes('messages'));
  assert(current && current.source !== historical.source && current.date >= historical.date);
  assert(news); assert.match(news.text, /téléphone réel/); assert.match(news.text, /local/);
  assert.doesNotMatch(news.title + news.text, /Firebase|BrowserStack|Android|SDK|CI\b/);
  assert.equal(content.flows.find(row => row.id === 'messages').status, 'partial');
});
test('the later failed replay remains a prerequisite failure, never a second accepted cut or retry', () => {
  const dir = resolve(root, 'docs/release/evidence/chat-network-d56-preparation-2026-11-05');
  const json = file => JSON.parse(readFileSync(resolve(dir, file)));
  const report = json('summary.json');
  for (const row of report.records) assert.equal(sha(readFileSync(resolve(dir, row.file))), row.sha256);
  const receipt = json('archive-receipt.json');
  assert.equal(receipt.artifactId, 13455233548); assert.equal(receipt.bytes, 366341);
  assert.equal(receipt.sha256, '0076965dedc3babd21918cf73ea8a1d29b62525400eb8d51d21af41d350f4a43');
  for (const row of receipt.members) {
    const bytes = readFileSync(resolve(dir, row.file)); assert.equal(bytes.length, row.bytes); assert.equal(sha(bytes), row.sha256);
  }
  const ui = json('local-chat-network-ui.json'); assert.equal(ui.completed, false); assert.deepEqual(ui.network, []);
  assert.equal(ui.failedPhase, 'network-preparation'); assert.equal(ui.preparationFailure.hasDefaultDataSubscription, false);
  assert.equal(ui.preparationFailure.cellularAvailableCallbacks, 0); assert.equal(ui.preparationFailure.backendReachable, true);
  assert.equal(ui.preparationFailure.capabilityObservation.active.validated, true);
  assert.equal(json('terminal-job.json').id, 127538625233); assert.equal(json('terminal-job.json').conclusion, 'failure');
  assert(readFileSync(resolve(dir, 'instrumentation.txt'), 'utf8').includes('LocalChatNetworkFlowTest.kt:83'));
  assert.equal(json('disposable-device-restore.json').verified, true);
  const host = json('host-shutdown.json'); assert.equal(host.finalState, 'gone'); assert.equal(host.processSignalsRequested, false);
  for (const key of ['completed', 'actualNetworkCutExecuted', 'recoveryAccepted', 'rootCauseConfirmed', 'physicalDeviceAccepted', 'releaseComplete'])
    assert.equal(report[key], false);
  const news = content.updates.find(row => row.source === folder + 'README.md'); assert.match(news.text, /avant la coupure/);
});
