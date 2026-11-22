import assert from 'node:assert/strict';
import test from 'node:test';
import {iosFixtureIndexName} from '../scripts/qa/ios-fixture-index.mjs';

test('both outcomes use immutable terminal time and job identity, in chronological order', () => {
  const job = {jobId: 10, completedAt: '2026-11-06T20:11:01Z'};
  const accepted = iosFixtureIndexName(job, 'accepted');
  const recheck = iosFixtureIndexName({...job, jobId: 11, completedAt: '2026-11-06T20:12:01Z'}, 'recheck');
  assert.equal(accepted, 'automated-user-flow-evidence-2026-11-06T201101000Z-10-accepted.json');
  assert(recheck > accepted);
  assert(accepted > 'automated-user-flow-evidence-2026-11-06T-9640d8b-recheck.json');
  assert.notEqual(accepted, iosFixtureIndexName({...job, jobId: 12}, 'accepted'));
});
test('invalid terminal identity, time or outcome is rejected, without a dated fallback', () => {
  const job = {jobId: 10, completedAt: '2026-11-06T20:11:01Z'};
  for (const changed of [{jobId: 0}, {jobId: '10'}, {completedAt: '2026-11-06'},
    {completedAt: '2026-02-30T20:11:01Z'}, {completedAt: '../../outside'}])
    assert.throws(() => iosFixtureIndexName({...job, ...changed}, 'accepted'));
  assert.throws(() => iosFixtureIndexName(job, 'unknown'));
});
