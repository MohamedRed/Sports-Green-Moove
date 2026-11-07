import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {dirname, isAbsolute, resolve} from 'node:path';
import {gzipSync} from 'node:zlib';
import {observeIncompleteOrdinaryTranscript} from './ordinary-cutoff-observation.mjs';

const [wifiZip, cutoffZip, clockLog] = process.argv.slice(2);
for (const path of [wifiZip, cutoffZip, clockLog]) assert(isAbsolute(path ?? ''));
const root = resolve(import.meta.dirname, '../..'), relative = 'docs/release/evidence/native-cutoff-142-2026-11-06';
const output = resolve(root, relative); assert(!existsSync(output)); mkdirSync(output, {recursive: true});
const sha = bytes => createHash('sha256').update(bytes).digest('hex'), records = [], members = [];
function save(file, value) {
  const bytes = Buffer.isBuffer(value) ? value : Buffer.from(JSON.stringify(value, null, 2) + '\n');
  if (!file.endsWith('.gz')) assert(!/Bearer\s+[\w.~+/-]+=*|AIza[\w-]{20,}|eyJ[\w-]+\.[\w-]+\.[\w-]*/.test(bytes));
  mkdirSync(dirname(resolve(output, file)), {recursive: true}); writeFileSync(resolve(output, file), bytes, {flag: 'wx'});
  records.push({file, sha256: sha(bytes)});
}
const identities = [
  {zip: wifiZip, prefix: 'wifi', id: 13535194238, run: 42281015271, job: 128109652486,
    commit: '6fb6487c2b9a31b84faa23a096ce345fa63cdca2', bytes: 53415, digest: 'd222397b3000e3ff5243fae97d5236bd3cb9ea43efd411a7f5fbc90d4d7f727b'},
  {zip: cutoffZip, prefix: 'cutoff', id: 13539586865, run: 42285237318, job: 128124232822,
    commit: '142789c9459a070e9789feb8fcc5b3265688729e', bytes: 34630694, digest: '2732f38d2f18df9266628651012de99e4920dc13f6e8dce3bcded97a89d600fd'},
];
const gh = path => JSON.parse(execFileSync('gh', ['api', 'repos/MohamedRed/Sports-Green-Moove/' + path], {encoding: 'utf8', timeout: 60_000}));
for (const id of identities) {
  const bytes = readFileSync(id.zip); assert.equal(bytes.length, id.bytes); assert.equal(sha(bytes), id.digest);
  const artifact = gh('actions/artifacts/' + id.id), job = gh('actions/jobs/' + id.job);
  assert.equal(artifact.size_in_bytes, id.bytes); assert.equal(artifact.digest, 'sha256:' + id.digest);
  assert.equal(artifact.workflow_run.head_sha, id.commit); assert.equal(artifact.workflow_run.id, id.run);
  assert.equal(job.head_sha, id.commit); assert.equal(job.run_id, id.run); assert.equal(job.status, 'completed'); assert.equal(job.conclusion, 'failure');
  save(id.prefix + '/artifact.json', artifact);
  save(id.prefix + '/job.json', {headSha: job.head_sha, id: job.id, runId: job.run_id, status: job.status, conclusion: job.conclusion,
    startedAt: job.started_at, completedAt: job.completed_at, steps: job.steps.map(({name, conclusion}) => ({name, conclusion}))});
}
function select(id, member, target, gzip = false) {
  const bytes = execFileSync('unzip', ['-p', id.zip, member], {maxBuffer: 16 * 1024 * 1024});
  assert(!/Bearer\s+[\w.~+/-]+=*|AIza[\w-]{20,}|eyJ[\w-]+\.[\w-]+\.[\w-]*/.test(bytes));
  const file = id.prefix + '/' + target;
  save(file, gzip ? gzipSync(bytes) : bytes);
  members.push({artifactId: id.id, member, file, encoding: gzip ? 'gzip' : 'identity', originalBytes: bytes.length, originalSha256: sha(bytes)});
  return bytes;
}
const [wifi, cutoff] = identities, ordinary = 'outputs/store-review-screenshots/';
for (const id of identities) for (const file of ['host-dns-before-launch.json', 'network-readiness/outcome.json', 'network-readiness/chat-network-validation-before.json'])
  select(id, ordinary + file, file);
