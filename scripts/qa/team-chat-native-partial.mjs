import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';
import { assertRetainedSourceFiles } from './retained-source-evidence.mjs';

export const teamChatPartialScope = 'partial-native-team-exchange-sdk-peer-lifecycle-not-completed-case';
export function validateTeamChatNativePartial(root, source) {
  const base = dirname(resolve(root, source)), read = file => readFileSync(resolve(base, file));
  const json = file => JSON.parse(read(file)), sha = bytes => createHash('sha256').update(bytes).digest('hex');
  const run = json(basename(source)), job = json('job.json'), artifact = json('artifact.json');
  assert.equal(run.scope, teamChatPartialScope); assert.equal(run.projectId, 'demo-sgm-local-qa');
  assert.equal(run.runId, '555ad893e32ad907933b6fa09a0eb479');
  assert.equal(run.sourceCommit, '6a99378adb804c4226e9b4e6de8e033f8a280888');
  assert.equal(run.workflowRunId, 39604033406); assert.equal(run.jobId, 119235529032);
  for (const key of ['nativeCaseCompleted', 'nineCheckpointsAccepted', 'independentStoredStateVerified',
    'physicalDevice', 'productionWrites', 'notificationsVerified', 'fullProcessRestartProven']) assert.equal(run[key], false, key);
  assert.equal(run.sdkExchangeObserved, true); assert.deepEqual(run.observedCaptures, ['parent', 'exchange', 'draft']);
  assert.deepEqual(run.publishedCaptures, { 'team-chat-native-parent': 'team-chat-native-parent-window.png',
    'team-chat-native-exchange': 'team-chat-native-exchange-window.png' });
  assert.equal(job.id, run.jobId); assert.equal(job.run_id, run.workflowRunId); assert.equal(job.status, 'completed');
  assert.equal(job.conclusion, 'failure'); assert.equal(job.completed_at, run.testedAt);
  assert.equal(job.name, 'Android focused safety UI tests / Isolated team-conversation');
  assert.equal(artifact.id, 12347423617); assert.equal(artifact.workflow_run.id, run.workflowRunId);
  assert.equal(artifact.workflow_run.head_sha, run.sourceCommit); assert.equal(artifact.size_in_bytes, read('original-artifact.zip').length);
  assert.equal(artifact.digest, 'sha256:' + sha(read('original-artifact.zip')));
  const transcript = read('LocalTeamConversationFlowTest-instrumentation.txt').toString();
  assert.match(transcript, /Tests run: 1,\s+Failures: 1/); assert.match(transcript, /FirebaseApp was deleted/);
  assert.match(transcript, /LocalTeamChatPeer\.kt:52/); assert.match(transcript, /LocalTeamConversationFlowTest\.kt:50/);
  const copy = json('adb-pull-failure-cleanup.json'); assert.equal(copy.completed, true); assert.equal(copy.runId, run.runId);
  const restore = json('disposable-device-restore.json'); assert.equal(restore.verified, true); assert.equal(restore.restored, true);
  assert.equal(restore.observed.continuousGuardVerified, true); assert.equal(restore.restoration.localPackagesRemoved, true);
  for (const key of ['authorizationRemoved', 'componentRemoved', 'originalPolicyRestored']) assert.equal(restore.restoration.installAdmin[key], true);
  assert.equal(json('team-conversation-suite-status.json').status, 1); assertRetainedSourceFiles(root, run.sourceFiles);
  const caseSource = readFileSync(resolve(root, 'docs/release/evidence/source-archive', run.sourceFiles[
    'android/app/src/androidTest/java/be/sportgreenmoove/app/ui/LocalTeamConversationFlowTest.kt'] + '.txt'), 'utf8');
  assert(caseSource.indexOf('driver.observeParentMessage') < caseSource.indexOf('capture("team-chat-native-exchange")'));
  assert(caseSource.indexOf('capture("team-chat-native-draft")') < caseSource.indexOf('LocalTeamChatPeer.open(context, session, "manager")'));
  for (const [file, expected] of Object.entries(json('artifact-sha256.json'))) {
    assert.equal(basename(file), file); assert.equal(sha(read(file)), expected, file);
  }
  return run;
}
