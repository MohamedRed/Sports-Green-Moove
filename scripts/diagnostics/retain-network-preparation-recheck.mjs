import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync} from 'node:fs';
import {isAbsolute, resolve} from 'node:path';
import {networkPreparationFolder, validateNetworkPreparationRecheck} from '../../partner-portal/network-preparation-validation.mjs';

const root = resolve(import.meta.dirname, '../..'), [passed, failed, passJob, failedJob] = process.argv.slice(2);
assert([passed, failed, passJob, failedJob].every(path => isAbsolute(path ?? '')));
const producers = {
  pass: {zip: passed, job: passJob, run: 41360242235, jobId: 125008879000, artifactId: 13105240971,
    commit: '3eae5352f1da43531bc016afc67a8e44b5a9ea52', runId: 'ba6d8c76c1580c3122c2d06ce27ecc3c',
    sha256: '0ff2bda3b441cf31c01c2d77c4aeb22e1a2acd3d1fd0da4f40ba11af6d1451e9'},
  failed: {zip: failed, job: failedJob, run: 41356410907, jobId: 124997296280, artifactId: 13103354946,
    commit: '8369af5424e9e48232cf98b83ef58b3275e9827e', runId: '603e9354e9df19dddb2c55534f6dfb2b',
    sha256: '5e401a493854bc56484ffae7099408134ca55f3e96712275cdcadce7fc94c395'},
};
const base = resolve(root, networkPreparationFolder); assert(!existsSync(base), 'Never replace original CI evidence');
mkdirSync(base, {recursive: true});
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const save = (path, value) => writeFileSync(resolve(base, path), JSON.stringify(value, null, 2) + '\n', {flag: 'wx'});
for (const [label, producer] of Object.entries(producers)) {
  assert.equal(hash(readFileSync(producer.zip)), producer.sha256); mkdirSync(resolve(base, label));
  const job = JSON.parse(readFileSync(producer.job)); assert.equal(job.id, producer.jobId);
  assert.equal(job.run_id, producer.run); assert.equal(job.head_sha, producer.commit);
  assert.equal(job.conclusion, label === 'pass' ? 'success' : 'failure');
  save(label + '/producer.json', {...Object.fromEntries(['run', 'jobId', 'artifactId', 'commit', 'runId', 'sha256']
    .map(key => [key, producer[key]])), conclusion: job.conclusion, startedAt: job.started_at, completedAt: job.completed_at});
  const folder = 'local-ui-evidence/' + producer.runId + '/', focused = 'focused-safety-ui/chat-network-recovery/';
  const select = (from, to) => writeFileSync(resolve(base, label, to), execFileSync('unzip', ['-p', producer.zip, from],
    {maxBuffer: 4 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe']}), {flag: 'wx'});
  for (const [from, to] of [['local-chat-network-ui.json', 'ui.json'],
    ['LocalChatNetworkFlowTest-instrumentation.txt', 'instrumentation.txt'],
    ...['subscriptions', 'carrier', 'default-selection', 'modem'].flatMap(kind => ['before', 'after']
      .map(phase => ['chat-' + kind + '-' + phase + '.json', kind + '-' + phase + '.json']))]) select(folder + from, to);
  for (const name of ['disposable-device-restore.json', 'chat-network-recovery-suite-status.json']) select(focused + name, name);
  select(focused + 'host-shutdown/complete.json', 'host-disposed.json');
  for (const name of ['subscriptions', 'carrier']) select(focused + 'network-bootstrap/chat-' + name + '-before.json', 'bootstrap-' + name + '.json');
  if (label === 'pass') {
    select(folder + 'chat-network-recovery-results.json', 'results.json');
    select(folder + 'chat-network-recovery-app-results.json', 'app-results.json');
    select(folder + 'adb-pull-network-recovery.json', 'primary-copy.json');
    for (const name of ['recovered', 'received']) select(folder + 'local-chat-network-' + name + '.png', name + '.png');
  } else select(folder + 'adb-pull-failure-cleanup.json', 'failure-cleanup-copy.json');
}
const sources = JSON.parse(readFileSync(resolve(base, 'pass/results.json'))).sourceFiles;
for (const [file, expected] of Object.entries(sources)) {
  const bytes = readFileSync(resolve(root, file)); assert.equal(hash(bytes), expected);
  for (const producer of Object.values(producers)) assert.equal(hash(execFileSync('git', ['show', producer.commit + ':' + file],
    {cwd: root, maxBuffer: 1024 * 1024})), expected, file);
  const archived = resolve(root, 'docs/release/evidence/source-archive', expected + '.txt');
  if (!existsSync(archived)) writeFileSync(archived, bytes, {flag: 'wx'});
}
save('review.json', {scope: 'paired-independent-native-chat-preparation-failure-and-pass-not-root-cause-or-release',
  checkedAt: '2026-11-01', sharedSourceFiles: sources, nativeCasesPassed: 1, screenshotsPublished: 0,
  changedTestConditions: false, defaultSelectionCauseProven: false, missingDefaultRepaired: false,
  fullNativeGateAccepted: false, physicalDeviceAccepted: false, radioLossAccepted: false,
  postCommitLossAccepted: false, productionWrites: false, releaseAccepted: false});
const hashes = {}, walk = directory => {for (const entry of readdirSync(resolve(base, directory), {withFileTypes: true})) {
  const path = directory ? directory + '/' + entry.name : entry.name;
  if (entry.isDirectory()) walk(path); else hashes[path] = hash(readFileSync(resolve(base, path)));
}}; walk(''); save('artifact-sha256.json', hashes);
console.log(JSON.stringify(validateNetworkPreparationRecheck(root)));
