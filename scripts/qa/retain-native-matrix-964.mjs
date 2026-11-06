import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {dirname, isAbsolute, resolve} from 'node:path';
import {matrix964Folder, matrix964Identity as identity, validateMatrix964Evidence} from './native-matrix-964-evidence.mjs';

const [zip] = process.argv.slice(2), root = resolve(import.meta.dirname, '../..');
assert.equal(process.argv.length, 3); assert(isAbsolute(zip ?? ''));
const sha = bytes => createHash('sha256').update(bytes).digest('hex'), original = readFileSync(zip);
assert.equal(original.length, identity.bytes); assert.equal(sha(original), identity.sha256);
const base = resolve(root, matrix964Folder); assert(!existsSync(base)); mkdirSync(base);
const hashes = {}, members = [], local = 'outputs/local-ui-evidence/' + identity.session + '/', device = 'outputs/store-review-screenshots/';
function record(file, value) {
  const bytes = Buffer.isBuffer(value) ? value : Buffer.from(JSON.stringify(value, null, 2) + '\n');
  assert(!/Bearer\s+[\w.~+/-]+=*|AIza[\w-]{20,}|eyJ[\w-]+\.[\w-]+\.[\w-]*/.test(bytes.toString()));
  mkdirSync(dirname(resolve(base, file)), {recursive: true}); writeFileSync(resolve(base, file), bytes, {flag: 'wx'}); hashes[file] = sha(bytes);
}
const selected = [
  ['ordinary-results.json', device + 'ordinary-results.json'], ['ordinary-instrumentation.txt', device + 'ordinary-instrumentation.txt'],
  ['ordinary-tests.xml', 'outputs/androidTest-results/connected/debug/TEST-guarded-components.xml'],
  ['replay-results.json', local + 'results.json'], ['suite-status.json', device + 'native-suite-status.json'],
  ['device-setup.json', device + 'disposable-device-setup.json'], ['device-restoration.json', device + 'disposable-store-restore.json'],
  ['host-exit.json', 'outputs/focused-safety-ui/full-matrix/host-shutdown/complete.json'],
  ['matrix-manifest.json', 'outputs/matrix-apks/manifest.json'], ['host-dns-before-launch.json', device + 'host-dns-before-launch.json'],
  ['capture-collection.json', device + 'capture-timing/collection.json'],
];
const names = execFileSync('unzip', ['-Z1', zip], {encoding: 'utf8'}).trim().split('\n');
assert.equal(new Set(names).size, names.length);
for (const member of names.filter(name => name.startsWith(local))) {
  const name = member.slice(local.length);
  if (/^[A-Za-z0-9#-]+-instrumentation\.txt$/.test(name)) selected.push(['instrumentation/' + name, member]);
  if (/^adb-pull-[a-z-]+\.json$/.test(name)) selected.push(['copies/' + name, member]);
}
for (const [file, member] of selected) {
  const bytes = execFileSync('unzip', ['-p', zip, member], {maxBuffer: 4 * 1024 * 1024}); record(file, bytes);
  members.push({file, member, bytes: bytes.length, sha256: sha(bytes)});
}
record('original-archive.json', {artifactId: identity.artifact, bytes: original.length, sha256: sha(original), members});
record('artifact-metadata.json', JSON.parse(execFileSync('gh', ['api', 'repos/MohamedRed/Sports-Green-Moove/actions/artifacts/' + identity.artifact], {encoding: 'utf8'})));
record('native-run.json', JSON.parse(execFileSync('gh', ['run', 'view', String(identity.run), '--repo', 'MohamedRed/Sports-Green-Moove',
  '--json', 'databaseId,headSha,status,conclusion,jobs,url'], {encoding: 'utf8'})));
record('summary.json', {checkedAt: '2026-11-06', sourceCommit: identity.source, nativeJobPassed: true,
  localFlowGroupsPassed: 37, nativeReplayCasesPassed: 40, wholeWorkflowPassed: false, currentHeadAccepted: false,
  physicalDeviceAccepted: false, rootCauseConfirmed: false, ordinaryStopCandidateAccepted: false,
  safetyAuditAccepted: false, newMediaPublished: false, releaseComplete: false});
writeFileSync(resolve(base, 'artifact-sha256.json'), JSON.stringify(hashes, null, 2) + '\n', {flag: 'wx'});
validateMatrix964Evidence(root); console.log('Source-bound completed native job retained; no workflow, current-head, physical or release acceptance.');
