import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';
import { validateSessionRestorationDeviceBundle } from './session-restoration-retained-evidence.mjs';

export function validateSessionRestorationRecovery(root, source) {
  const report = validateSessionRestorationDeviceBundle(root, source);
  assert.equal(report.runId, '655002e373520a2a0e28e009c6d0d050');
  const folder = dirname(resolve(root, source)), read = file => readFileSync(resolve(folder, file));
  const json = file => JSON.parse(read(file)), sha = bytes => createHash('sha256').update(bytes).digest('hex');
  const job = json('job.json'), artifact = json('artifact.json'), review = json('visual-review.json');
  assert.equal(job.id, 119303030529); assert.equal(job.run_id, 39623570942);
  assert.equal(job.status, 'completed'); assert.equal(job.conclusion, 'success');
  assert.equal(job.name, 'Android focused safety UI tests / Isolated session-restoration');
  for (const name of ['Compile isolated app before starting the device', 'Run one isolated safety flow on its own phone',
    'Retain focused outcomes and independent cleanup']) assert.equal(job.steps.find(step => step.name === name)?.conclusion, 'success');
  assert.equal(artifact.id, 12355843902); assert.equal(artifact.workflow_run.id, job.run_id);
  assert.equal(artifact.workflow_run.head_sha, 'f6181874e304362bdea344a3cdf5aaaa7bcd5815');
  assert.equal(artifact.name, 'android-focused-safety-ui-session-restoration');
  assert.equal(artifact.size_in_bytes, read('original-artifact.zip').length);
  assert.equal(artifact.digest, 'sha256:' + sha(read('original-artifact.zip')));
  assert.equal(review.sourceCommit, artifact.workflow_run.head_sha); assert.equal(review.reviewedAt, report.testedAt.slice(0, 10));
  assert.deepEqual(review.published, Object.fromEntries(['error', 'rotated-error', 'recovered', 'restored']
    .map(id => ['session-recheck-' + id, 'local-session-restoration-' + id + '.png'])));
  assert.equal(review.identityCaptureRetainedOnly, true);
  for (const key of ['mediaEdits', 'physicalDevice', 'realNetworkLossVerified', 'wholeWorkflowSuccessClaimed']) assert.equal(review[key], false);
  for (const [file, hash] of Object.entries(json('artifact-sha256.json'))) {
    assert.equal(basename(file), file); assert.equal(sha(read(file)), hash, file);
  }
  return { ...report, publishedCaptures: review.published };
}
