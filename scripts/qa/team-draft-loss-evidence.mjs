import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { dirname, resolve } from 'node:path';
import { assertRetainedSourceFiles } from './retained-source-evidence.mjs';
import { validateTeamDraftBefore } from './team-draft-restart-evidence.mjs';

export function validateTeamDraftLoss(root, source, readFile = readFileSync) {
  const folder = dirname(resolve(root, source)), read = file => readFile(resolve(folder, file));
  const json = file => JSON.parse(read(file)), sha = bytes => createHash('sha256').update(bytes).digest('hex');
  const run = JSON.parse(readFile(resolve(root, source))), job = json('job.json'), artifact = json('artifact.json');
  assert.equal(run.scope, 'verified-local-team-draft-loss-after-process-stop-not-completed-flow');
  assert.equal(run.runId, '4e2b123d20c3be7dbfe9c8a5cdc78ada'); assert.equal(run.projectId, 'demo-sgm-local-qa');
  assert.equal(run.sourceCommit, 'b92ba8682be612ba2fd4666f80a47df50d629971');
  assert.equal(job.id, 119330428472); assert.equal(run.jobId, job.id); assert.equal(job.run_id, 39631451016);
  assert.equal(run.workflowRunId, job.run_id); assert.equal(job.status, 'completed'); assert.equal(job.conclusion, 'failure');
  assert.equal(job.completed_at, run.testedAt); assert.equal(artifact.id, 12360112244); assert.equal(run.artifactId, artifact.id);
  assert.equal(artifact.workflow_run.head_sha, run.sourceCommit); assert.equal(artifact.workflow_run.id, job.run_id);
  assert.equal(artifact.digest, 'sha256:' + sha(read('original-artifact.zip'))); assert.equal(artifact.size_in_bytes, read('original-artifact.zip').length);
  for (const key of ['draftLossObserved', 'firstProcessRestartObserved', 'firstStagePassed']) assert.equal(run[key], true);
  for (const key of ['draftRestored', 'parentSendReached', 'thirdProcessReached', 'fullFlowVerified',
    'postFailureStoredStateVerified', 'physicalDevice', 'productionDataTouched']) assert.equal(run[key], false);
  assert.match(read('LocalTeamDraftRestartTest#preparePrivateTeamDraft-instrumentation.txt').toString(), /OK \(1 test\)/);
  assert.match(read('LocalTeamDraftRestartTest#recoverAndSendPrivateDraftInNewProcess-instrumentation.txt').toString(),
    /expected:<\[Brouillon équipe après fermeture QA\]> but was:<\[\]>/);
  const before = json('local-team-draft-before.json'); validateTeamDraftBefore(before, run.runId);
  const stop = json('local-team-draft-stop.json'); assert.equal(stop.runId, run.runId); assert.equal(stop.preparedProcessId, before.processId);
  assert.equal(stop.forceStopIssued, true); assert.equal(stop.noProcessAfterStop, true); assert.equal(stop.appId, 'be.sportgreenmoove.app.local');
  const unsent = json('team-draft-unsent-checkpoint.json'); assert.equal(unsent.unsentDraftNotSubmitted, true);
  assert.equal(unsent.messageCount, 2); assert.equal(unsent.messageOperationCount, 2); assert.equal(unsent.protectedRecordCount, 158);
  const restore = json('disposable-device-restore.json'); assert.equal(restore.restored, true); assert.equal(restore.verified, true);
  assert.equal(restore.restoration.localPackagesRemoved, true);
  for (const key of ['authorizationRemoved', 'componentRemoved', 'originalPolicyRestored']) assert.equal(restore.restoration.installAdmin[key], true);
  assert.deepEqual(run.publishedCaptures, { 'team-draft-loss-before': 'team-draft-before-window.png',
    'team-draft-loss-reopened': 'team-draft-reopened-window.png' });
  assert.notEqual(sha(read(run.publishedCaptures['team-draft-loss-before'])), sha(read(run.publishedCaptures['team-draft-loss-reopened'])));
  assert.match(gunzipSync(read('job-log.txt.gz')).toString(), /ComparisonFailure/);
  assertRetainedSourceFiles(root, json('source-files.json'));
  for (const [file, hash] of Object.entries(json('artifact-sha256.json'))) {
    assert(!file.startsWith('/') && !file.split('/').includes('..')); assert.equal(sha(read(file)), hash, file);
  }
  return run;
}
