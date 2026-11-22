import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { dirname, resolve } from 'node:path';
import { assertRetainedSourceFiles } from './retained-source-evidence.mjs';

export function validateTeamDraftNativeAttempt(root, source, readFile = readFileSync) {
  const folder = dirname(resolve(root, source)), read = file => readFile(resolve(folder, file));
  const json = file => JSON.parse(read(file)), sha = bytes => createHash('sha256').update(bytes).digest('hex');
  const run = JSON.parse(readFile(resolve(root, source))), job = json('job.json'), artifact = json('artifact.json');
  assert.equal(run.scope, 'local-team-draft-two-pre-ui-failures-not-recovery-proof');
  assert.equal(run.projectId, 'demo-sgm-local-qa'); assert.equal(run.sourceCommit, '56fe90d2d056ee334376bcd6e0b4eeecd6c7f68b');
  assert.equal(run.workflowRunId, 39628682621); assert.equal(job.run_id, run.workflowRunId);
  assert.equal(job.id, 119320682123); assert.equal(run.jobId, job.id); assert.equal(job.status, 'completed');
  assert.equal(job.conclusion, 'failure'); assert.equal(job.completed_at, run.testedAt);
  assert.equal(artifact.id, 12357689226); assert.equal(run.artifactId, artifact.id);
  assert.equal(artifact.workflow_run.id, run.workflowRunId); assert.equal(artifact.workflow_run.head_sha, run.sourceCommit);
  assert.equal(artifact.digest, 'sha256:' + sha(read('original-artifact.zip'))); assert.equal(artifact.size_in_bytes, read('original-artifact.zip').length);
  for (const key of ['nativeCaseCompleted', 'draftRecoveryVerified', 'parentMessageSent', 'fullProcessRestartProven', 'physicalDevice']) assert.equal(run[key], false);
  assert.equal(run.executedUserFlowCases, 0); assert.deepEqual(run.publishedCaptures, []);
  assert.equal(run.ciRunId, 'b261f8ce96de759f1be8f618bc8cac32'); assert.equal(run.localRunId, '50c459bd13a0f468952c34be6ccd42db');
  const transcript = 'LocalTeamDraftRestartTest#preparePrivateTeamDraft-instrumentation.txt';
  assert.match(read('ci/' + transcript).toString(), /InvalidTestClassError/);
  assert.match(read('ci/' + transcript).toString(), /should be void/);
  assert.match(gunzipSync(read('job-log.txt.gz')).toString(), /Tests run: 1,\s+Failures: 1/);
  assert.match(read('local/' + transcript).toString(), /failed to attach/);
  for (const prefix of ['ci/', 'local/']) {
    const restore = json(prefix + 'disposable-device-restore.json'); assert.equal(restore.verified, true); assert.equal(restore.restored, true);
    assert.equal(restore.restoration.localPackagesRemoved, true);
    for (const key of ['authorizationRemoved', 'componentRemoved', 'originalPolicyRestored']) assert.equal(restore.restoration.installAdmin[key], true);
  }
  assert.equal(run.localRuntimeRemoved, true);
  assert.deepEqual(run.localEndpoints, { host: '127.0.0.1', ports: [9099, 8080, 9000, 5001], closed: true });
  assert.equal(run.signatureRecompiled, true); assert.equal(run.signatureCheckNotUiProof, true);
  for (const method of ['preparePrivateTeamDraft', 'recoverAndSendPrivateDraftInNewProcess', 'acknowledgedDraftStaysEmptyInThirdProcess'])
    assert(read('signature-recheck.txt').toString().includes(`public final void ${method}();`));
  assert.equal(read('signature-recheck.class').subarray(0, 4).toString('hex'), 'cafebabe');
  assert.match(read('signature-build.txt').toString(), /BUILD SUCCESSFUL/);
  for (const file of ['source-files.json', 'signature-source-files.json']) assertRetainedSourceFiles(root, json(file));
  const nativePath = 'android/app/src/androidTest/java/be/sportgreenmoove/app/ui/LocalTeamDraftRestartTest.kt';
  const corrected = json('signature-source-files.json'); assert.deepEqual(Object.keys(corrected), [nativePath]);
  assert.notEqual(corrected[nativePath], json('source-files.json')[nativePath]);
  assert.equal((readFile(resolve(root, 'docs/release/evidence/source-archive/' + corrected[nativePath] + '.txt')).toString()
    .match(/@Test fun \w+\(\): Unit =/g) ?? []).length, 3);
  for (const [file, hash] of Object.entries(json('artifact-sha256.json'))) {
    assert(!file.startsWith('/') && !file.split('/').includes('..')); assert.equal(sha(read(file)), hash, file);
  }
  return run;
}
