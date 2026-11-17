import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync} from 'node:fs';
import {dirname, isAbsolute, resolve} from 'node:path';
import {contextPhonePhases} from './review-context-phone-checkpoints.mjs';
import {contextReplayFolder, validateContextReplayEvidence} from './review-context-replay-evidence.mjs';
import {contextReplayHead} from './review-context-replay-gate.mjs';

const trial = process.argv[2]; assert(isAbsolute(trial ?? ''));
const root = resolve(import.meta.dirname, '../..'), base = resolve(root, contextReplayFolder);
assert(!existsSync(base)); mkdirSync(base, {recursive: true});
const files = [], copy = (source, target) => {
  const path = resolve(base, target); mkdirSync(dirname(path), {recursive: true}); copyFileSync(source, path); files.push(target);
};
const save = (file, value) => {writeFileSync(resolve(base, file), JSON.stringify(value, null, 2) + '\n', {flag: 'wx'}); files.push(file);};
for (const name of ['session-results', ...contextPhonePhases]) copy(resolve(trial, 'phone/' + name + '.json'), 'phone/' + name + '.json');
for (const name of readdirSync(resolve(trial, 'captures'))) {
  assert(/^\d\d-[a-z0-9-]+\.jpg$/.test(name)); copy(resolve(trial, 'captures', name), 'captures/' + name);
}
for (const name of ['before', 'stopped', 'reopened', 'package-removed']) copy(resolve(trial, 'process', name + '.json'), 'process/' + name + '.json');
for (const name of ['before', 'stopped', 'reopened']) copy(resolve(trial, 'process', name + '-ax.txt'), 'process/' + name + '-ax.txt');
for (const [source, target] of [['disposal.json', 'disposal.json'], ['native-run.json', 'native-run.json'],
  ['pr-checks-original.json', 'pr-checks.json'], ['native-artifact.json', 'native-artifact.json']]) copy(resolve(trial, source), target);
const output = resolve(trial, 'native-baseline/outputs'), shots = resolve(output, 'store-review-screenshots');
for (const [file, target] of [['ordinary-results.json', 'ordinary-results.json'], ['ordinary-instrumentation.txt', 'ordinary-instrumentation.txt'],
  ['native-suite-status.json', 'native-suite-status.json'], ['disposable-store-restore.json', 'device-restoration.json']])
  copy(resolve(shots, file), 'native/' + target);
const replay = resolve(output, 'local-ui-evidence/44bd901005f2cc96dd28972318cd963b');
for (const file of readdirSync(replay).filter(file => file === 'results.json' || file.endsWith('-instrumentation.txt') || /^adb-pull-.*\.json$/.test(file)))
  copy(resolve(replay, file), 'native/replay/' + file);
const apkSource = '74e8bd8c01b18c6e47c58b6e5c4afc2d4238e302';
const changed = execFileSync('git', ['diff', '--name-only', apkSource + '..' + contextReplayHead, '--', 'android/', 'functions/'],
  {cwd: root, encoding: 'utf8'}).split('\n').filter(Boolean);
assert.deepEqual(changed, []);
save('application-source-comparison.json', {apkSourceCommit: apkSource, testedSourceCommit: contextReplayHead, changedApplicationFiles: changed});
const sourceFiles = ['.github/workflows/native-ci.yml', 'scripts/run-android-ui-tests-and-collect-screenshots.sh',
  'android/app/src/androidTest/java/be/sportgreenmoove/app/ui/ReviewTripContextFlowTest.kt',
  'android/app/src/main/java/be/sportgreenmoove/app/ui/ReviewCard.kt',
  'android/app/src/main/java/be/sportgreenmoove/app/services/FirebaseAndroidPendingReviewGateway.kt',
  'android/app/src/main/java/be/sportgreenmoove/app/ui/MessagesInboxState.kt',
  'functions/src/services/pendingReviews.ts', 'functions/src/domain/reviewTripContext.ts'];
const hashes = {};
for (const file of sourceFiles) {
  const bytes = execFileSync('git', ['show', contextReplayHead + ':' + file], {cwd: root});
  const hash = createHash('sha256').update(bytes).digest('hex'), path = resolve(root, 'docs/release/evidence/source-archive/' + hash + '.txt');
  if (existsSync(path)) assert.deepEqual(readFileSync(path), bytes); else writeFileSync(path, bytes, {flag: 'wx'});
  hashes[file] = hash;
}
save('source-sha256.json', hashes);
save('summary.json', {scope: 'physical-android-contextual-reviews-with-auth-and-process-recovery-not-release',
  checkedAt: '2026-10-29', sourceCommit: contextReplayHead, phoneCheckpoints: 8,
  gate: {ordinaryPassed: 196, ordinarySkipped: 54, replayCases: 40, primaryCopies: 17, contextualComponentCases: 3},
  realNetworkLossVerified: false, iosUiExecuted: false, installedBytesIndependentlyVerified: false,
  realPayments: false, productionWrites: false, releaseComplete: false, earlierInputRootCauseConfirmed: false, mapRequests: 0});
save('ui-review.json', {physicalPhoneUiReviewed: true, sameNamedTripsDistinguished: true, explicitLegacyDetailsObserved: true,
  driverReconnectedWithoutPrompt: true, parentReconnected: true, parentRestartedWithSession: true, parentSummaryObserved: true,
  parentSummary: {displayedMean: '4,0 / 5', count: 32, fixtureRatings: 31, phoneRatings: 1},
  finalSignOutObserved: true, remoteClipboardReplaced: true, hostClipboardRestored: true, providerUninstallObserved: true, providerIdleObserved: true,
  scope: 'manual-review-of-original-session-window-and-provider-terminal-observations-not-native-exports'});
save('artifact-sha256.json', Object.fromEntries(files.map(file => [file, createHash('sha256').update(readFileSync(resolve(base, file))).digest('hex')])));
validateContextReplayEvidence(root);
console.log('Retained eight physical-phone checkpoints, scoped process recovery, original session captures and the matching enabled native gate.');
