import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';

const input = process.argv[2]; assert(input && isAbsolute(input));
const root = resolve(import.meta.dirname, '../..');
const destination = resolve(root, 'docs/release/evidence/chat-network-isolated-2026-10-27');
assert(!existsSync(destination), 'Retained network evidence must never be overwritten');
const runId = '644b0af26dff97be7e8bb291766f4cc4', commit = '04ce4d4f073e2ba7c406e1adfe0ee6d57b433997';
const local = resolve(input, 'local-ui-evidence', runId);
const device = resolve(input, 'focused-safety-ui/chat-network-recovery');
mkdirSync(destination); mkdirSync(resolve(destination, 'captures'));
const files = [];
function copy(base, source, target = source) {
  copyFileSync(resolve(base, source), resolve(destination, target)); files.push(target);
}
function save(file, data) {
  writeFileSync(resolve(destination, file), JSON.stringify(data, null, 2) + '\n', { flag: 'wx' }); files.push(file);
}
for (const file of ['chat-network-recovery-results.json', 'chat-network-recovery-app-results.json',
  'local-chat-network-ui.json', 'LocalChatNetworkFlowTest-instrumentation.txt', 'LocalChatNetworkFlowTest-stderr.txt',
  'adb-pull-network-recovery.json', 'chat-carrier-before.json', 'chat-carrier-after.json',
  'chat-subscriptions-before.json', 'chat-subscriptions-after.json']) copy(local, file);
for (const file of ['disposable-device-setup.json', 'disposable-device-restore.json',
  'chat-network-recovery-suite-status.json']) copy(device, file);
copy(device, 'host-shutdown/complete.json', 'host-observation.json');
const published = {
  'chat-network-isolated-draft': 'captures/local-chat-network-unconfirmed.png',
  'chat-network-isolated-reply': 'captures/local-chat-network-received.png',
};
for (const file of Object.values(published)) copy(local, file.split('/').at(-1), file);
const report = JSON.parse(readFileSync(resolve(destination, 'chat-network-recovery-results.json')));
assert.equal(report.runId, runId);
const archive = resolve(root, 'docs/release/evidence/source-archive'); mkdirSync(archive, { recursive: true });
for (const [file, hash] of Object.entries(report.sourceFiles)) {
  const bytes = execFileSync('git', ['show', `${commit}:${file}`], { maxBuffer: 2 * 1024 * 1024 });
  assert.equal(createHash('sha256').update(bytes).digest('hex'), hash);
  const target = resolve(archive, hash + '.txt');
  if (existsSync(target)) assert.deepEqual(readFileSync(target), bytes);
  else writeFileSync(target, bytes, { flag: 'wx' });
}
const gh = path => JSON.parse(execFileSync('gh', ['api', path], { encoding: 'utf8', timeout: 30_000 }));
save('job.json', gh('repos/MohamedRed/Sports-Green-Moove/actions/jobs/122180209848'));
save('artifact.json', gh('repos/MohamedRed/Sports-Green-Moove/actions/artifacts/12732624464'));
save('visual-review.json', { runId, sourceCommit: commit, checkedAt: '2026-10-27',
  scope: 'two-reviewed-original-windows-not-all-captures-or-physical-proof', published,
  excluded: { 'local-chat-network-recovered.png': 'Incomplete window redraw; not published.' } });
save('artifact-sha256.json', Object.fromEntries(files.map(file => [file,
  createHash('sha256').update(readFileSync(resolve(destination, file))).digest('hex')])));
console.log(JSON.stringify({ destination, runId, published: Object.keys(published), sourceFilesRetained: Object.keys(report.sourceFiles).length }));