const wifiFiles = execFileSync('unzip', ['-Z1', wifi.zip], {encoding: 'utf8'}).trim().split('\n');
for (const file of wifiFiles.filter(file => /\/network-readiness\/sample-\d{3}\.json$/.test(file))) select(wifi, file, file.replace(ordinary, ''));
for (const file of ['ordinary-process.json', 'disposable-device-setup.json.replay-stopped.json', 'disposable-store-restore.json', 'native-suite-status.json'])
  select(cutoff, ordinary + file, file);
for (const name of ['diagnostics.json', 'crash.txt', 'exit-info.txt', 'process-log.txt', 'frozen-packages.txt', 'install-sessions.txt', 'guest-memory.txt', 'package-operations.txt'])
  select(cutoff, ordinary + 'ordinary-failure/OrdinaryUiSuite-' + name, 'ordinary-failure/' + name);
const transcript = select(cutoff, ordinary + 'ordinary-instrumentation.txt', 'ordinary-instrumentation.txt.gz', true);
const observation = observeIncompleteOrdinaryTranscript(transcript.toString());
assert.equal(observation.announcedCases, 354); assert.equal(observation.startedCases, 350); assert.equal(observation.endedCases, 349);
const replay = 'outputs/local-ui-evidence/f7e7eec1ece3b66c197f92b1a9e1e611/';
for (const file of ['local-chat-network-ui.json', 'chat-network-validation-before.json', 'chat-network-validation-after.json',
  'chat-subscriptions-after.json', 'chat-default-selection-after.json']) select(cutoff, replay + file, 'network/' + file);
select(cutoff, 'outputs/focused-safety-ui/full-matrix/host-shutdown/complete.json', 'host-shutdown.json');
const checks = readFileSync(clockLog); assert(checks.includes('1025-event cap; no device emission proof.'));
save('clock-checks.txt', checks);
const sources = [
  ['142789c9459a070e9789feb8fcc5b3265688729e', 'scripts/qa/run-ordinary-android-ui.mjs'],
  ['142789c9459a070e9789feb8fcc5b3265688729e', 'scripts/qa/native-process-failure-evidence.mjs'],
  ['142789c9459a070e9789feb8fcc5b3265688729e', 'android/app/src/androidTest/java/be/sportgreenmoove/app/ui/TripHistoryFlowTest.kt'],
];
const sourceRecords = [];
for (const [commit, path] of sources) {
  const bytes = execFileSync('git', ['show', commit + ':' + path], {cwd: root}), hash = sha(bytes);
  const archive = resolve(root, 'docs/release/evidence/source-archive', hash + '.txt');
  if (existsSync(archive)) assert.equal(sha(readFileSync(archive)), hash); else writeFileSync(archive, bytes, {flag: 'wx'});
  sourceRecords.push({path, commit, sha256: hash});
}
for (const path of ['android/app/src/androidTest/java/be/sportgreenmoove/app/ui/OrdinaryCaseTimingListener.java',
  'tests/fixtures/ordinary-case-timing/OrdinaryCaseTimingChecks.java', 'scripts/qa/check-ordinary-case-timing.mjs']) {
  const bytes = readFileSync(resolve(root, path)), hash = sha(bytes), archive = resolve(root, 'docs/release/evidence/source-archive', hash + '.txt');
  assert(!existsSync(archive)); writeFileSync(archive, bytes, {flag: 'wx'}); sourceRecords.push({path, commit: 'candidate', sha256: hash});
}
save('source-sha256.json', {files: sourceRecords}); save('selected-members.json', {members});
save('summary.json', {checkedAt: '2026-11-06', scope: 'distinct-wifi-prerequisite-and-ordinary-host-cutoff-not-root-cause-or-flow-proof',
  archives: identities.map(({zip, prefix, ...id}) => id), ordinaryObservation: observation,
  clockCandidateCompiledAgainstAndroidAndJUnit: true, clockCandidateUsedInjectedClockAndLogger: true,
  originalCaseInventory: 354, originalOrdinaryDeadlineMs: 720000, originalPerCaseDeadlineMs: 240000,
  originalFailureAndRestorePreserved: true, ordinaryComplete: false, rootCauseConfirmed: false,
  clockDeviceEmissionObserved: false, fullMatrixAccepted: false, physicalDeviceAccepted: false, releaseComplete: false, records: [...records]});
console.log(JSON.stringify({source: relative + '/summary.json', sha256: sha(readFileSync(resolve(output, 'summary.json'))), selectedMembers: members.length}));
