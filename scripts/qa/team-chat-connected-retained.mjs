import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';
import { assertRetainedSourceFiles } from './retained-source-evidence.mjs';
import { teamChatNativeScope, validateTeamChatNativeDevice } from './team-chat-native-evidence.mjs';

export function validateRetainedTeamChatConnected(root, source, readFile = readFileSync) {
  const base = dirname(resolve(root, source)), read = file => readFile(resolve(base, file));
  const json = file => JSON.parse(read(file)), sha = bytes => createHash('sha256').update(bytes).digest('hex');
  const run = json(basename(source)), device = json('team-conversation-device.json');
  const job = json('job.json'), artifact = json('artifact.json');
  assert.equal(run.scope, teamChatNativeScope); assert.equal(run.runId, 'f392e21fd02d7b2c372fcfcf9ad75a58');
  assert.equal(job.id, 119247901177); assert.equal(job.run_id, 39607645432);
  assert.equal(job.name, 'Android focused safety UI tests / Isolated team-conversation');
  assert.equal(job.status, 'completed'); assert.equal(job.conclusion, 'success');
  assert.equal(artifact.id, 12348768201); assert.equal(artifact.workflow_run.id, job.run_id);
  assert.equal(artifact.workflow_run.head_sha, 'b68538d3ee789ddff0944612931e1abb16d861c7');
  assert.equal(artifact.name, 'android-focused-safety-ui-team-conversation');
  assert.equal(artifact.size_in_bytes, read('original-artifact.zip').length);
  assert.equal(artifact.digest, 'sha256:' + sha(read('original-artifact.zip')));
  validateTeamChatNativeDevice(device, json('adb-pull-team-conversation.json'), run.runId, read);
  for (const key of ['scope', 'projectId', 'runId', 'checks', 'screenshots', 'peerMessageId', 'parentMessageId', 'guardianRevokeRequestId']) {
    assert.deepEqual(run[key], device[key], key);
  }
  assert.equal(run.nativeUiExecuted, true); assert.equal(run.nativeCaseCount, 1); assert.equal(run.testCount, 1);
  assert.deepEqual(run.steps, [{ id: 'team-conversation-connected-native-ui', status: 'passed' }]);
  const transcript = read('LocalTeamConversationFlowTest-instrumentation.txt');
  assert.match(transcript.toString(), /OK \(1 test\)/); assert.equal(run.transcriptSha256, sha(transcript));
  assert.equal(run.primaryEvidencePhase, 'team-conversation');
  for (const key of ['productionWrites', 'physicalDevice', 'notificationsVerified', 'fullProcessRestartProven',
    'externalSdkTrafficVerified']) assert.equal(run[key], false, key);
  assert.deepEqual(run.fixtureIsolation, { protectedBaselinePreserved: true, originalClaimsUnchanged: true,
    expectedProfileTimestampUpdatesOnly: true, protectedRecordCount: 158, committedMessages: 5,
    messageOperations: 5, noDraftPersisted: true, parentRevocationPersisted: true,
    otherVerifiedParentRetainsAccess: true, driverAndChildEnrollmentUnchanged: true });
  assert.equal(run.cleanupMode, 'destroy-owned-local-environment');
  for (const key of ['adminClientClosed', 'localPackagesRemoved', 'isolatedEnvironmentDestroyed',
    'emulatorCliExitedSuccessfully']) assert.equal(run[key], true, key);
  assert.deepEqual(run.emulatorEndpoints, { host: '127.0.0.1', ports: [9099, 8080, 9000, 5001], closed: true });
  const setup = json('disposable-device-setup.json'), restore = json('disposable-device-restore.json');
  assert.equal(setup.case, 'team-conversation'); assert.equal(restore.case, setup.case);
  assert.equal(run.apkPreparation.receiptSha256, sha(read('disposable-device-setup.json')));
  assert.equal(run.apkPreparation.installationsRemainedBlocked, true);
  assert.deepEqual(run.apkPreparation.apkHashes, setup.apkHashes);
  assert.equal(restore.restored, true); assert.equal(restore.verified, true);
  assert.equal(restore.observed.continuousGuardVerified, true);
  for (const key of ['localPackagesRemoved', 'background', 'stopped', 'launcher']) assert.equal(restore.restoration[key], true);
  for (const key of ['authorizationRemoved', 'componentRemoved', 'originalPolicyRestored']) assert.equal(restore.restoration.installAdmin[key], true);
  assert.equal(json('team-conversation-suite-status.json').status, 0);
  assertRetainedSourceFiles(root, run.sourceFiles);
  const review = json('visual-review.json');
  assert.deepEqual(review.published, Object.fromEntries(['parent', 'exchange', 'revoked', 'driver'].map(id =>
    ['team-chat-connected-' + id, 'team-chat-native-' + id + '-window.png'])));
  assert.equal(review.draftWindowPublished, false);
  for (const file of Object.values(review.published)) assert(Object.hasOwn(device.screenshots, file));
  for (const [file, expected] of Object.entries(json('artifact-sha256.json'))) {
    assert.equal(basename(file), file); assert.equal(sha(read(file)), expected, file);
  }
  return { ...run, publishedCaptures: review.published };
}
