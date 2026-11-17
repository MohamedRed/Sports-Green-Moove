import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {dirname, isAbsolute, resolve} from 'node:path';

const [mainZip, rideZip] = process.argv.slice(2);
assert.equal(process.argv.length, 4);
for (const path of [mainZip, rideZip]) assert(isAbsolute(path ?? ''));
const root = resolve(import.meta.dirname, '../..');
const sourceCommit = '05cd3f7d6869c7bfc5286ca76fcfa740d839add9';
const relative = 'docs/release/evidence/native-login-recheck-05cd3f7-2026-11-07';
const base = resolve(root, relative), records = [], members = [];
assert(!existsSync(base));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const api = path => JSON.parse(execFileSync('gh', ['api', 'repos/MohamedRed/Sports-Green-Moove/' + path],
  {encoding: 'utf8', timeout: 60000}));
const identities = [
  {zip: mainZip, prefix: 'matrix', id: 13549528101, job: 128218021359, bytes: 53277,
    sha256: '2a6b3e18b4d9764e83cbbcae7ccbd821341060d74bd605a42abe877c73daa28b'},
  {zip: rideZip, prefix: 'ride', id: 13549902155, job: 128218021570, bytes: 9383,
    sha256: '4e88d5a3dd4044e086c8278bfb86bf7fb87a0dc5a92569803a3b3adc1d0d81e3'},
];
for (const id of identities) {
  const bytes = readFileSync(id.zip); assert.equal(bytes.length, id.bytes); assert.equal(sha(bytes), id.sha256);
  const artifact = api('actions/artifacts/' + id.id), job = api('actions/jobs/' + id.job);
  assert.equal(artifact.workflow_run.id, 42312780331); assert.equal(artifact.workflow_run.head_sha, sourceCommit);
  assert.equal(artifact.digest, 'sha256:' + id.sha256); assert.equal(artifact.size_in_bytes, id.bytes);
  assert.equal(job.run_id, 42312780331); assert.equal(job.head_sha, sourceCommit);
  assert.equal(job.status, 'completed'); assert.equal(job.conclusion, 'failure');
  id.jobMetadata = {sourceCommit, runId: job.run_id, jobId: job.id, status: job.status, conclusion: job.conclusion,
    completedAt: job.completed_at, steps: job.steps.map(({name, conclusion}) => ({name, conclusion}))};
}
mkdirSync(base);
function save(file, value) {
  const bytes = Buffer.isBuffer(value) ? value : Buffer.from(JSON.stringify(value, null, 2) + '\n');
  assert(!/Bearer\s+[\w.~+/-]+=*|AIza[\w-]{20,}|eyJ[\w-]+\.[\w-]+\.[\w-]*/.test(bytes.toString()));
  mkdirSync(dirname(resolve(base, file)), {recursive: true}); writeFileSync(resolve(base, file), bytes, {flag: 'wx'});
  records.push({file, sha256: sha(bytes)});
}
function select(id, member, name) {
  const bytes = execFileSync('unzip', ['-p', id.zip, member], {maxBuffer: 2 * 1024 * 1024});
  const file = id.prefix + '/' + name; save(file, bytes);
  members.push({artifactId: id.id, member, file, bytes: bytes.length, sha256: sha(bytes)});
  return bytes;
}
for (const id of identities) save(id.prefix + '/job.json', id.jobMetadata);
const [matrix, ride] = identities, device = 'outputs/store-review-screenshots/';
for (const name of ['host-dns-before-launch.json', 'network-readiness/outcome.json',
  'network-readiness/sample-000.json', 'network-readiness/sample-058.json', 'network-readiness/chat-network-validation-before.json'])
  select(matrix, device + name, name);
const prefix = 'local-ui-evidence/6939188d5cbe560c8ab0dc62527ae163/';
for (const name of ['LocalRideObservationFlowTest-instrumentation.txt', 'LocalRideObservationFlowTest-diagnostics.json',
  'LocalRideObservationFlowTest-exit-info.txt', 'LocalRideObservationFlowTest-process-log.txt']) select(ride, prefix + name, name);
for (const name of ['ride-observation-suite-status.json', 'disposable-device-restore.json', 'host-shutdown/complete.json'])
  select(ride, 'focused-safety-ui/ride-observation/' + name, name);
const baseline = execFileSync('git', ['show', sourceCommit + ':android/app/src/androidTest/java/be/sportgreenmoove/app/ui/LocalRideObservationFlowTest.kt'], {cwd: root});
save('baseline-ride-test.kt', baseline);
save('original-archives.json', {archives: identities.map(({zip, jobMetadata, ...id}) => id), members});
save('summary.json', {checkedAt: '2026-11-07', sourceCommit, runId: 42312780331,
  scope: 'distinct-preinstall-wifi-and-parent-home-wait-failures-not-tracking-or-root-cause-proof',
  matrixStoppedBeforeAppInstallation: true, matrixWifiBudgetMs: 180000, matrixWifiSamples: 59,
  rideCasesExecuted: 1, rideCasesFailed: 1, rideFailureSourceLine: 61, rideFailureWaitMs: 60000,
  parentHomeObserved: false, rideObservationStarted: false, parentAuthenticationOutcomeKnown: false,
  processExitAfterInstrumentation: true, currentHeadAccepted: false, rootCauseConfirmed: false,
  nativeDiagnosticExecutionAccepted: false, physicalDeviceAccepted: false, releaseComplete: false,
  newMediaPublished: false, records: [...records]});
console.log(JSON.stringify({source: relative + '/summary.json', records: records.length, rootCauseConfirmed: false}));
