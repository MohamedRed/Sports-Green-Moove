import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';
import { assertRetainedSourceFiles } from './retained-source-evidence.mjs';
import { teamChatNativeScope, validateTeamChatNativeDevice } from './team-chat-native-evidence.mjs';
import { assertInstrumentationPassed } from './android-instrumentation-result.mjs';

export function validateRetainedConnectedTeamReads(root, source, readFile = readFileSync) {
  const folder = dirname(resolve(root, source)), read = name => readFile(resolve(folder, name));
  const json = name => JSON.parse(read(name)), sha = bytes => createHash('sha256').update(bytes).digest('hex');
  const run = json(basename(source)), device = json('team-conversation-device.json');
  const job = json('job.json'), artifact = json('artifact.json');
  assert.equal(job.id, 119445167483); assert.equal(job.run_id, 39664309659);
  assert.equal(job.status, 'completed'); assert.equal(job.conclusion, 'success');
  assert.equal(job.name, 'Android focused safety UI tests / Isolated team-conversation');
  assert.equal(artifact.id, 12375354681); assert.equal(artifact.workflow_run.id, job.run_id);
  assert.equal(artifact.workflow_run.head_sha, '6b1aa3af75b5757f567cf2eb793e75c09b55ef70');
  assert.equal(artifact.name, 'android-focused-safety-ui-team-conversation');
  assert.equal(artifact.size_in_bytes, read('original-artifact.zip').length);
  assert.equal(artifact.digest, 'sha256:' + sha(read('original-artifact.zip')));
  assert.equal(run.scope, teamChatNativeScope); assert.equal(run.runId, '9538980d87a8b8c6649cd9c0a4821a80');
  assert(Number.isFinite(Date.parse(run.testedAt)));
  validateTeamChatNativeDevice(device, json('adb-pull-team-conversation.json'), run.runId, read);
  for (const key of ['scope', 'projectId', 'runId', 'checks', 'screenshots', 'peerMessageId', 'parentMessageId', 'guardianRevokeRequestId'])
    assert.deepEqual(run[key], device[key]);
  for (const key of ['nativeUiExecuted', 'unreadStateVerified', 'adminClientClosed', 'localPackagesRemoved',
    'isolatedEnvironmentDestroyed', 'emulatorCliExitedSuccessfully']) assert.equal(run[key], true, key);
  for (const key of ['physicalDevice', 'productionWrites', 'notificationsVerified', 'fullProcessRestartProven',
    'externalSdkTrafficVerified']) assert.equal(run[key], false, key);
  assert.equal(run.nativeCaseCount, 1); assert.equal(run.testCount, 1);
  assert.deepEqual(run.steps, [{ id: 'team-conversation-connected-native-ui', status: 'passed' }]);
  const transcript = read('LocalTeamConversationFlowTest-instrumentation.txt');
  assertInstrumentationPassed(transcript.toString(), 1); assert.equal(sha(transcript), run.transcriptSha256);
  assert.equal(run.primaryEvidencePhase, 'team-conversation'); assert.equal(run.cleanupMode, 'destroy-owned-local-environment');
  assert.deepEqual(run.fixtureIsolation, { protectedBaselinePreserved: true, originalClaimsUnchanged: true,
    expectedProfileTimestampUpdatesOnly: true, protectedRecordCount: 158, committedMessages: 5, messageOperations: 5,
    noDraftPersisted: true, parentRevocationPersisted: true, otherVerifiedParentRetainsAccess: true, driverAndChildEnrollmentUnchanged: true });
  assert.deepEqual(run.emulatorEndpoints, { host: '127.0.0.1', ports: [9099, 8080, 9000, 5001], closed: true });
  const setup = json('disposable-device-setup.json'), restored = json('disposable-device-restore.json');
  assert.equal(setup.scope, 'single-case-continuous-installation-guard-not-flow-proof');
  assert.equal(setup.case, 'team-conversation'); assert.equal(restored.case, setup.case);
  assert.equal(run.apkPreparation.receiptSha256, sha(read('disposable-device-setup.json')));
  assert.equal(run.apkPreparation.installationsRemainedBlocked, true);
  assert.deepEqual(run.apkPreparation.apkHashes, setup.apkHashes);
  assert.equal(read('disposable-device-setup.json.claimed').toString(), 'team-conversation\n');
  assert.equal(restored.restored, true); assert.equal(restored.verified, true);
  assert.equal(restored.observed.continuousGuardVerified, true);
  for (const key of ['localPackagesRemoved', 'background', 'stopped', 'launcher']) assert.equal(restored.restoration[key], true);
  for (const key of ['authorizationRemoved', 'componentRemoved', 'originalPolicyRestored']) assert.equal(restored.restoration.installAdmin[key], true);
  assert.equal(json('team-conversation-suite-status.json').status, 0);
  assertRetainedSourceFiles(root, run.sourceFiles);
  const manifest = json('artifact-sha256.json');
  for (const required of ['team-conversation-results.json', 'job.json', 'artifact.json', 'original-artifact.zip',
    'disposable-device-restore.json', 'LocalTeamConversationFlowTest-instrumentation.txt']) assert(Object.hasOwn(manifest, required));
  for (const [file, hash] of Object.entries(manifest)) {
    assert.equal(basename(file), file); assert.equal(sha(read(file)), hash, file);
  }
  return run;
}
