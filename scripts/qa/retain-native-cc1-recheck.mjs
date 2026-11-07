import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {dirname, isAbsolute, resolve} from 'node:path';
import {assertNativeClockStartupMarker} from './native-clock-startup-evidence.mjs';
import {assertInstrumentationPassed} from './android-instrumentation-result.mjs';

const [mainZip, startupZip] = process.argv.slice(2);
for (const file of [mainZip, startupZip]) assert(isAbsolute(file ?? ''));
const root = resolve(import.meta.dirname, '../..'), relative = 'docs/release/evidence/native-recheck-cc1e6d7-2026-11-06';
const base = resolve(root, relative); assert(!existsSync(base));
const sha = value => createHash('sha256').update(value).digest('hex'), records = [], members = [];
const identities = [
  {zip: mainZip, prefix: 'matrix', id: 13542339539, job: 128165783151, bytes: 53283,
    sha256: '29ad3e29f2841e5c73c60b6516add409a8eda6e74fb2392119f06f083530faa6'},
  {zip: startupZip, prefix: 'startup', id: 13542344202, job: 128165783832, bytes: 1363529,
    sha256: 'cb5a1fc2684a5e9c30d758e28a64f2677c52ca8eb23d0750daf78243da9f3cbf'},
];
const api = path => JSON.parse(execFileSync('gh', ['api', 'repos/MohamedRed/Sports-Green-Moove/' + path], {encoding: 'utf8', timeout: 60000}));
for (const id of identities) {const bytes = readFileSync(id.zip); assert.equal(bytes.length, id.bytes); assert.equal(sha(bytes), id.sha256);}
mkdirSync(base, {recursive: true});
function save(file, value) {
  const bytes = Buffer.isBuffer(value) ? value : Buffer.from(JSON.stringify(value, null, 2) + '\n');
  assert(!/Bearer\s+[\w.~+/-]+=*|AIza[\w-]{20,}|eyJ[\w-]+\.[\w-]+\.[\w-]*/.test(bytes.toString()));
  mkdirSync(dirname(resolve(base, file)), {recursive: true}); writeFileSync(resolve(base, file), bytes, {flag: 'wx'});
  records.push({file, sha256: sha(bytes)});
}
for (const id of identities) {
  const artifact = api('actions/artifacts/' + id.id), job = api('actions/jobs/' + id.job);
  assert.equal(artifact.digest, 'sha256:' + id.sha256); assert.equal(artifact.size_in_bytes, id.bytes);
  assert.equal(artifact.workflow_run.id, 42297306683); assert.equal(artifact.workflow_run.head_sha, 'cc1e6d7a494c8aa534d94ee9c9b8d2815092b461');
  assert.equal(job.run_id, 42297306683); assert.equal(job.status, 'completed'); assert.equal(job.conclusion, 'failure');
  assert.equal(job.head_sha, artifact.workflow_run.head_sha);
  save(id.prefix + '/artifact.json', artifact);
  save(id.prefix + '/job.json', {sourceCommit: job.head_sha, runId: job.run_id, jobId: job.id, conclusion: job.conclusion,
    steps: job.steps.map(({name, conclusion}) => ({name, conclusion}))});
}
function select(id, member, name) {
  const bytes = execFileSync('unzip', ['-p', id.zip, member], {maxBuffer: 4 * 1024 * 1024}), file = id.prefix + '/' + name;
  save(file, bytes); members.push({artifactId: id.id, member, file, bytes: bytes.length, sha256: sha(bytes)}); return bytes;
}
const [matrix, startup] = identities, device = 'outputs/store-review-screenshots/';
for (const name of ['host-dns-before-launch.json', 'network-readiness/outcome.json', 'network-readiness/chat-network-validation-before.json'])
  select(matrix, device + name, name);
const local = 'local-ui-evidence/a1e434e727364215567e88ef98d2f723/';
for (const name of ['LocalNativeTrackingStartupTest-instrumentation.txt', 'local-native-startup-device.json',
  'adb-pull-native-startup.json', 'adb-pull-failure-cleanup.json', 'adb-sync-native-startup-diagnostics.json']) select(startup, local + name, name);
for (const name of ['disposable-device-restore.json', 'native-startup-suite-status.json', 'host-shutdown/complete.json'])
  select(startup, 'focused-safety-ui/native-startup/' + name, name);
assertInstrumentationPassed(readFileSync(resolve(base, 'startup/LocalNativeTrackingStartupTest-instrumentation.txt'), 'utf8'), 1);
assertNativeClockStartupMarker(JSON.parse(readFileSync(resolve(base, 'startup/local-native-startup-device.json'))));
save('original-archives.json', {archives: identities.map(({zip, ...id}) => id), members});
save('summary.json', {checkedAt: '2026-11-06', sourceCommit: 'cc1e6d7a494c8aa534d94ee9c9b8d2815092b461',
  runId: 42297306683, matrixStoppedBeforeAppFlow: true, startupComponentPassed: true, primaryStartupCopyPassed: false,
  cleanupCopyPassed: true, currentHeadAccepted: false, rootCauseConfirmed: false,
  physicalDeviceAccepted: false, releaseComplete: false, newMediaPublished: false, records: [...records]});
console.log('Later Wi-Fi prerequisite and primary-copy failures retained separately; component pass and cleanup do not accept the flow.');
