import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync, readdirSync} from 'node:fs';
import {resolve} from 'node:path';
import YAML from 'yaml';
import {assertEvidenceBundleChecksums} from './evidence-bundle-checksums.mjs';
import {parseAndroidJUnitTranscript} from './android-junit-transcript.mjs';
import {assertInstrumentationPassed} from './android-instrumentation-result.mjs';

export const nativeBudgetExecutionFolder = 'docs/release/evidence/native-transfer-91c4a09-2026-10-30/';
export const nativeBudgetExecutionHead = '91c4a09fa70a7d4e0d2537f46000767275ca83ba';
export function validateNativeBudgetExecution(root) {
  const base = resolve(root, nativeBudgetExecutionFolder), bytes = file => readFileSync(resolve(base, file));
  const json = file => JSON.parse(bytes(file)); assertEvidenceBundleChecksums(base);
  const run = json('native-run.json'), checks = json('pr-checks.json'), artifact = json('artifact.json');
  assert.equal(run.databaseId, 41106555169); assert.equal(run.headSha, nativeBudgetExecutionHead);
  assert.equal(run.status, 'completed'); assert.equal(run.conclusion, 'failure');
  const main = run.jobs.find(row => row.databaseId === 124237793442);
  assert.equal(main.name, 'Android native UI tests'); assert.equal(main.conclusion, 'failure');
  assert.equal((Date.parse(main.completedAt) - Date.parse(main.startedAt)) / 1000, 1237);
  assert.equal(YAML.parse(bytes('source-native-ci.yml.txt').toString()).jobs['android-native-ui']['timeout-minutes'], 50);
  const sha = value => createHash('sha256').update(value).digest('hex');
  assert.equal(sha(bytes('source-native-ci.yml.txt')), 'c0584eec7d5ca50041f775296f6c71ea5068b2b464895d0cc862287edc28aa30');
  const focused = run.jobs.filter(row => row.name.startsWith('Android focused safety UI tests / Isolated ') && !row.name.endsWith('safety flows'));
  assert.equal(focused.length, 11); assert(focused.every(row => row.status === 'completed' && row.conclusion === 'success'));
  assert.equal(checks.headRefOid, nativeBudgetExecutionHead);
  assert(checks.statusCheckRollup.length >= 22);
  assert(checks.statusCheckRollup.every(row => row.status === 'COMPLETED'));
  const failed = checks.statusCheckRollup.filter(row => row.conclusion === 'FAILURE');
  assert.deepEqual(failed.map(row => row.name), ['Android native UI tests']);
  assert(checks.statusCheckRollup.every(row => ['SUCCESS', 'SKIPPED', 'FAILURE'].includes(row.conclusion)));
  for (const name of ['Functions and Firebase rules', 'Functions, admin, and website checks', 'People and safety service smoke',
    'Store readiness static checks', 'Production provider secret validation'])
    assert.equal(checks.statusCheckRollup.find(row => row.name === name)?.conclusion, 'SUCCESS', name);
  assert.equal(artifact.id, 13001604158); assert.equal(artifact.workflow_run.id, run.databaseId);
  assert.equal(artifact.workflow_run.head_sha, run.headSha);
  assert.equal(artifact.digest, 'sha256:6206ddbdbf67fffdde77de57e64ccce95e73636f3d79f07860b331e67f930c35');
  const parsed = parseAndroidJUnitTranscript(bytes('ordinary-instrumentation.txt').toString());
  for (const [key, value] of Object.entries(parsed)) assert.deepEqual(json('ordinary-results.json')[key], value);
  assert.deepEqual([parsed.passed, parsed.skipped, parsed.failed], [205, 54, 0]);
  assert.equal(json('ordinary-process.json').status, 0);
  assert.deepEqual(json('native-suite-status.json'), {scope: 'native-suite-exit-status-not-flow-verification', ordinaryTests: 0, componentEvidence: 0, localReplay: 1});
  const inventory = json('artifact-inventory.json'); assert(inventory.length > 0);
  assert(!inventory.some(row => row.path.endsWith('/results.json')));
  for (const row of inventory) assert.match(row.sha256, /^[a-f0-9]{64}$/);
  const sameOriginal = (file, path) => assert.equal(sha(bytes(file)), inventory.find(row => row.path === path)?.sha256, file);
  for (const file of ['ordinary-instrumentation.txt', 'ordinary-results.json', 'ordinary-process.json', 'native-suite-status.json'])
    sameOriginal(file, 'outputs/store-review-screenshots/' + file);
  sameOriginal('device-restore.json', 'outputs/store-review-screenshots/disposable-store-restore.json');
  const replayFiles = readdirSync(resolve(base, 'replay'));
  const transcripts = replayFiles.filter(file => file.endsWith('-instrumentation.txt')); assert.equal(transcripts.length, 21);
  let cases = 0;
  for (const file of transcripts) {
    const count = file.startsWith('LocalAppFlowTest-') ? 9 : 1;
    assertInstrumentationPassed(bytes('replay/' + file).toString(), count); cases += count;
  }
  assert.equal(cases, 29);
  const runId = '4d6379013b702177a5eec8c1e82d6024';
  for (const file of replayFiles) sameOriginal('replay/' + file, 'outputs/local-ui-evidence/' + runId + '/' + file);
  const copies = replayFiles.filter(file => /^adb-pull-/.test(file) && !file.includes('failure-cleanup'));
  assert.equal(copies.length, 11);
  for (const file of copies) {
    const copy = json('replay/' + file); assert.equal(copy.runId, runId);
    assert.equal(copy.completed, file !== 'adb-pull-trip-consent-restart.json');
    assert.equal(copy.status, copy.completed ? 0 : 1); assert.equal(copy.signal, null); assert.equal(copy.errorCode, null);
  }
  const copy = json('replay/adb-pull-trip-consent-restart.json');
  const before = copy.hostBefore, after = copy.hostAfter;
  assert.equal(before.completed, true); assert.equal(after.completed, true);
  assert.deepEqual(before.adbProcesses, after.adbProcesses); assert.equal(before.adbProcesses.length, 1);
  assert.equal(before.daemonEvents.matchedEventCount, 1); assert.equal(after.daemonEvents.matchedEventCount, 2);
  assert.equal(after.daemonEvents.events.at(-1).kind, 'connection-terminated-read-failed');
  const diagnostics = json('replay/adb-sync-trip-consent-restart-diagnostics.json');
  assert.equal(diagnostics.runId, runId);
  for (const id of ['directory-stat', 'shell-listing', 'sync-listing']) {
    const row = diagnostics.observations.find(row => row.id === id); assert.equal(row.collected, false);
    assert.match(row.stderr, /device offline/);
  }
  assert.match(diagnostics.observations.find(row => row.id === 'storage-service-log').value, /connection terminated: write failed/);
  const cleanupCopy = json('replay/adb-pull-failure-cleanup.json');
  assert.equal(cleanupCopy.runId, runId); assert.equal(cleanupCopy.completed, true); assert.equal(cleanupCopy.phase, 'failure-cleanup');
  const restored = json('device-restore.json'); assert.equal(restored.restored, true); assert.equal(restored.verified, true);
  for (const key of ['localPackagesRemoved', 'background', 'stopped', 'launcher']) assert.equal(restored.restoration[key], true);
  for (const key of ['authorizationRemoved', 'componentRemoved', 'originalPolicyRestored']) assert.equal(restored.restoration.installAdmin[key], true);
  const summary = json('summary.json');
  assert.equal(summary.sourceCommit, nativeBudgetExecutionHead);
  assert.equal(summary.scope, 'failed-new-budget-gate-with-primary-transfer-interruption-not-timeout-or-release-proof');
  assert.equal(summary.outerBudgetMinutes, 50); assert.equal(summary.mainJobSeconds, 1237);
  assert.equal(summary.ordinaryPassed, 205); assert.equal(summary.partialReplayCasesPassed, 29);
  assert.equal(summary.successfulPrimaryCopies, 10); assert.equal(summary.focusedJobsPassed, 11);
  assert.equal(summary.deviceRestorationVerified, true);
  for (const key of ['fullGatePassed', 'completeReplayAccepted', 'rootCauseConfirmed', 'physicalDeviceAccepted', 'releaseAccepted'])
    assert.equal(summary[key], false, key);
  assert.deepEqual(summary.publicMedia, []);
  return {ordinaryPassed: 205, ordinarySkipped: 54, partialReplayCasesPassed: 29, successfulPrimaryCopies: 10,
    focusedJobsPassed: 11, deviceRestorationVerified: true, fullGatePassed: false, rootCauseConfirmed: false, releaseAccepted: false};
}
