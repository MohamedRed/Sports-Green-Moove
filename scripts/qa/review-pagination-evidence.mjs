import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {imageSize} from 'image-size';
import {assertEvidenceBundleChecksums} from './evidence-bundle-checksums.mjs';
import {assertRetainedSourceFiles} from './retained-source-evidence.mjs';

export const reviewPaginationFolder = 'docs/release/evidence/review-pagination-2026-10-29/';
export const reviewPaginationPhases = ['driver-pending31', 'driver-sent', 'parent-first-page', 'parent-more', 'parent-sent', 'signed-out'];
export const reviewPaginationPublicCaptures = ['driver-pending31', 'driver-sent', 'parent-first-page', 'parent-continuation', 'parent-more', 'parent-sent-top'];
export function assertReviewPaginationEvidence({summary, service, first, phone, observations, review, disposal, units}) {
  assert.equal(summary.scope, 'pending-review-pagination-on-one-isolated-physical-android-not-release');
  assert.equal(summary.physicalDeviceCount, 1); assert.equal(summary.accountsTested, 2);
  assert.equal(summary.publicCaptureMethod, 'browser-session-window-not-native-export');
  assert.deepEqual(summary.publicCaptures, reviewPaginationPublicCaptures);
  assert.equal(summary.original31RideGapFixedInIsolatedReplay, true);
  assert.equal(summary.phoneRatingSubmissionsIndependentlyObserved, 2);
  assert.equal(summary.sourceBaselineCommit, '3641ea1add6196cd19742d94bb7c28cf16960d74');
  assert.equal(summary.implementationWasUncommittedAtBuild, true);
  for (const flag of ['installedBytesIndependentlyVerified', 'processRestartProven', 'productionDeployed', 'productionWrites',
    'releaseComplete', 'videoAccepted', 'componentTestsExecutedLocally', 'iosUiExecuted', 'iosPhysicalPhoneTested', 'realPaymentExercised'])
    assert.equal(summary[flag], false, flag);
  assert.equal(summary.providerMapRequests, 0);
  assert.equal(service.scope, 'authenticated-isolated-pending-review-pagination-not-phone-or-production');
  assert.equal(service.completed, true); assert.equal(service.steps.length, 8); assert(service.steps.every(row => row.status === 'passed'));
  assert.deepEqual(service.observations, {previous31RideGap: {driverRequests: 1, parentRequests: 31, parentPages: 2},
    driver: {requests: 80, pages: 6, emptyContinuationPages: 2}, parent: {requests: 320, pages: 16},
    afterSubmission: {driverRequests: 79, parentRequests: 319, immutableRatings: 241}});
  assert.equal(service.protectedRecordCount, 158); assert.equal(service.isolatedEnvironmentDestroyed, true);
  assert.equal(first.completed, false); assert.equal(first.steps.length, 0); assert.equal(first.isolatedEnvironmentDestroyed, true);
  assert.notEqual(first.runId, service.runId);
  for (const report of [service, first, phone]) {
    assert.equal(report.projectId, 'demo-sgm-local-qa'); assert.equal(report.productionWrites, false); assert.equal(report.providerRequests, 0);
    assert.equal(report.adminClientClosed, true); assert.equal(report.firestoreClientTerminated, true);
  }
  assert.equal(phone.completed, true); assert.equal(phone.phoneUiProvenByThisObserver, false);
  assert.equal(phone.fixtureSubmittedInitialRatings, 30); assert.equal(phone.subsequentRatingsFixtureSubmitted, false);
  assert.equal(phone.installedBytesIndependentlyVerified, false); assert.equal(phone.sourceApkSha256, summary.sourceApkSha256);
  assert.match(summary.sourceApkSha256, /^[a-f0-9]{64}$/); assert.equal(observations.length, 6);
  assert.deepEqual(phone.checks.map(row => row.phase), reviewPaginationPhases);
  for (const [index, phase] of reviewPaginationPhases.entries()) {
    const row = observations[index]; assert.equal(row.phase, phase); assert.equal(row.runId, phone.runId);
    assert.equal(row.driverRequests, index === 0 ? 1 : 0); assert.equal(row.parentRequests, index < 4 ? 31 : 30);
    assert.equal(row.parentPages, 2); assert.equal(row.parentFirstPageSize, 20);
    assert.equal(row.immutableRatingCount, index === 0 ? 30 : index < 4 ? 31 : 32);
    assert.equal(row.originalRatingsRidesAndClaimsPreserved, true); assert.equal(row.protectedRecordCount, 158);
    assert.deepEqual(phone.checks[index], {...row, status: 'passed'});
  }
  assert.equal(review.scope, 'manual-session-ui-review-separate-from-independent-record-checkpoints');
  for (const flag of ['driver31stPromptVisible', 'driverFiveStarsSentAndPromptRemoved', 'parentFirstPageBadge20',
    'parentContinuationVisible', 'parentSecondPageBadge31', 'parentLaterPageFiveStarsSent', 'remainingBadge30WithoutFirstPageReset',
    'blankLoginAfterSignOut', 'remoteClipboardReplacementTextVerified', 'localClipboardRestored', 'idleDashboardAfterStop',
    'syntheticContentOnly', 'publicAudienceUnchanged']) assert.equal(review[flag], true, flag);
  assert.equal(review.processRestartProven, false);
  assert.equal(disposal.observerExitCode, 0); assert.equal(disposal.runtimeExitCode, 130); assert.equal(disposal.helperExitCode, 130);
  for (const flag of ['privateSessionAbsent', 'helperDirectoryAbsent', 'helperProcessAbsent', 'noLocalRuntimeDirectories']) assert.equal(disposal[flag], true);
  assert.deepEqual(disposal.ports, [5001, 8080, 9000, 9099, 45690, 45691].map(port => ({port, available: true})));
  assert.deepEqual(units, {tests: 630, failures: 0, errors: 0, skipped: 0});
  return summary;
}
export function validateReviewPaginationEvidence(root, reference = {source: reviewPaginationFolder + 'summary.json'}) {
  assert.equal(reference.source, reviewPaginationFolder + 'summary.json');
  const base = resolve(root, reviewPaginationFolder), json = name => JSON.parse(readFileSync(resolve(base, name + '.json')));
  assertEvidenceBundleChecksums(base);
  const summary = assertReviewPaginationEvidence({summary: json('summary'), service: json('service'), first: json('first-preparation'),
    phone: json('phone/session-results'), observations: reviewPaginationPhases.map(phase => json('phone/' + phase)),
    review: json('ui-review'), disposal: json('disposal'), units: json('android-unit-counts')});
  for (const report of [json('service'), json('first-preparation'), json('phone/session-results')]) assertRetainedSourceFiles(root, report.sourceFiles);
  assertRetainedSourceFiles(root, json('native-sources'));
  assert.match(readFileSync(resolve(base, 'backend-units.txt'), 'utf8'), /527 passed \(527\)/);
  assert.match(readFileSync(resolve(base, 'android-build.txt'), 'utf8'), /BUILD SUCCESSFUL/);
  assert.match(readFileSync(resolve(base, 'ios-model-checks.txt'), 'utf8'), /PendingReviewChecks passed/);
  for (const name of [...reviewPaginationPublicCaptures, 'parent-last-review', 'parent-sent', 'signed-out']) {
    const info = imageSize(readFileSync(resolve(base, 'captures', name + '.jpg')));
    assert.equal(info.type, 'jpg'); assert.equal(info.width, 304); assert.equal(info.height, 646);
  }
  return summary;
}
