import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import YAML from 'yaml';
import {assertEvidenceBundleChecksums} from './evidence-bundle-checksums.mjs';
import {parseAndroidJUnitTranscript} from './android-junit-transcript.mjs';

export const nativeTimeoutFolder = 'docs/release/evidence/native-timeout-9abc639-2026-10-30/';
export function validateNativeTimeout(root) {
  const base = resolve(root, nativeTimeoutFolder), bytes = file => readFileSync(resolve(base, file));
  const json = file => JSON.parse(bytes(file)); assertEvidenceBundleChecksums(base);
  const job = json('job.json'), artifact = json('artifact.json'), summary = json('summary.json');
  assert.equal(job.id, 124201947063); assert.equal(job.run_id, 41096043272);
  assert.equal(job.head_sha, '9abc639369a9d2a40a7917a578a981c7d5953ce6');
  assert.equal(job.status, 'completed'); assert.equal(job.conclusion, 'cancelled');
  assert(json('annotations.json').some(row => row.message === 'The job has exceeded the maximum execution time of 35m0s'));
  assert.equal(artifact.id, 12998077871); assert.equal(artifact.name, 'android-connected-ui-test-results');
  assert.equal(artifact.workflow_run.id, job.run_id); assert.equal(artifact.workflow_run.head_sha, job.head_sha);
  assert.equal(artifact.digest, 'sha256:3d541f4ee24ed5c1cdf6beb3c50e6cdd859bd93ec1f63bdef276fbdaacfa4599');
  assert.equal(createHash('sha256').update(bytes('source-native-ci.yml.txt')).digest('hex'),
    '4c83059ca6fc531986809880af4f797fb28237b3a6fe36e8e7d403436294179d');
  assert.equal(YAML.parse(bytes('source-native-ci.yml.txt').toString()).jobs['android-native-ui']['timeout-minutes'], 35);
  const parsed = parseAndroidJUnitTranscript(bytes('ordinary-instrumentation.txt').toString());
  for (const [key, value] of Object.entries(parsed)) assert.deepEqual(json('ordinary-results.json')[key], value);
  assert.equal(parsed.passed, 205); assert.equal(parsed.skipped, 54); assert.equal(parsed.failed, 0);
  assert.equal(json('ordinary-process.json').status, 0);
  const inventory = json('artifact-inventory.json'); assert(inventory.length > 0);
  for (const row of inventory) assert.match(row.sha256, /^[a-f0-9]{64}$/);
  for (const suffix of ['/results.json', '/native-suite-status.json', '/disposable-store-restore.json'])
    assert(!inventory.some(row => row.path.endsWith(suffix)));
  const copies = inventory.filter(row => /\/adb-pull-[^/]+\.json$/.test(row.path)); assert.equal(copies.length, 10);
  for (const row of copies) {
    const name = row.path.split('/').at(-1), copy = json('primary/' + name);
    assert.equal(createHash('sha256').update(bytes('primary/' + name)).digest('hex'), row.sha256);
    assert.equal(copy.runId, '9671056f86ad062f23be0a328e74c05c'); assert.equal(copy.completed, true); assert.equal(copy.status, 0);
  }
  const seconds = (from, to) => (Date.parse(to) - Date.parse(from)) / 1000;
  assert.equal(seconds(job.started_at, job.completed_at), 2114);
  const start = job.steps.find(row => row.name === 'Run Android Compose UI tests').started_at;
  assert.equal(seconds(job.started_at, start), 796);
  assert.equal(summary.scope, 'outer-native-job-timeout-not-full-replay-cleanup-or-release-proof');
  assert.equal(summary.preparationSeconds, 796); assert.equal(summary.jobElapsedSeconds, 2114);
  for (const key of ['fullGatePassed', 'completeReplayVerified', 'deviceCleanupVerified', 'physicalDeviceAccepted', 'releaseAccepted'])
    assert.equal(summary[key], false, key);
  assert.deepEqual(summary.publicMedia, []);
  return {ordinaryPassed: 205, ordinarySkipped: 54, partialPrimaryCopies: 10, fullGatePassed: false, deviceCleanupVerified: false};
}

