import assert from 'node:assert/strict';

export function assertUnchangedIosFixtureWorkload(current, baseline) {
  const expected = structuredClone(baseline.jobs);
  const job = expected['ios-fixture-verification'];
  assert.equal(job['runs-on'], 'macos-26-intel');
  job['runs-on'] = 'macos-26';
  const inspection = job.steps.find(row => row.name === 'Inspect installed Apple tools');
  assert.equal(inspection.run, 'xcodebuild -version\nxcrun simctl list runtimes\n');
  inspection.run = 'test "$(uname -m)" = arm64\n' + inspection.run;
  assert.deepEqual(current.jobs, expected);
  assert.deepEqual(current.concurrency, baseline.concurrency);
}
