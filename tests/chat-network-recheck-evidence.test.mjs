import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname, resolve} from 'node:path';
import test from 'node:test';
import {networkRecheckIdentity as identity, validateChatNetworkRecheck} from '../scripts/qa/chat-network-recheck-evidence.mjs';
import {validateChatNetworkIsolated} from '../scripts/qa/chat-network-isolated-evidence.mjs';
import {content} from '../partner-portal/content.mjs';

const root = resolve(import.meta.dirname, '..'), folder = identity.folder;
const reference = {source: folder + 'chat-network-recovery-results.json', checkedAt: identity.date};
test('both dated network replays retain their unchanged flow, primary-copy and independent cleanup proof', () => {
  assert.equal(validateChatNetworkRecheck(root, reference).network.duplicateMessages, 0);
  assert.equal(validateChatNetworkIsolated(root).run.testedAt.slice(0, 10), '2026-10-27');
});
const mutations = [
  ['chat-network-recovery-results.json', value => {value.network.messageCount = 3;}],
  ['chat-network-recovery-results.json', value => {value.physicalDevice = true;}],
  ['chat-network-recovery-results.json', value => {value.emulatorEndpoints.closed = false;}],
  ['local-chat-network-ui.json', value => {value.network[0].activeInternetTransports = ['cellular'];}],
  ['local-chat-network-ui.json', value => {value.network[2].backendReachable = true;}],
  ['adb-pull-network-recovery.json', value => {value.completed = false;}],
  ['disposable-device-restore.json', value => {value.restoration.installAdmin.originalPolicyRestored = false;}],
  ['job.json', value => {value.head_sha = '9da2228effc8bcba3dbb88a09caff9caf4cae136';}],
  ['artifact.json', value => {value.workflow_run.id++;}],
  ['chat-network-recovery-app-results.json', value => {value.network.duplicateMessages = 1;}],
  ['chat-network-recovery-suite-status.json', value => {value.status = 1;}],
];
for (const [file, mutate] of mutations) test('rechecks reject changed ' + file + ' even after checksum replacement', () => {
  const temporary = mkdtempSync(resolve(tmpdir(), 'sgm-network-recheck-'));
  try {
    const destination = resolve(temporary, folder); cpSync(resolve(root, folder), destination, {recursive: true});
    const archive = resolve(temporary, 'docs/release/evidence/source-archive'); mkdirSync(dirname(archive), {recursive: true});
    symlinkSync(resolve(root, 'docs/release/evidence/source-archive'), archive);
    const value = JSON.parse(readFileSync(resolve(destination, file))); mutate(value);
    const bytes = JSON.stringify(value); writeFileSync(resolve(destination, file), bytes);
    const hashes = JSON.parse(readFileSync(resolve(destination, 'artifact-sha256.json')));
    hashes[file] = createHash('sha256').update(bytes).digest('hex');
    writeFileSync(resolve(destination, 'artifact-sha256.json'), JSON.stringify(hashes));
    assert.throws(() => validateChatNetworkRecheck(temporary, reference));
  } finally {rmSync(temporary, {recursive: true, force: true});}
});
test('current copy keeps phone scope partial and earlier captures dated without crediting the later observer', () => {
  const flow = content.flows.find(row => row.id === 'messages');
  assert.equal(flow.status, 'partial'); assert.equal(flow.checkedAt, identity.date);
  assert.deepEqual(flow.networkRecoveryRecheck, reference); assert.equal(flow.networkRecovery.checkedAt, '2026-10-27');
  const news = content.updates.find(row => row.source === folder + 'README.md');
  assert.match(news.text, /téléphone réel/); assert.doesNotMatch(news.text, /BrowserStack|Firebase|Android|SDK|9da2228/);
  assert(flow.images.every(image => /27 octobre|17 octobre|16 octobre|15 octobre/.test(image.alt)));
});