export function validateNativeBudgetFollowup(root) {
  const base = resolve(root, nativeTimeoutFolder), bytes = file => readFileSync(resolve(base, file));
  const json = file => JSON.parse(bytes(file)); assertEvidenceBundleChecksums(base);
  const ci = json('following-run.json'), checks = json('following-checks.json'), artifact = json('following-artifact.json');
  assert.equal(ci.databaseId, 41100104923); assert.equal(ci.headSha, '13767b4da15aeebc180cf5471808103c6a1f1bc6');
  assert.equal(ci.status, 'completed'); assert.equal(ci.conclusion, 'success');
  const main = ci.jobs.find(row => row.name === 'Android native UI tests'); assert.equal(main.conclusion, 'success');
  assert.equal(main.databaseId, 124215726597);
  const focused = ci.jobs.filter(row => row.name.startsWith('Android focused safety UI tests / Isolated ') && !row.name.endsWith(' / Isolated safety flows'));
  assert.equal(focused.length, 11); assert(focused.every(row => row.status === 'completed' && row.conclusion === 'success'));
  assert.equal(checks.headRefOid, ci.headSha); assert(checks.statusCheckRollup.length >= 22);
  assert(checks.statusCheckRollup.every(row => row.status === 'COMPLETED' && ['SUCCESS', 'SKIPPED'].includes(row.conclusion)));
  for (const name of ['Functions and Firebase rules', 'Functions, admin, and website checks', 'People and safety service smoke',
    'Store readiness static checks', 'Production provider secret validation', 'Android native UI tests'])
    assert.equal(checks.statusCheckRollup.find(row => row.name === name)?.conclusion, 'SUCCESS', name);
  assert.equal(artifact.id, 13001096037); assert.equal(artifact.workflow_run.id, ci.databaseId);
  assert.equal(artifact.workflow_run.head_sha, ci.headSha);
  assert.equal(artifact.digest, 'sha256:d3ef7c89055bbb036b42650ccb132b4151f14a0ce1a5dfa9158cc7a6f03804ea');
  const parsed = parseAndroidJUnitTranscript(bytes('following-main/ordinary-instrumentation.txt').toString());
  for (const [key, value] of Object.entries(parsed)) assert.deepEqual(json('following-main/ordinary-results.json')[key], value);
  assert.equal(parsed.passed, 205); assert.equal(parsed.skipped, 54); assert.equal(parsed.failed, 0);
  assert.deepEqual(json('following-main/native-suite-status.json'), {scope: 'native-suite-exit-status-not-flow-verification', ordinaryTests: 0, componentEvidence: 0, localReplay: 0});
  const replay = json('following-main/results.json'); assert.equal(replay.scope, 'local-ui-not-physical-device');
  assert.equal(replay.projectId, 'demo-sgm-local-qa'); assert.equal(replay.runId, '993615ad3b8d2ec098888743278a89fd');
  assert.equal(replay.testCount, 37); assert.equal(replay.nativeCaseCount, 40); assert.equal(replay.steps.length, 37);
  assert(replay.steps.every(row => row.status === 'passed')); assert.equal(replay.adminClientClosed, true); assert.equal(replay.firestoreClientTerminated, true);
  const setup = json('following-main/device-setup.json'), restore = json('following-main/device-restore.json');
  assert.equal(replay.matrixPreparation.receiptSha256, createHash('sha256').update(bytes('following-main/device-setup.json')).digest('hex'));
  assert.deepEqual(replay.matrixPreparation.apkHashes, setup.apkHashes); assert.equal(Object.keys(setup.apkHashes).length, 4);
  assert.equal(replay.matrixPreparation.installationsRemainedBlocked, true);
  assert.equal(restore.verified, true); assert.equal(restore.restored, true);
  for (const key of ['localPackagesRemoved', 'background', 'stopped', 'launcher']) assert.equal(restore.restoration[key], true);
  for (const key of ['authorizationRemoved', 'componentRemoved', 'originalPolicyRestored']) assert.equal(restore.restoration.installAdmin[key], true);
  const copies = Object.keys(json('artifact-sha256.json')).filter(path => path.startsWith('following-main/adb-pull-'));
  assert.equal(copies.length, 17);
  for (const file of copies) {const copy = json(file); assert.equal(copy.runId, replay.runId); assert.equal(copy.completed, true); assert.equal(copy.status, 0);}
  return {fullGatePassed: true, groups: 37, nativeCases: 40, primaryCopies: 17, newBudgetApplied: false, releaseAccepted: false};
}
