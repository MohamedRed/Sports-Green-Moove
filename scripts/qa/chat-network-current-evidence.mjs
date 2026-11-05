import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {validateChatNetworkRecheck} from './chat-network-recheck-evidence.mjs';

export const currentChatNetworkIdentity = Object.freeze({folder: 'docs/release/evidence/chat-network-38b-2026-11-05/',
  head: '38b558b932b12bc6d3a052815f539f5a01bd185f', runId: '853dc1bf12a9ed5f94624bb978ab732f', date: '2026-11-05',
  jobId: 127524723278, workflowId: 42107112226, artifactId: 13451394347,
  archiveSha256: 'b0c5f2663942c5cfec64753185ea91aa937ce68912e18aabfcc3addfe3e24388'});

const local = 'local-ui-evidence/' + currentChatNetworkIdentity.runId + '/', device = 'focused-safety-ui/chat-network-recovery/';
export const currentChatArchiveFiles = [
  ...['chat-network-recovery-results.json', 'chat-network-recovery-app-results.json', 'local-chat-network-ui.json',
    'LocalChatNetworkFlowTest-instrumentation.txt', 'adb-pull-network-recovery.json'].map(file => ({member: local + file, file})),
  ...['disposable-device-setup.json', 'disposable-device-restore.json', 'chat-network-recovery-suite-status.json'].map(file => ({member: device + file, file})),
  {member: device + 'host-shutdown/complete.json', file: 'host-shutdown.json'},
];

export function validateCurrentChatNetwork(root) {
  const expected = currentChatNetworkIdentity;
  const run = validateChatNetworkRecheck(root, {source: expected.folder + 'chat-network-recovery-results.json', checkedAt: expected.date}, expected);
  const json = file => JSON.parse(readFileSync(resolve(root, expected.folder, file), 'utf8'));
  const archive = json('archive-receipt.json'), artifact = json('artifact.json');
  assert.equal(archive.artifactId, expected.artifactId); assert.equal(archive.sha256, expected.archiveSha256);
  assert.equal(artifact.digest, 'sha256:' + expected.archiveSha256); assert.equal(archive.bytes, artifact.size_in_bytes);
  assert.deepEqual(archive.members.map(({member, file}) => ({member, file})), currentChatArchiveFiles);
  for (const row of archive.members) {
    const bytes = readFileSync(resolve(root, expected.folder, row.file));
    assert.equal(row.bytes, bytes.length); assert.equal(row.sha256, createHash('sha256').update(bytes).digest('hex'));
  }
  const ui = json('local-chat-network-ui.json');
  assert.equal(ui.privateDraftPersistenceVersion, 1); assert.equal(ui.parentDraftRestored, true);
  assert.equal(run.network.parentDraftRestored, true); assert.equal(ui.initialNetwork.hasDefaultDataSubscription, true);
  const host = json('host-shutdown.json'); assert.equal(host.finalState, 'gone');
  assert.equal(host.targetExitObserved, true); assert.equal(host.processSignalsRequested, false);
  assert.equal(host.deviceCommandsRequested, false); assert.equal(host.flowAccepted, false);
  return run;
}
