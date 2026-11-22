import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';
import { XMLParser } from 'fast-xml-parser';
import { assertRetainedSourceFiles } from './retained-source-evidence.mjs';
import { assertInstrumentationPassed } from './android-instrumentation-result.mjs';

export const teamReadCaptures = ['count-narrow', 'visible', 'error', 'retry', 'revoked'].map(id => 'team-read-' + id);
export function validateRetainedTeamReadComponents(root, source, readFile = readFileSync) {
  const base = dirname(resolve(root, source)), read = file => readFile(resolve(base, file));
  const json = file => JSON.parse(read(file)), sha = bytes => createHash('sha256').update(bytes).digest('hex');
  const run = json(basename(source)), job = json('job.json'), artifact = json('artifact.json');
  assert.equal(job.id, 119479616403); assert.equal(job.run_id, 39674192251);
  assert.equal(job.name, 'Android focused safety UI tests / Isolated team-read-components');
  assert.equal(job.status, 'completed'); assert.equal(job.conclusion, 'success');
  assert.equal(artifact.id, 12380993839); assert.equal(artifact.workflow_run.id, job.run_id);
  assert.equal(artifact.workflow_run.head_sha, 'b57215a8e972c4a2c8fb86834f1dd2dde2fec893');
  assert.equal(artifact.name, 'android-focused-safety-ui-team-read-components');
  assert.equal(artifact.size_in_bytes, read('original-artifact.zip').length);
  assert.equal(artifact.digest, 'sha256:' + sha(read('original-artifact.zip')));
  assert.equal(run.projectId, 'demo-sgm-local-qa'); assert.match(run.runId, /^[a-f0-9]{32}$/);
  assert(Number.isFinite(Date.parse(run.testedAt)));
  assert.equal(run.scope, 'local-team-chat-read-components-with-fake-gateway-not-connected-or-physical');
  assert.equal(run.componentCaseCount, 3);
  assert.deepEqual(run.steps, ['team-read-count-and-visible-rows-only', 'team-read-error-and-explicit-retry-landscape',
    'team-read-authority-rejection-hides-thread'].map(id => ({ id, status: 'passed' })));
  for (const key of ['connectedBackend', 'notificationsVerified', 'physicalDevice', 'productionWrites']) assert.equal(run[key], false);
  assert.equal(run.cleanupOwner, 'focused-shell-independent-restoration-receipt-required');
  assert.equal(run.devicePolicyRestored, undefined); assert.equal(run.localPackagesRemoved, undefined);
  assertInstrumentationPassed(read('instrumentation.txt').toString(), 3);
  assert.equal(run.transcriptSha256, sha(read('instrumentation.txt')));
  const names = teamReadCaptures.flatMap(stem => [stem + '.png', stem + '-window.png']).sort();
  assert.deepEqual(Object.keys(run.screenshots).sort(), names);
  for (const [file, hash] of Object.entries(run.screenshots)) assert.equal(sha(read(file)), hash, file);
  for (const stem of teamReadCaptures) {
    const marker = json(stem + '.json'); assert.equal(marker.case, stem); assert.equal(marker.completed, true);
    assert.equal(marker.scope, 'local-team-chat-read-component-with-fake-gateway-not-connected-or-physical');
    assert.equal(marker.imageSha256, run.screenshots[stem + '.png']);
    assert.equal(marker.windowSha256, run.screenshots[stem + '-window.png']);
  }
  const copy = json('adb-pull-team-chat-components.json');
  assert.equal(copy.runId, run.runId); assert.equal(copy.completed, true); assert.equal(copy.status, 0);
  const setup = json('disposable-device-setup.json'), restored = json('disposable-device-restore.json');
  assert.equal(setup.scope, 'single-case-continuous-installation-guard-not-flow-proof');
  assert.equal(setup.case, 'team-read-components'); assert.equal(restored.case, setup.case);
  assert.equal(run.apkPreparation.receiptSha256, sha(read('disposable-device-setup.json')));
  assert.equal(run.apkPreparation.installationsRemainedBlocked, true);
  assert.deepEqual(run.apkPreparation.apkHashes, setup.apkHashes);
  assert.equal(run.apkHashes['apk/debug/app-debug.apk'], setup.apkHashes['be.sportgreenmoove.app.local']);
  assert.equal(run.apkHashes['apk/androidTest/debug/app-debug-androidTest.apk'], setup.apkHashes['be.sportgreenmoove.app.local.test']);
  assert.equal(read('disposable-device-setup.json.claimed').toString(), setup.case + '\n');
  assert.equal(restored.restored, true); assert.equal(restored.verified, true);
  assert.equal(restored.observed.continuousGuardVerified, true);
  for (const key of ['localPackagesRemoved', 'background', 'stopped', 'launcher']) assert.equal(restored.restoration[key], true);
  for (const key of ['authorizationRemoved', 'componentRemoved', 'originalPolicyRestored']) assert.equal(restored.restoration.installAdmin[key], true);
  assert.equal(json('team-read-components-suite-status.json').status, 0);
  assertRetainedSourceFiles(root, run.sourceFiles); assertRetainedSourceFiles(root, json('local-unit-source-files.json'));
  assert.match(read('local-native-build.txt').toString(), /BUILD SUCCESSFUL/);
  const parser = new XMLParser({ ignoreAttributes: false });
  for (const [name, count] of [['TeamConversationReadStateTest', 8], ['TeamConversationStateTest', 5], ['TeamConversationWireTest', 6]]) {
    const suite = parser.parse(read(name + '.xml')).testsuite; assert.equal(Number(suite['@_tests']), count);
    assert.equal(suite.testcase.length, count);
    for (const key of ['failures', 'errors', 'skipped']) assert.equal(Number(suite['@_' + key]), 0);
    for (const entry of suite.testcase) for (const key of ['failure', 'error', 'skipped']) assert(!Object.hasOwn(entry, key));
  }
  const review = json('visual-review.json'); assert.equal(review.scope, 'reviewed-local-read-components-not-connected-or-physical');
  assert.equal(review.reviewedAt, run.testedAt.slice(0, 10));
  assert.deepEqual(review.published, { 'team-read-verified-count': 'team-read-count-narrow.png',
    'team-read-verified-visible': 'team-read-visible-window.png', 'team-read-verified-error': 'team-read-error.png',
    'team-read-verified-retry': 'team-read-retry.png', 'team-read-verified-revoked': 'team-read-revoked.png' });
  assert(Object.hasOwn(review.excluded, 'team-read-visible.png'));
  for (const key of ['fullAppSystemInsetsVerified', 'connectedExchangeVerified', 'notificationsVerified', 'physicalDeviceVerified', 'videoRecorded'])
    assert.equal(review[key], false);
  for (const [file, expected] of Object.entries(json('artifact-sha256.json'))) {
    assert.equal(basename(file), file); assert.equal(sha(read(file)), expected, file);
  }
  return { ...run, publishedCaptures: review.published };
}
