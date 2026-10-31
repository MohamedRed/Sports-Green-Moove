import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {imageSize} from 'image-size';
import {assertEvidenceBundleChecksums} from './evidence-bundle-checksums.mjs';
import {assertRetainedSourceFiles} from './retained-source-evidence.mjs';

export const receivedRatingsFolder = 'docs/release/evidence/received-ratings-2026-10-29/';
export const receivedRatingsPhases = ['empty-driver', 'historical-driver', 'updated-driver', 'parent', 'empty-manager', 'signed-out'];
export const receivedPublicCaptures = ['empty-driver', 'historical-driver', 'updated-driver', 'parent', 'landscape'];
export function assertReceivedRatingsEvidence({summary, service, first, phone, observations, review, disposal, window, units, priorCi}) {
  assert.equal(summary.scope, 'received-rating-summary-on-one-isolated-physical-android-not-release');
  assert.equal(summary.physicalDeviceCount, 1); assert.equal(summary.accountsTested, 3);
  assert.equal(summary.publicCaptureMethod, 'browser-session-window-not-native-export');
  assert.deepEqual(summary.publicCaptures, receivedPublicCaptures);
  for (const flag of ['installedBytesIndependentlyVerified', 'processRestartProven', 'phoneRatingSubmissionProven',
    'longReviewDiscoveryFixed', 'iosProfileImplemented', 'productionDeployed', 'productionWrites', 'releaseComplete',
    'videoAccepted', 'componentTestsExecutedLocally']) assert.equal(summary[flag], false, flag);
  assert.equal(summary.providerMapRequests, 0); assert.equal(summary.realPaymentExercised, false);
  assert.equal(service.scope, 'authenticated-isolated-received-rating-summary-not-phone-or-release');
  assert.equal(service.completed, true); assert.equal(service.checks.length, 8);
  assert(service.checks.every(row => row.status === 'passed')); assert.equal(service.protectedRecordCount, 158);
  assert.deepEqual(service.observations.map(row => row.result), [
    {userId: 'sgm-qa-driver', count: 104, average: 358 / 104}, {userId: 'sgm-qa-parent', count: 26, average: 4},
    {userId: 'sgm-qa-driver', count: 105, average: 363 / 105}]);
  assert.equal(first.completed, false); assert.equal(first.checks.length, 0);
  assert.equal(first.isolatedEnvironmentDestroyed, true); assert.notEqual(first.runId, service.runId);
  for (const row of [service, first, phone, window]) {
    assert.equal(row.projectId, 'demo-sgm-local-qa'); assert.equal(row.productionWrites, false);
    assert.equal(row.providerRequests, 0); assert.equal(row.adminClientClosed, true); assert.equal(row.firestoreClientTerminated, true);
  }
  assert.equal(phone.completed, true); assert.equal(phone.fixtureSubmittedAllRatings, true);
  assert.equal(phone.phoneUiProvenByThisObserver, false); assert.equal(phone.processRestartProven, false);
  assert.equal(phone.installedBytesIndependentlyVerified, false); assert.equal(phone.sourceApkSha256, summary.sourceApkSha256);
  assert.match(summary.sourceApkSha256, /^[a-f0-9]{64}$/); assert.equal(observations.length, 6);
  assert.deepEqual(phone.checks.map(row => row.phase), receivedRatingsPhases);
  for (const [index, phase] of receivedRatingsPhases.entries()) {
    const row = observations[index]; assert.equal(row.phase, phase); assert.equal(row.runId, phone.runId);
    assert.deepEqual(row.summaries, {
      driver: {userId: 'sgm-qa-driver', count: index === 0 ? 0 : index === 1 ? 104 : 105,
        average: index === 0 ? null : index === 1 ? 358 / 104 : 363 / 105},
      parent: {userId: 'sgm-qa-parent', count: index === 0 ? 0 : 26, average: index === 0 ? null : 4},
      manager: {userId: 'sgm-qa-club-manager', count: 0, average: null},
    });
    assert.deepEqual(phone.checks[index], {phase, status: 'passed', driverCount: row.summaries.driver.count,
      parentCount: row.summaries.parent.count, managerCount: 0, protectedRecordCount: 158,
      ratingsAndRidesUnchanged: true, originalClaimsUnchanged: true});
  }
  assert.equal(review.scope, 'manual-session-ui-review-separate-from-independent-summary-records');
  for (const flag of ['emptyDriver', 'historicalMeanAndCount', 'updatedMeanAndCount', 'separateParent', 'emptyThirdAccount',
    'landscapeSummaryAccessible', 'blankLoginAfterSignOut', 'remoteClipboardReplaced', 'localClipboardRestored',
    'idleDashboardAfterStop', 'syntheticContentOnly', 'publicAudienceUnchanged']) assert.equal(review[flag], true, flag);
  assert.equal(disposal.observerExitCode, 0); assert.equal(disposal.runtimeExitCode, 130); assert.equal(disposal.helperExitCode, 130);
  assert.equal(disposal.privateSessionAbsent, true); assert.equal(disposal.helperDirectoryAbsent, true);
  assert.equal(disposal.helperProcessAbsent, true); assert.equal(disposal.noLocalRuntimeDirectories, true);
  assert.deepEqual(disposal.ports, [5001, 8080, 9000, 9099, 45690, 45691].map(port => ({port, available: true})));
  assert.equal(window.scope, 'controlled-isolated-reproduction-of-open-review-window-gap-not-a-passing-flow');
  assert.equal(window.gapReproduced, true); assert.equal(window.completedRideCount, 31); assert.equal(window.immutableRatingCount, 30);
  assert.equal(window.expectedDriverPrompts, 1); assert.equal(window.observedDriverPrompts, 0);
  assert.equal(window.expectedParentPrompts, 31); assert.equal(window.observedParentPrompts, 30);
  assert.equal(window.originalRecordsAndClaimsUnchanged, true); assert.equal(window.isolatedEnvironmentDestroyed, true);
  assert.deepEqual(units, {tests: 622, failures: 0, errors: 0, skipped: 0});
  assert.equal(priorCi.head, '5246a079e1f02af234697111cbc2c1e3f70f3f3c'); assert.equal(priorCi.fullNativeGatePassed, false);
  assert.equal(priorCi.ordinary.passed, 186); assert.equal(priorCi.ordinary.failed, 1); assert.equal(priorCi.ordinary.skipped, 54);
  return summary;
}
export function validateReceivedRatingsEvidence(root, reference = {source: receivedRatingsFolder + 'summary.json'}) {
  assert.equal(reference.source, receivedRatingsFolder + 'summary.json');
  const base = resolve(root, receivedRatingsFolder), json = path => JSON.parse(readFileSync(resolve(base, path + '.json')));
  assertEvidenceBundleChecksums(base);
  const result = assertReceivedRatingsEvidence({summary: json('summary'), service: json('service'), first: json('first-preparation'),
    phone: json('phone/session-results'), observations: receivedRatingsPhases.map(phase => json('phone/' + phase + '-observed')),
    review: json('ui-review'), disposal: json('disposal'), window: json('review-window-gap'), units: json('android-unit-counts'), priorCi: json('prior-ci')});
  for (const row of [json('service'), json('first-preparation'), json('phone/session-results'), json('review-window-gap')])
    assertRetainedSourceFiles(root, row.sourceFiles);
  assertRetainedSourceFiles(root, json('native-sources'));
  assert.match(readFileSync(resolve(base, 'backend-units.txt'), 'utf8'), /517 passed \(517\)/);
  assert.match(readFileSync(resolve(base, 'android-build.txt'), 'utf8'), /BUILD SUCCESSFUL/);
  assert.match(readFileSync(resolve(base, 'prior-ci-capture-failure.txt'), 'utf8'), /Failed waiting for PixelCopy!/);
  for (const name of [...receivedRatingsPhases, 'landscape']) {
    const image = imageSize(readFileSync(resolve(base, 'captures', name + '.jpg')));
    assert.equal(image.type, 'jpg'); assert.equal(image.width, name === 'landscape' ? 648 : 304);
    assert.equal(image.height, name === 'landscape' ? 306 : 646);
  }
  return result;
}
