import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {resolve} from 'node:path';

const root = resolve(import.meta.dirname, '../..');
const source = '/Users/mrr/.codex/sgm-native-comparison-20261031/ci-5d69928/outputs';
const destination = resolve(root, 'docs/release/evidence/native-copy-5d69928-2026-10-31');
assert(!existsSync(destination), 'A retained native attempt is immutable');
const api = path => JSON.parse(execFileSync('/opt/homebrew/bin/gh', ['api',
  'repos/MohamedRed/Sports-Green-Moove/' + path], {encoding: 'utf8', maxBuffer: 4_000_000}));
const run = api('actions/runs/41196576936'), jobs = api('actions/runs/41196576936/jobs?per_page=100');
assert.equal(run.head_sha, '5d699283747c79f92483c994b3deccc7d32163f1');
assert.equal(run.status, 'completed'); assert.equal(run.conclusion, 'failure');
const job = jobs.jobs.find(row => row.id === 124523837653); assert.equal(job.conclusion, 'failure');
const artifact = api('actions/artifacts/13041841273');
assert.equal(artifact.workflow_run.id, run.id); assert.equal(artifact.workflow_run.head_sha, run.head_sha);
const replay = 'local-ui-evidence/0e9c8fd83120582833d7513ae2d0516b/';
assert(!existsSync(resolve(source, replay, 'results.json')));
mkdirSync(destination);
const files = [], members = {};
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const save = (path, value) => {writeFileSync(resolve(destination, path), value, {flag: 'wx'}); files.push(path);};
const json = (path, value) => save(path, JSON.stringify(value, null, 2) + '\n');
for (const [to, from] of Object.entries({
  'ordinary-results.json': 'store-review-screenshots/ordinary-results.json',
  'restoration.json': 'store-review-screenshots/disposable-store-restore.json',
  'network-instrumentation.txt': replay + 'LocalChatNetworkFlowTest-instrumentation.txt',
  'network-ui.json': replay + 'local-chat-network-ui.json',
  'primary-copy.json': replay + 'adb-pull-network-recovery.json',
  'sync-diagnostics.json': replay + 'adb-sync-network-recovery-diagnostics.json',
  'failure-cleanup-copy.json': replay + 'adb-pull-failure-cleanup.json',
})) {
  const bytes = readFileSync(resolve(source, from)); save(to, bytes); members['outputs/' + from] = sha(bytes);
}
json('run.json', run); json('jobs.json', jobs); json('artifact.json', artifact);
json('review.json', {scope: 'passing-instrumentation-followed-by-failed-primary-copy-not-complete-replay',
  reviewedAt: '2026-10-31', sourceCommit: run.head_sha, runId: run.id, jobId: job.id,
  archiveDownloadedViaCli: true, archiveDigestIndependentlyVerified: false, retainedMemberChecksums: members,
  fullReplayResultPresent: false, primaryCopyAccepted: false, failureCleanupReplacesPrimary: false,
  fullNativeGateAccepted: false, storedChatRecordsVerified: false, offlineChatSequenceAccepted: false,
  priorPreparationFailureCauseEstablished: false, copyFailureRootCauseEstablished: false,
  physicalPhoneAccepted: false, productionWrites: false, releaseAccepted: false});
json('artifact-sha256.json', Object.fromEntries(files.map(file => [file, sha(readFileSync(resolve(destination, file)))])));
console.log(JSON.stringify({retained: destination, workflowSucceeded: false}));
