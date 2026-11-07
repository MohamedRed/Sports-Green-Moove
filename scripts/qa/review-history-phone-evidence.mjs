import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {imageSize} from 'image-size';
import {assertEvidenceBundleChecksums} from './evidence-bundle-checksums.mjs';
import {assertRetainedSourceFiles} from './retained-source-evidence.mjs';
import {reviewPhonePhases, verifyReviewPhoneCheckpoint} from './review-history-phone-checkpoints.mjs';

export const reviewPhoneDirectory = 'docs/release/evidence/review-history-phone-2026-10-29/';
export function assertReviewPhoneEvidence({summary, session, fixture, observations, review, disposal}) {
  assert.equal(summary.scope, 'physical-android-review-history-not-release-proof');
  assert.equal(summary.projectId, 'demo-sgm-local-qa'); assert.match(summary.runId, /^[a-f0-9]{32}$/);
  assert.equal(summary.device, 'Google Pixel 9 Pro / Android 15'); assert.equal(summary.physicalDeviceCount, 1);
  assert.equal(summary.sourceBaselineCommit, '0c5fa32c1bad24d4073d34d89dc2c4f676a46113');
  assert.equal(summary.apkSourceBaselineCommit, 'ce93e568b7f636c0d6ce39f91daec4c4b80d72e7');
  assert.equal(summary.sourceApkSha256, '2b881a93effb05578b748fcc50f3f5299552f985b83fc953dd729cfdd1e67fc0');
  assert.equal(summary.publicCaptureMethod, 'browser-session-window-not-native-export');
  assert.deepEqual(summary.publicCaptures, reviewPhonePhases); assert.equal(summary.completedCheckpoints, 7);
  for (const flag of ['installedBytesIndependentlyVerified', 'processRestartProven', 'rideCompletionUiProven',
    'receivedRatingsProven', 'longerRideDiscoveryProven', 'productionWrites', 'productionDeployed', 'releaseComplete', 'videoAccepted'])
    assert.equal(summary[flag], false, flag);
  assert.equal(summary.providerMapRequests, 0); assert.equal(summary.realPaymentExercised, false);
  assert.equal(session.scope, 'independent-phone-review-records-not-ui-or-release-proof');
  assert.equal(session.completed, true); assert.equal(session.testedAt, summary.testedAt);
  assert.equal(session.adminClientClosed, true); assert.equal(session.firestoreClientTerminated, true);
  assert.equal(session.productionWrites, false); assert.equal(session.providerRequests, 0);
  for (const row of [session, fixture]) assert.equal(row.runId, summary.runId);
  assert.equal(session.projectId, summary.projectId);
  assert.equal(fixture.scope, 'completed-rides-and-104-ratings-prepared-not-phone-ride-or-rating-proof');
  assert.equal(observations.length, 7); assert.equal(session.checks.length, 7);
  let previousTime = 0;
  for (const [index, row] of observations.entries()) {
    assert.equal(row.runId, summary.runId); const time = Date.parse(row.observedAt);
    assert(Number.isFinite(time) && time > previousTime && time <= Date.parse(summary.testedAt)); previousTime = time;
    const expected = verifyReviewPhoneCheckpoint(reviewPhonePhases[index], row.state, fixture.fixture);
    assert.deepEqual(session.checks[index], {...expected, protectedRecordCount: 158, originalClaimsUnchanged: true});
    const original = new Map(observations[0].state.ratings.map(rating => [rating.id, rating]));
    for (const rating of row.state.ratings.filter(rating => original.has(rating.id))) assert.deepEqual(rating, original.get(rating.id));
  }
  assert.equal(review.scope, 'manual-session-ui-observations-separate-from-independent-records');
  assert.equal(review.accountsTested, 2); assert.equal(review.syntheticContentOnly, true);
  assert.equal(review.sessionCapturesApproved, true); assert.equal(review.publicAudienceUnchanged, true);
  for (const flag of ['historyHidden', 'singleNewPrompt', 'driverSentFiveStars', 'hiddenAfterNavigation',
    'parentOwnRequestsVisible', 'parentSentFiveStars', 'blankLoginAfterSignOut', 'remoteClipboardReplaced',
    'localClipboardRestored', 'idleDashboardAfterStop']) assert.equal(review[flag], true, flag);
  assert.equal(review.restartMethod, 'navigation-only-no-process-stop');
  assert.equal(disposal.observerExitCode, 0); assert.equal(disposal.runtimeExitCode, 130); assert.equal(disposal.helperExitCode, 130);
  for (const flag of ['privateSessionAbsent', 'helperDirectoryAbsent', 'helperProcessAbsent', 'noLocalRuntimeDirectories'])
    assert.equal(disposal[flag], true, flag);
  assert.deepEqual(disposal.ports, [5001, 8080, 9000, 9099, 45690, 45691].map(port => ({port, available: true})));
  return summary;
}

export function validateReviewPhoneEvidence(root, reference = {source: reviewPhoneDirectory + 'summary.json'}) {
  assert.equal(reference.source, reviewPhoneDirectory + 'summary.json');
  const base = resolve(root, reviewPhoneDirectory), json = file => JSON.parse(readFileSync(resolve(base, file + '.json')));
  assertEvidenceBundleChecksums(base);
  const result = assertReviewPhoneEvidence({summary: json('summary'), session: json('records/session-results'), fixture: json('records/fixture'),
    observations: reviewPhonePhases.map(phase => json('records/' + phase + '-observed')), review: json('ui-review'), disposal: json('disposal')});
  assertRetainedSourceFiles(root, json('records/session-results').sourceFiles);
  for (const phase of reviewPhonePhases) {
    const image = imageSize(readFileSync(resolve(base, 'captures', phase + '.jpg')));
    assert.equal(image.type, 'jpg'); assert.equal(image.width, 216); assert.equal(image.height, 462);
  }
  return result;
}
