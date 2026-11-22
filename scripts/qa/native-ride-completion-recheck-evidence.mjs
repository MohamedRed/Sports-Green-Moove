import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { assertEvidenceBundleChecksums } from './evidence-bundle-checksums.mjs';

export function validateNativeRideCompletionRecheck(root, record) {
  const base = dirname(resolve(root, record.source));
  assert.equal(record.checkedAt, '2026-10-23');
  assert.equal(resolve(root, record.checksums), resolve(base, 'artifact-sha256.json'));
  const run = JSON.parse(readFileSync(resolve(base, 'run.json')));
  assert.equal(run.headSha, '65c3f0fc6cd231afdca703439c6704037112badb');
  assert.equal(run.status, 'completed'); assert.equal(run.conclusion, 'failure');
  assert.equal(run.url, 'https://github.com/MohamedRed/Sports-Green-Moove/actions/runs/39960012671');
  const focused = run.jobs.filter(job => job.name.startsWith('Android focused safety UI tests /'));
  assert.equal(focused.length, 11); assert(focused.every(job => job.conclusion === 'success'));
  const full = run.jobs.find(job => job.databaseId === 120435351508);
  assert.equal(full.name, 'Android native UI tests'); assert.equal(full.conclusion, 'failure');
  const log = readFileSync(resolve(base, 'failure-excerpt.txt'), 'utf8');
  assert.match(log, /driverCompletesRideAndParentSubmitsReview/);
  assert.match(log, /LocalRideFlowTest.kt:75/); assert.match(log, /active-ride.end.action/);
  assert.match(log, /Failed to assert the following: \(is enabled\)/); assert.match(log, /\[Disabled\]/);
  assertEvidenceBundleChecksums(base); return run;
}
