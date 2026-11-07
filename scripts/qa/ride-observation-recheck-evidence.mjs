import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { dirname, resolve } from 'node:path';
import { validateRideObservationDeviceBundle } from './ride-observation-retained-evidence.mjs';
import { validateContinuousDeviceEvidence } from './continuous-device-evidence.mjs';

export const rideObservationRecheckStates = ['fresh', 'stale', 'recovered', 'pickup', 'resumed', 'ended', 'history'];

export function validateRideObservationRecheck(root, source) {
  const report = validateRideObservationDeviceBundle(root, source);
  const folder = dirname(resolve(root, source)), read = file => readFileSync(resolve(folder, file));
  const json = file => JSON.parse(read(file)), sha = bytes => createHash('sha256').update(bytes).digest('hex');
  const context = json('retained-context.json'), job = json('job.json'), artifact = json('artifact.json');
  assert.equal(context.scope, 'independent-local-ride-observation-recheck-not-physical-tracking');
  assert.equal(context.runId, report.runId); assert.equal(report.runId, '5c26f791631373efe029caed8864cfaf');
  assert.equal(report.testedAt, '2026-10-21T15:42:14.152Z');
  assert.equal(context.sourceCommit, '4a3c02aebdbf6aeba875b44d4d2c2fe9f2e3e087');
  assert.equal(job.head_sha, context.sourceCommit); assert.equal(job.id, 119312649919); assert.equal(job.run_id, 39626395152);
  assert.equal(job.name, 'Android focused safety UI tests / Isolated ride-observation');
  assert.equal(job.status, 'completed'); assert.equal(job.conclusion, 'success');
  for (const name of ['Compile isolated app before starting the device', 'Run one isolated safety flow on its own phone',
    'Retain focused outcomes and independent cleanup']) {
    const steps = job.steps.filter(step => step.name === name);
    assert.equal(steps.length, 1); assert.equal(steps[0].conclusion, 'success');
  }
  assert.equal(artifact.id, 12358675168); assert.equal(artifact.workflow_run.id, job.run_id);
  assert.equal(artifact.workflow_run.head_sha, context.sourceCommit);
  assert.equal(artifact.digest, 'sha256:' + sha(read('original-artifact.zip')));
  assert.equal(artifact.size_in_bytes, read('original-artifact.zip').length);
  assert.equal(json('ride-observation-suite-status.json').status, 0);
  validateContinuousDeviceEvidence({ setup: json('disposable-device-setup.json'), setupBytes: read('disposable-device-setup.json'),
    restored: json('disposable-device-restore.json'), claimed: read('disposable-device-setup.json.claimed'), report });
  assert.equal(context.reviewedCaptureCount, 8); assert.equal(context.landscapeRetainedOnly, true);
  assert.deepEqual(context.publishedCaptures, Object.fromEntries(rideObservationRecheckStates.map(id =>
    ['ride-recheck-' + id, 'local-ride-observation-' + id + '.png'])));
  for (const key of ['physicalDevice', 'mapMovementVerified', 'realNetworkLossVerified', 'providerTrackingVerified',
    'fullNativeSuiteVerified', 'safetyAuditAccepted', 'storeReviewAccepted', 'productionWrites']) assert.equal(context[key], false);
  assert.match(gunzipSync(read('job-log.txt.gz')).toString(), /OK \(1 test\)/);
  for (const [file, hash] of Object.entries(json('artifact-sha256.json'))) {
    assert(!file.startsWith('/') && !file.split('/').includes('..')); assert.equal(sha(read(file)), hash, file);
  }
  return { ...report, publishedCaptures: context.publishedCaptures };
}
