import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { assertRetainedSourceFiles } from './retained-source-evidence.mjs';

export function validateTeamAccessAttemptRecord(run) {
  assert.equal(run.scope, 'local-native-team-access-partial-before-parent-reply-not-completed-case');
  assert.equal(run.projectId, 'demo-sgm-local-qa'); assert.equal(run.runId, 'ca601e46acc007f8290fa61a6624fdb1');
  for (const key of ['nativeCaseCompleted', 'allElevenCheckpointsAccepted', 'independentStoredStateVerified',
    'otherTeamParentReplyVerified', 'returnToOriginalTeamVerified', 'sendFailureCauseVerified',
    'productionWrites', 'physicalDevice', 'notificationsVerified', 'fullProcessRestartProven']) assert.equal(run[key], false, key);
  assert.equal(run.sourceCommit, 'd032cca83cf04ca4af3c1a2291f7942725e47e93');
  assert.equal(run.workflowRunId, 39616349845); assert.equal(run.jobId, 119278331944);
  assert.equal(run.observedCallableSendInvocations, 6);
  assert.deepEqual(run.publishedCaptures, Object.fromEntries(['initial', 'remaining', 'revoked', 'renewed'].map(id =>
    ['team-access-attempt-' + id, 'team-access-' + id + '-window.png'])));
  return run;
}
export function validateRetainedTeamAccessAttempt(root, source) {
  const base = dirname(resolve(root, source)), read = file => readFileSync(resolve(base, file));
  const json = file => JSON.parse(read(file)), sha = bytes => createHash('sha256').update(bytes).digest('hex');
  const run = validateTeamAccessAttemptRecord(json(basename(source))), job = json('job.json'), artifact = json('artifact.json');
  assert.equal(job.id, run.jobId); assert.equal(job.run_id, run.workflowRunId); assert.equal(job.status, 'completed');
  assert.equal(job.conclusion, 'failure'); assert.equal(job.completed_at, run.testedAt);
  assert.equal(job.name, 'Android focused safety UI tests / Isolated team-access');
  assert.equal(artifact.id, 12352883191); assert.equal(artifact.workflow_run.id, run.workflowRunId);
  assert.equal(artifact.workflow_run.head_sha, run.sourceCommit); assert.equal(artifact.size_in_bytes, read('original-artifact.zip').length);
  assert.equal(artifact.digest, 'sha256:' + sha(read('original-artifact.zip')));
  const transcript = read('LocalTeamAccessFlowTest-instrumentation.txt').toString();
  for (const pattern of [/Tests run: 1,\s+Failures: 1/, /LocalTeamChatUi\.send\(LocalTeamChatUi\.kt:51\)/,
    /LocalTeamAccessFlowTest\.kt:72/, /Condition still not satisfied after 60000 ms/]) assert.match(transcript, pattern);
  const log = gunzipSync(read('job-log.txt.gz')).toString();
  assert.equal([...log.matchAll(/Beginning execution of "us-central1-sendTeamChatMessage"/g)].length, 6);
  const receipt = json('adb-pull-failure-cleanup.json'); assert.equal(receipt.completed, true); assert.equal(receipt.runId, run.runId);
  const restore = json('disposable-device-restore.json'); assert.equal(restore.restored, true); assert.equal(restore.verified, true);
  assert.equal(restore.case, 'team-access'); assert.equal(restore.observed.continuousGuardVerified, true);
  assert.equal(restore.restoration.localPackagesRemoved, true);
  for (const key of ['authorizationRemoved', 'componentRemoved', 'originalPolicyRestored']) assert.equal(restore.restoration.installAdmin[key], true);
  assert.equal(json('team-access-suite-status.json').status, 1); assertRetainedSourceFiles(root, json('source-files.json'));
  for (const [file, expected] of Object.entries(json('artifact-sha256.json'))) {
    assert.equal(basename(file), file); assert.equal(sha(read(file)), expected, file);
  }
  return run;
}
