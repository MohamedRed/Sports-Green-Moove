import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {isAbsolute, resolve} from 'node:path';

const root = resolve(import.meta.dirname, '../..'), zip = process.argv[2]; assert(isAbsolute(zip ?? ''));
const folder = resolve(root, 'docs/release/evidence/chat-network-d56-preparation-2026-11-05');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const digest = '0076965dedc3babd21918cf73ea8a1d29b62525400eb8d51d21af41d350f4a43';
const bytes = readFileSync(zip); assert.equal(sha(bytes), digest); assert.equal(bytes.length, 366341);
const api = path => JSON.parse(execFileSync('gh', ['api', `repos/MohamedRed/Sports-Green-Moove/${path}`], {encoding: 'utf8'}));
const job = api('actions/jobs/127538625233'); assert.equal(job.conclusion, 'failure');
assert.equal(job.head_sha, 'd56cec66555cfb69a9f5ca336a637f99917376ed');
assert.equal(job.run_id, 42111120300); assert.equal(job.status, 'completed');
const local = 'local-ui-evidence/f4ba29f7496c1e16548c63a8f9340ec6/';
const device = 'focused-safety-ui/chat-network-recovery/';
const members = [
  [local + 'local-chat-network-ui.json', 'local-chat-network-ui.json'],
  [local + 'LocalChatNetworkFlowTest-instrumentation.txt', 'instrumentation.txt'],
  ...['disposable-device-setup.json', 'disposable-device-restore.json', 'chat-network-recovery-suite-status.json']
    .map(file => [device + file, file]),
  [device + 'host-shutdown/complete.json', 'host-shutdown.json'],
];
mkdirSync(folder, {recursive: true}); const records = [], receipts = [];
function record(file, value) {
  const bytes = typeof value === 'string' || Buffer.isBuffer(value) ? value : JSON.stringify(value, null, 2) + '\n';
  assert(!/Bearer\s+[\w.~+/-]+=*|AIza[\w-]{20,}|eyJ[\w-]+\.[\w-]+\.[\w-]*/.test(bytes.toString()));
  writeFileSync(resolve(folder, file), bytes, {flag: 'wx'}); records.push({file, sha256: sha(bytes)});
}
for (const [member, file] of members) {
  const original = execFileSync('unzip', ['-p', zip, member]); record(file, original);
  receipts.push({member, file, bytes: original.length, sha256: sha(original)});
}
const json = file => JSON.parse(readFileSync(resolve(folder, file)));
const ui = json('local-chat-network-ui.json'); assert.equal(ui.completed, false); assert.equal(ui.failedPhase, 'network-preparation');
assert.deepEqual(ui.network, []); assert.equal(ui.preparationFailure.hasDefaultDataSubscription, false);
assert.equal(ui.preparationFailure.cellularAvailableCallbacks, 0); assert.equal(ui.preparationFailure.backendReachable, true);
assert.equal(ui.preparationFailure.capabilityObservation.active.validated, true);
assert.equal(json('disposable-device-restore.json').verified, true); assert.equal(json('host-shutdown.json').finalState, 'gone');
record('terminal-job.json', {id: job.id, sourceCommit: job.head_sha, runId: job.run_id, status: job.status,
  conclusion: job.conclusion, steps: job.steps.map(({name, conclusion}) => ({name, conclusion}))});
record('archive-receipt.json', {artifactId: 13455233548, sha256: digest, bytes: bytes.length, members: receipts});
record('summary.json', {checkedAt: '2026-11-05', sourceCommit: job.head_sha, jobId: job.id, runId: job.run_id,
  completed: false, failedPhase: ui.failedPhase, actualNetworkCutExecuted: false, recoveryAccepted: false,
  rootCauseConfirmed: false, localPackagesAndPolicyRestored: true, hostExitObserved: true,
  newMedia: 0, physicalDeviceAccepted: false, releaseComplete: false, records: [...records]});
console.log('Retained subsequent d56 network-preparation failure before any radio cut, with exact archive and independent policy restoration/host exit; no recovery acceptance.');
