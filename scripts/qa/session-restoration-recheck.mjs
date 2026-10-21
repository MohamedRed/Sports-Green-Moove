import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';
import { assertRetainedSourceFiles } from './retained-source-evidence.mjs';

export function validateSessionRestorationRecheck(root, source) {
  const folder = dirname(resolve(root, source)), read = file => readFileSync(resolve(folder, file));
  const json = file => JSON.parse(read(file)), sha = bytes => createHash('sha256').update(bytes).digest('hex');
  const run = json(basename(source)), job = json('job.json'), artifact = json('artifact.json');
  assert.equal(run.scope, 'local-session-restoration-auth-transport-failure-before-app-ui');
  assert.equal(run.projectId, 'demo-sgm-local-qa'); assert.equal(run.runId, '8b015cafdf27f4e70709ed860b1a85b2');
  for (const key of ['caseCompleted', 'appUiReached', 'restorationVerified', 'physicalDevice', 'realNetworkLossVerified',
    'providerOrApplicationRootCauseVerified']) assert.equal(run[key], false, key);
  assert.deepEqual(run.newScreenshotsAccepted, []);
  assert.equal(job.id, 119289342028); assert.equal(job.id, run.jobId); assert.equal(job.run_id, run.workflowRunId);
  assert.equal(job.run_id, 39619641915); assert.equal(job.status, 'completed'); assert.equal(job.conclusion, 'failure');
  assert.equal(job.completed_at, run.testedAt);
  assert.equal(artifact.id, 12354074731); assert.equal(artifact.workflow_run.id, run.workflowRunId);
  assert.equal(artifact.workflow_run.head_sha, 'c48026ee99f162ef58d14cdd17c33a5819e18d59');
  assert.equal(run.sourceCommit, artifact.workflow_run.head_sha);
  assert.equal(artifact.size_in_bytes, read('original-artifact.zip').length);
  assert.equal(artifact.digest, 'sha256:' + sha(read('original-artifact.zip')));
  const transcript = read('LocalSessionRestorationTest-instrumentation.txt').toString();
  assert.match(transcript, /Failed to connect to \/10\.0\.2\.2:9099/); assert.match(transcript, /Tests run: 1,\s+Failures: 1/);
  const proxy = json('session-restoration-proxy-failed.json'); assert.equal(proxy.runId, run.runId);
  assert.deepEqual(proxy.attempts, []); assert.deepEqual(proxy.transitions, []); assert.equal(proxy.phase, 'reject');
  const restore = json('disposable-device-restore.json'); assert.equal(restore.restored, true); assert.equal(restore.verified, true);
  assert.equal(restore.restoration.localPackagesRemoved, true);
  for (const key of ['authorizationRemoved', 'componentRemoved', 'originalPolicyRestored']) assert.equal(restore.restoration.installAdmin[key], true);
  assertRetainedSourceFiles(root, json('source-files.json'));
  for (const [file, hash] of Object.entries(json('artifact-sha256.json'))) {
    assert.equal(basename(file), file); assert.equal(sha(read(file)), hash, file);
  }
  return run;
}
