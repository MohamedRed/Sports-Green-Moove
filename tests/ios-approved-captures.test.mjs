import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {test} from 'node:test';
import {parseDocument} from 'yaml';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const folder = 'docs/release/evidence/ios-approved-captures-2026-11-04/';
const workflow = parseDocument(read('.github/workflows/ios-mvp-verification.yml')).toJSON();
const job = workflow.jobs['ios-fixture-verification'];

test('explicit approval bounds exactly three synthetic images, one day and the new job limit', () => {
  const approval = JSON.parse(read(folder + 'approval.json'));
  assert.equal(approval.maximumImages, 3); assert.equal(approval.maximumTotalBytes, 2_000_000);
  assert.equal(approval.retentionDays, 1); assert.equal(approval.fixtureOnly, true);
  assert.equal(approval.jobLimitIncreaseApproved, true);
  assert.equal(approval.previousJobMinutes, 35); assert.equal(approval.maximumJobMinutes, 50);
  assert.equal(job['timeout-minutes'], approval.maximumJobMinutes);
  assert.equal(approval.additionalCacheOrArtifactStorageApproved, false);
  assert.deepEqual(workflow.permissions, {contents: 'read'});
  assert.equal(workflow.concurrency['cancel-in-progress'], false);
  assert.equal(workflow.on.workflow_dispatch.inputs.retain_approved_captures.default, false);
});

test('one upload retains only the validated four-file envelope and never result bundles or other storage', () => {
  const uploads = job.steps.filter(step => step.uses?.startsWith('actions/upload-artifact'));
  assert.equal(uploads.length, 1);
  const upload = uploads[0];
  assert.equal(upload.uses, 'actions/upload-artifact@v4');
  assert.equal(upload.if, "${{ !cancelled() && github.event_name == 'workflow_dispatch' && inputs.retain_approved_captures && steps.captures.outcome == 'success' }}");
  assert.equal(upload.with['retention-days'], 1); assert.equal(upload.with['if-no-files-found'], 'error');
  assert.equal(upload.with['include-hidden-files'], false); assert.equal(upload.with.overwrite, false);
  assert.deepEqual(upload.with.path.trim().split('\n'), ['home.png', 'profile.png', 'rating-sent.png', 'manifest.json']
    .map(file => '${{ runner.temp }}/sgm-approved-iphone-captures/' + file));
  assert.doesNotMatch(read('.github/workflows/ios-mvp-verification.yml'), /actions\/cache|continue-on-error|secrets\./);
  const collector = job.steps.find(step => step.id === 'captures');
  assert.equal(collector.run, 'bash scripts/qa/check-ios-approved-captures.sh');
  assert.match(collector.if, /!cancelled\(\)/);
  assert.match(collector.if, /github.event_name == 'workflow_dispatch' && inputs.retain_approved_captures/);
  assert.match(collector.if, /steps.fixtures.outcome == 'failure'/);
  assert.equal(collector.env.FIXTURE_OUTCOME, '${{ steps.fixtures.outcome }}');
  assert.equal(job.steps.at(-1).run, 'xcrun simctl delete "$PHONE_ID"');
});

test('three original positive fixture checkpoints capture PNGs with no form passwords or extra replay', () => {
  const fixture = read('ios/UITests/SportsGreenMooveUITests/SportsGreenMooveUITests.swift');
  assert.deepEqual([...fixture.matchAll(/captureApproved\(\.(\w+), in: app\)/g)].map(match => match[1]), ['home', 'profile', 'rating']);
  assert.equal((fixture.match(/@MainActor func test/g) ?? []).length, 5);
  const helper = read('ios/UITests/SportsGreenMooveUITests/ApprovedCapture.swift');
  assert.match(helper, /app.launchArguments.contains\("--sgm-ui-test-fixture"\)/);
  assert.match(helper, /object\(forInfoDictionaryKey: "SGMApprovedCaptures"\) as\? String == "YES" else \{ return \}/);
  const spec = parseDocument(read('ios/project.yml')).toJSON();
  assert.equal(spec.targets.SportsGreenMooveUITests.info.path, 'Generated/UITests-Info.plist');
  assert.equal(spec.targets.SportsGreenMooveUITests.info.properties.SGMApprovedCaptures, '$(SGM_RETAIN_APPROVED_CAPTURES)');
  assert.match(helper, /app.state == \.runningForeground/);
  assert.match(helper, /used \+ bytes.count <= 1_900_000/);
  assert.match(helper, /let bytes = app.screenshot\(\).pngRepresentation/);
  assert.match(helper, /let size = info.fileSize/);
  assert.doesNotMatch(helper, /password|resize|jpeg|try\?|\?\? 0/i);
});

test('the local policy receipt proves generated-image checks only, not executed native captures', () => {
  const report = JSON.parse(read(folder + 'summary.json'));
  assert.equal(report.localPolicySelfTest.exitCode, 0);
  assert.equal(createHash('sha256').update(read(folder + report.localPolicySelfTest.log)).digest('hex'), report.localPolicySelfTest.logSha256);
  assert.equal(report.producerImageBudgetBytes, 1_900_000);
  assert.equal(report.exportPayloadMaximumBytes, 1_990_000);
  for (const key of ['captureProducerSdkAccepted', 'realCaptureExportAccepted', 'imagesCaptured', 'imagesUploaded', 'newMediaPublished', 'releaseComplete']) assert.equal(report[key], false);
  const policy = read('scripts/qa/ios-approved-captures/Policy.swift');
  for (const marker of ['CGImageSourceCreateImageAtIndex', 'imageHasContent(image)', 'isSymbolicLink != true', 'total <= approvedImageBudget']) assert(policy.includes(marker));
  const collector = read('scripts/qa/ios-approved-captures/main.swift');
  for (const marker of ['testedCommit', 'sourceHead', 'fixtureOutcome', '1_990_000', 'validateApprovedImages(destination) == images']) assert(collector.includes(marker));
  const web = parseDocument(read('.github/workflows/web-integration-smoke.yml')).toJSON();
  for (const path of ['tests/ios-approved-captures.test.mjs', 'scripts/qa/check-ios-approved-captures.sh', 'scripts/qa/ios-approved-captures/**']) {
    assert(workflow.on.pull_request.paths.includes(path));
    for (const event of ['push', 'pull_request']) assert(web.on[event].paths.includes(path));
  }
});

test('the authorized Site rotation receipt records only non-secret confirmation and preserves public access', () => {
  const receipt = JSON.parse(read('docs/release/evidence/site-service-token-2026-11-04/receipt.json'));
  for (const key of ['rotationApproved', 'rotatedTokenDiffers', 'currentTokenConfirmed']) assert.equal(receipt[key], true);
  assert.equal(receipt.audienceBefore, 'public'); assert.equal(receipt.audienceAfter, 'public');
  assert.equal(receipt.accessPolicyChanged, false); assert.equal(receipt.secretValuesOrHashesRecorded, false);
  assert.equal(receipt.oldTokenRejectionProbed, false);
  assert.equal(receipt.serviceMayApplyShortGracePeriod, true);
  assert(!Object.keys(receipt).some(key => /bearer|prefix|digest/i.test(key)));
});
