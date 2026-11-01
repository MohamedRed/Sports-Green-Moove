import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {isAbsolute, resolve} from 'node:path';
import {parseAndroidJUnitTranscript} from './android-junit-transcript.mjs';

const root = resolve(import.meta.dirname, '../..'), [main, chat, metadata] = process.argv.slice(2);
for (const file of [main, chat, metadata]) assert(isAbsolute(file ?? ''));
const json = file => JSON.parse(readFileSync(file));
const run = json(resolve(metadata, 'sgm-team-signout-previous-native-run-20261101.json'));
assert.equal(run.databaseId, 41319436417); assert.equal(run.headSha, 'e2bb5d264a158137624ed041300acdc370061103');
assert.equal(run.status, 'completed'); assert.equal(run.conclusion, 'failure');
const base = resolve(root, 'docs/release/evidence/native-network-preparation-e2bb5d2-2026-11-01');
assert(!existsSync(base)); mkdirSync(base);
const sha = bytes => createHash('sha256').update(bytes).digest('hex'), hashes = {};
const put = (file, bytes) => { mkdirSync(resolve(base, file, '..'), {recursive: true}); writeFileSync(resolve(base, file), bytes, {flag: 'wx'}); hashes[file] = sha(bytes); };
put('run.json', JSON.stringify(run, null, 2) + '\n');
const artifacts = json(resolve(metadata, 'sgm-team-signout-previous-artifacts-20261101.json')).artifacts;
for (const [name, id] of [['main-artifact.json', 13089772806], ['chat-artifact.json', 13089610138]]) {
  const artifact = artifacts.find(row => row.id === id); assert(artifact); put(name, JSON.stringify(artifact, null, 2) + '\n');
}
const ordinary = resolve(main, 'outputs/store-review-screenshots');
for (const file of ['ordinary-results.json', 'ordinary-instrumentation.txt', 'native-suite-status.json', 'disposable-store-restore.json'])
  put('main/' + file, readFileSync(resolve(ordinary, file)));
const parsed = parseAndroidJUnitTranscript(readFileSync(resolve(ordinary, 'ordinary-instrumentation.txt'), 'utf8'));
assert.equal(parsed.passed, 232); assert.equal(parsed.skipped, 54); assert.equal(parsed.failed, 0);
const runId = '09241e1a5b1d586a147c0acd046b01e2', failed = resolve(chat, 'local-ui-evidence', runId);
for (const file of ['LocalChatNetworkFlowTest-instrumentation.txt', 'local-chat-network-ui.json', 'adb-pull-failure-cleanup.json'])
  put('chat/' + file, readFileSync(resolve(failed, file)));
for (const file of ['chat-network-recovery-suite-status.json', 'disposable-device-restore.json', 'network-readiness/outcome.json'])
  put('chat/' + file, readFileSync(resolve(chat, 'focused-safety-ui/chat-network-recovery', file)));
const sourceFiles = {};
for (const name of ['LocalChatNetworkFlowTest.kt', 'LocalEmulatorNetwork.kt', 'TeamPushPrivateStorageTest.kt']) {
  const file = 'android/app/src/androidTest/java/be/sportgreenmoove/app/ui/' + name;
  const bytes = execFileSync('git', ['show', run.headSha + ':' + file], {cwd: root}), hash = sha(bytes); sourceFiles[file] = hash;
  const archive = resolve(root, 'docs/release/evidence/source-archive', hash + '.txt');
  if (!existsSync(archive)) writeFileSync(archive, bytes, {flag: 'wx'}); else assert.equal(sha(readFileSync(archive)), hash);
}
put('review.json', JSON.stringify({scope: 'failed-network-preparation-not-chat-retry-or-release-proof', sourceCommit: run.headSha,
  testedAt: run.updatedAt, fullGatePassed: false, mainJobPassed: true, ordinary: {cases: 286, passed: 232, skipped: 54, failed: 0},
  focused: {lanes: 11, passed: 10, failed: 1}, failedPhase: 'network-preparation', failedLine: 83,
  requestedCellularAvailableCallbacks: 0, wifiReadinessEarlierPassed: true, chatRetryOutcomeReached: false,
  privateStorageCasePassed: true, rootCauseConfirmed: false, physicalDevice: false, runtimeCallbacksExecuted: false,
  pushDeliveryVerified: false, releaseAccepted: false, rawArchiveDigestIndependentlyMatched: false, publishedCaptures: {}, sourceFiles}, null, 2) + '\n');
writeFileSync(resolve(base, 'artifact-sha256.json'), JSON.stringify(hashes, null, 2) + '\n', {flag: 'wx'});
console.log('Retained the main pass separately from the focused network-preparation failure.');
