import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';
import { assertRetainedSourceFiles } from './retained-source-evidence.mjs';
import { validateTeamAccessNativeDevice, teamAccessNativeScope } from './team-access-native-evidence.mjs';

export function validateRetainedTeamAccessNative(root, source, readFile = readFileSync) {
  const base = dirname(resolve(root, source)), read = file => readFile(resolve(base, file));
  const json = file => JSON.parse(read(file)), sha = bytes => createHash('sha256').update(bytes).digest('hex');
  const run = json(basename(source)), device = json('team-access-device.json');
  const job = json('job.json'), artifact = json('artifact.json');
  assert.equal(run.scope, teamAccessNativeScope); assert.equal(run.runId, '857de9073125bba2aaec574d42239d45');
  assert.equal(job.id, 119289342397); assert.equal(job.run_id, 39619641915);
  assert.equal(job.name, 'Android focused safety UI tests / Isolated team-access');
  assert.equal(job.status, 'completed'); assert.equal(job.conclusion, 'success');
  assert.equal(artifact.id, 12355190692); assert.equal(artifact.workflow_run.id, job.run_id);
  assert.equal(artifact.workflow_run.head_sha, 'c48026ee99f162ef58d14cdd17c33a5819e18d59');
  assert.equal(artifact.name, 'android-focused-safety-ui-team-access');
  assert.equal(artifact.size_in_bytes, read('original-artifact.zip').length);
  assert.equal(artifact.digest, 'sha256:' + sha(read('original-artifact.zip')));
  validateTeamAccessNativeDevice(device, json('adb-pull-team-access.json'), run.runId, read);
  for (const key of ['scope', 'projectId', 'runId', 'checks', 'screenshots', 'events', 'messages']) assert.deepEqual(run[key], device[key], key);
  assert.equal(run.nativeUiExecuted, true); assert.equal(run.nativeCaseCount, 1); assert.equal(run.testCount, 1);
  assert.deepEqual(run.steps, [{ id: 'team-access-connected-native-ui', status: 'passed' }]);
  const transcript = read('LocalTeamAccessFlowTest-instrumentation.txt');
  assert.match(transcript.toString(), /OK \(1 test\)/); assert.equal(run.transcriptSha256, sha(transcript));
  assert.equal(run.primaryEvidencePhase, 'team-access'); assert.equal(run.guardianRenewalThroughSdkNotUi, true);
  for (const key of ['productionWrites', 'physicalDevice', 'notificationsVerified', 'fullProcessRestartProven',
    'externalSdkTrafficVerified']) assert.equal(run[key], false, key);
  assert.deepEqual(run.fixtureIsolation, { protectedBaselinePreserved: true, originalClaimsUnchanged: true,
    expectedProfileTimestampUpdatesOnly: true, protectedRecordCount: 158, committedMessages: 7, messageOperations: 7,
    originalTeamMessages: 4, otherTeamMessages: 3, originalGuardianRenewed: true, secondGuardianRevoked: true,
    approvalsPersisted: true, parentHistoryBoundariesVerified: true, otherVerifiedParentRetainsAccess: true });
  assert.equal(run.cleanupMode, 'destroy-owned-local-environment');
  for (const key of ['adminClientClosed', 'localPackagesRemoved', 'isolatedEnvironmentDestroyed',
    'emulatorCliExitedSuccessfully']) assert.equal(run[key], true, key);
  assert.deepEqual(run.emulatorEndpoints, { host: '127.0.0.1', ports: [9099, 8080, 9000, 5001], closed: true });
  const setup = json('disposable-device-setup.json'), restore = json('disposable-device-restore.json');
  assert.equal(setup.case, 'team-access'); assert.equal(restore.case, setup.case);
  assert.equal(run.apkPreparation.receiptSha256, sha(read('disposable-device-setup.json')));
  assert.equal(run.apkPreparation.installationsRemainedBlocked, true); assert.deepEqual(run.apkPreparation.apkHashes, setup.apkHashes);
  assert.equal(restore.restored, true); assert.equal(restore.verified, true); assert.equal(restore.observed.continuousGuardVerified, true);
  for (const key of ['localPackagesRemoved', 'background', 'stopped', 'launcher']) assert.equal(restore.restoration[key], true);
  for (const key of ['authorizationRemoved', 'componentRemoved', 'originalPolicyRestored']) assert.equal(restore.restoration.installAdmin[key], true);
  assert.equal(json('team-access-suite-status.json').status, 0); assertRetainedSourceFiles(root, run.sourceFiles);
  const review = json('visual-review.json');
  assert.deepEqual(review.published, Object.fromEntries(['initial', 'remaining', 'revoked', 'renewed', 'other', 'isolated'].map(id =>
    ['team-access-verified-' + id, 'team-access-' + id + '-window.png'])));
  assert.equal(review.mediaEdits, false); assert.equal(review.rootCapturesPublished, false);
  for (const [file, expected] of Object.entries(json('artifact-sha256.json'))) {
    assert.equal(basename(file), file); assert.equal(sha(read(file)), expected, file);
  }
  return { ...run, publishedCaptures: review.published };
}
