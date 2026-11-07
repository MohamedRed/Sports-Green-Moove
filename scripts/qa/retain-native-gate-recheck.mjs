import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync} from 'node:fs';
import {isAbsolute, resolve} from 'node:path';
import {nativeGateFolder, nativeGateHead, validateNativeGateRecheck} from './native-gate-recheck-evidence.mjs';

const [current, previous, startupLog, baseline] = process.argv.slice(2);
assert([current, previous, startupLog, baseline].every(path => isAbsolute(path ?? '')));
const root = resolve(import.meta.dirname, '../..'), destination = resolve(root, nativeGateFolder);
assert(!existsSync(destination)); mkdirSync(resolve(destination, 'replay'), {recursive: true}); mkdirSync(resolve(destination, 'previous'));
const files = [], copy = (base, file, target = file) => {copyFileSync(resolve(base, file), resolve(destination, target)); files.push(target);};
const save = (file, value) => {writeFileSync(resolve(destination, file), JSON.stringify(value, null, 2) + '\n', {flag: 'wx'}); files.push(file);};
const gh = args => JSON.parse(execFileSync('gh', args, {encoding: 'utf8', timeout: 60_000}));
const repo = 'MohamedRed/Sports-Green-Moove';
save('native-run.json', gh(['run', 'view', '40758810301', '--repo', repo, '--json', 'databaseId,headSha,status,conclusion,jobs,url']));
save('pr-checks.json', gh(['pr', 'view', '1', '--repo', repo, '--json', 'headRefOid,statusCheckRollup']));
save('artifact.json', gh(['api', `repos/${repo}/actions/artifacts/12848947199`]));
save('baseline-artifact.json', gh(['api', `repos/${repo}/actions/artifacts/12847326599`]));
save('previous/native-run.json', gh(['run', 'view', '40756230929', '--repo', repo, '--json', 'databaseId,headSha,status,conclusion,jobs,url']));
save('previous/remote-job.json', gh(['api', `repos/${repo}/actions/jobs/123055767962`]));
const replay = resolve(current, 'outputs/local-ui-evidence/6e0e5edb6a387fe4460836d6b488b1ef');
for (const file of readdirSync(replay).filter(file => file === 'results.json' || file === 'local-chat-network-ui.json'
  || file.endsWith('-instrumentation.txt') || /^adb-pull-.*\.json$/.test(file))) copy(replay, file, 'replay/' + file);
for (const [file, target] of [['ordinary-results.json', 'ordinary-results.json'], ['ordinary-instrumentation.txt', 'ordinary-instrumentation.txt'],
  ['native-suite-status.json', 'native-suite-status.json'], ['disposable-store-restore.json', 'device-restoration.json']])
  copy(current, 'outputs/store-review-screenshots/' + file, target);
const failed = 'outputs/local-ui-evidence/06ceb8f5356a63bf06f5b4e39a9f67c8/';
copy(previous, failed + 'adb-pull-trip-change-parent-confirmation.json', 'previous/primary-copy.json');
copy(previous, failed + 'adb-pull-failure-cleanup.json', 'previous/failure-cleanup-copy.json');
copy(previous, 'outputs/store-review-screenshots/native-suite-status.json', 'previous/native-suite-status.json');
copy(previous, 'outputs/store-review-screenshots/disposable-store-restore.json', 'previous/device-restoration.json');
copy(previous, 'outputs/store-review-screenshots/ordinary-results.json', 'previous/ordinary-results.json');
copy(previous, 'outputs/store-review-screenshots/ordinary-instrumentation.txt', 'previous/ordinary-instrumentation.txt');
const excerpt = readFileSync(startupLog, 'utf8').split('\n').filter(line => /\badb: device offline\s*$/.test(line));
assert(excerpt.length > 0 && excerpt.length < 12); assert(excerpt.every(line => line.length < 500));
writeFileSync(resolve(destination, 'previous/remote-startup-excerpt.txt'), excerpt.join('\n') + '\n', {flag: 'wx'});
files.push('previous/remote-startup-excerpt.txt');
copy(baseline, 'results.json', 'baseline-7417e22-results.json');
const sourceFiles = execFileSync('git', ['ls-tree', '-r', '--name-only', nativeGateHead], {encoding: 'utf8'}).trim().split('\n')
  .filter(file => /^android\/app\/src\/androidTest\/.*\/Local[^/]+\.kt$/.test(file) || [
    '.github/workflows/native-ci.yml', 'scripts/run-android-ui-tests-and-collect-screenshots.sh', 'scripts/qa/run-ordinary-android-ui.mjs',
    'scripts/qa/local-android-session.mjs', 'scripts/qa/local-ui-session.mjs', 'scripts/qa/run-local-android-flows.mjs',
    'scripts/qa/collect-local-ui-evidence.mjs'].includes(file));
const hashes = {};
for (const file of sourceFiles) {
  const bytes = execFileSync('git', ['show', `${nativeGateHead}:${file}`]), hash = createHash('sha256').update(bytes).digest('hex');
  const archive = resolve(root, 'docs/release/evidence/source-archive', hash + '.txt');
  if (existsSync(archive)) assert.deepEqual(readFileSync(archive), bytes); else writeFileSync(archive, bytes, {flag: 'wx'});
  hashes[file] = hash;
}
save('source-sha256.json', hashes);
save('summary.json', {scope: 'complete-enabled-native-ci-not-physical-or-release-acceptance', checkedAt: '2026-10-28',
  sourceCommit: nativeGateHead, ciRunId: 40758810301, ordinary: {passed: 187, skipped: 54, failed: 0},
  physicalDeviceAccepted: false, productionWrites: false, releaseComplete: false, earlierTransportRootCauseConfirmed: false,
  realPaymentsExercised: false, safetyAuditAccepted: false, newMediaAccepted: false});
save('artifact-sha256.json', Object.fromEntries(files.map(file => [file,
  createHash('sha256').update(readFileSync(resolve(destination, file))).digest('hex')])));
validateNativeGateRecheck(root, {source: nativeGateFolder + 'summary.json', checkedAt: '2026-10-28', checksums: nativeGateFolder + 'artifact-sha256.json'});
console.log('Retained full native gate, forty replay cases, seventeen primary copies and earlier failures; no release acceptance.');
