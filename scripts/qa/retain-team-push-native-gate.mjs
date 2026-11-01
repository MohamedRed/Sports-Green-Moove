import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync} from 'node:fs';
import {isAbsolute, resolve} from 'node:path';
import {parseAndroidJUnitTranscript} from './android-junit-transcript.mjs';
const root = resolve(import.meta.dirname, '../..'), trial = process.argv[2]; assert(isAbsolute(trial ?? ''));
const run = JSON.parse(readFileSync(resolve(trial, 'previous-native-run.json')));
assert.equal(run.databaseId, 41314916070); assert.equal(run.headSha, '94a3ffb6c535264a8535184eda3f9b8dc01c54a2');
assert.equal(run.status, 'completed'); assert.equal(run.conclusion, 'failure');
const base = resolve(root, 'docs/release/evidence/team-push-native-gate-94a3ffb-2026-11-01');
assert(!existsSync(base), 'Never overwrite retained evidence'); mkdirSync(base);
const hashes = {}, sha = bytes => createHash('sha256').update(bytes).digest('hex');
const put = (file, bytes) => { mkdirSync(resolve(base, file, '..'), {recursive: true}); writeFileSync(resolve(base, file), bytes, {flag: 'wx'}); hashes[file] = sha(bytes); };
put('run.json', JSON.stringify(run, null, 2) + '\n');
put('artifact.json', readFileSync(resolve(trial, 'previous-native-artifact.json')));
const output = resolve(trial, 'previous-native-artifact/outputs/store-review-screenshots');
for (const file of ['ordinary-results.json', 'ordinary-instrumentation.txt', 'native-suite-status.json', 'disposable-store-restore.json'])
  put(file, readFileSync(resolve(output, file)));
const ordinary = parseAndroidJUnitTranscript(readFileSync(resolve(output, 'ordinary-instrumentation.txt'), 'utf8'));
assert.equal(ordinary.failed, 2); assert.equal(ordinary.passed, 230); assert.equal(ordinary.skipped, 54);
const directory = resolve(output, 'capture-timing/primary-capture-diagnostics');
for (const file of readdirSync(directory)) put('capture-diagnostics/' + file, readFileSync(resolve(directory, file)));
const sources = ['TripChangeFlowTest.kt', 'LocalUiCapture.kt', 'PrimaryCaptureDiagnostics.kt', 'TeamPushPrivateStorageTest.kt']
  .map(file => 'android/app/src/androidTest/java/be/sportgreenmoove/app/ui/' + file);
const sourceFiles = {};
for (const file of sources) {
  const bytes = execFileSync('git', ['show', run.headSha + ':' + file], {cwd: root}), hash = sha(bytes); sourceFiles[file] = hash;
  const archive = resolve(root, 'docs/release/evidence/source-archive', hash + '.txt');
  if (!existsSync(archive)) writeFileSync(archive, bytes, {flag: 'wx'}); else assert.equal(sha(readFileSync(archive)), hash);
}
put('review.json', JSON.stringify({scope: 'failed-native-capture-gate-not-runtime-or-release-proof',
  sourceCommit: run.headSha, testedAt: run.updatedAt, fullGatePassed: false, rootCauseConfirmed: false,
  sourceFiles, ordinary: {cases: 286, passed: 230, skipped: 54, failed: 2}, privateStorageCasePassed: true,
  physicalDevice: false, runtimeCallbacksExecuted: false, pushDeliveryVerified: false, releaseAccepted: false,
  rawArchiveDigestIndependentlyMatched: false, publishedCaptures: {}}, null, 2) + '\n');
writeFileSync(resolve(base, 'artifact-sha256.json'), JSON.stringify(hashes, null, 2) + '\n', {flag: 'wx'});
console.log('Retained two actual PixelCopy wait failures and one scoped private-storage pass; the full gate stays failed.');
