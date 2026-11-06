import assert from 'node:assert/strict';

export function withMembershipFailureObservation(original) {
  const club = '    XCTAssertTrue(club.waitForExistence(timeout: 6)); club.tap()\n';
  const approve = '    XCTAssertTrue(approve.waitForExistence(timeout: 6)); approve.tap()\n';
  assert.equal(original.split(club).length, 2); assert.equal(original.split(approve).length, 2);
  return original.replace(club, '    XCTAssertTrue(club.waitForExistence(timeout: 6))\n' +
    '    print("SGM_MEMBERSHIP_CLUB_BEFORE_TAP enabled=\\(club.isEnabled) hittable=\\(club.isHittable) frame=\\(club.frame)")\n' +
    '    club.tap()\n').replace(approve, '    let appeared = approve.waitForExistence(timeout: 6)\n' +
    '    if !appeared {\n        print("SGM_MEMBERSHIP_REVIEW_MISSING_BEGIN")\n' +
    '        print(String(app.debugDescription.prefix(32_000)))\n        print("SGM_MEMBERSHIP_REVIEW_MISSING_END")\n    }\n' +
    '    XCTAssertTrue(appeared); approve.tap()\n');
}

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
