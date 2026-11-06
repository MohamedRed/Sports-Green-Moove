import assert from 'node:assert/strict';

export function assertIosFixtureWorkloadWithSelectionCheck(currentJobs, baselineJobs) {
  const expected = structuredClone(baselineJobs), steps = expected['ios-fixture-verification'].steps;
  const index = steps.findIndex(row => row.name === 'Run native logic checks'); assert(index >= 0);
  assert(!steps.some(row => row.name === 'Check immediate search selection invalidation'));
  steps.splice(index + 1, 0, {name: 'Check immediate search selection invalidation', run: 'node scripts/qa/check-ios-search-selection.mjs'});
  assert.deepEqual(currentJobs, expected);
}

export function assertUnchangedIosFixtureWorkload(current, baseline) {
  const expected = structuredClone(baseline.jobs);
  const job = expected['ios-fixture-verification'];
  assert.equal(job['runs-on'], 'macos-26-intel');
  job['runs-on'] = 'macos-26';
  const inspection = job.steps.find(row => row.name === 'Inspect installed Apple tools');
  assert.equal(inspection.run, 'xcodebuild -version\nxcrun simctl list runtimes\n');
  inspection.run = 'test "$(uname -m)" = arm64\n' + inspection.run;
  assertIosFixtureWorkloadWithSelectionCheck(current.jobs, expected);
  assert.deepEqual(current.concurrency, baseline.concurrency);
}
