import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {imageSize} from 'image-size';
import {reviewNetworkPhases} from './review-network-phone-checkpoints.mjs';
import {assertEvidenceBundleChecksums} from './evidence-bundle-checksums.mjs';
import {assertRetainedSourceFiles} from './retained-source-evidence.mjs';

export const reviewNetworkPhoneFolder = 'docs/release/evidence/review-network-phone-2026-10-30/';
export const reviewNetworkCaptureNames = ['parent-ready', 'offline-failed', 'online-before-retry', 'parent-rated',
  'parent-restored', 'driver-summary', 'driver-requests'];
export function assertReviewNetworkPhone(summary, phone) {
  assert.equal(summary.scope, 'physical-android-controlled-offline-review-retry-not-release');
  assert.equal(summary.sourceCommit, 'b015934047595fab4925d066e331abf86659a778');
  assert.equal(phone.completed, true); assert.equal(phone.projectId, 'demo-sgm-local-qa');
  assert.equal(phone.fixtureSubmittedRatings, 0); assert.equal(phone.controllerSubmittedRatings, false);
  assert.equal(phone.adminClientClosed, true); assert.equal(phone.firestoreClientTerminated, true);
  assert.equal(phone.phoneUiProvenByObserver, false); assert.equal(phone.physicalNetworkLossProvenByObserver, false);
  assert.equal(phone.productionWrites, false); assert.equal(phone.providerRequests, 0);
  assert.equal(phone.sourceApkSha256, '21d325914327eee4c883c5378d263ec31ba425fb3c628690f4c2c3f866666942');
  assert.equal(summary.sourceApkSha256, phone.sourceApkSha256);
  assert.equal(phone.installedBytesIndependentlyVerified, false);
  assert.deepEqual(phone.checks.map(row => row.phase), reviewNetworkPhases);
  for (const [index, row] of phone.checks.entries()) {
    assert.equal(row.runId, phone.runId); assert.equal(row.status, 'passed');
    assert.equal(row.parentRequests, index < 4 ? 2 : 1); assert.equal(row.driverRequests, 2);
    assert.equal(row.ratingCount, Number(index >= 4)); assert.equal(row.originalRecordsAndClaimsPreserved, true);
    assert.equal(row.exactTripAndTargetsPreserved, true); assert.equal(row.phoneUiProvenByObserver, false);
    assert.equal(row.physicalNetworkLossProvenByObserver, false); assert.equal(row.processRestartProvenByObserver, false);
  }
  for (const key of ['physicalPhoneUiReviewed', 'controlledOfflineProviderConfirmationObserved',
    'failedSubmissionKeptBothTrips', 'zeroRatingsBeforeExplicitRetry', 'sameTripRetryStoredExactlyOnce',
    'olderTripRetainedAfterReopen', 'manualAndroidForceStopObserved', 'driverMeanAndCountObserved',
    'separateDriverRequestsObserved', 'networkRestored', 'finalSignOutObserved']) assert.equal(summary[key], true, key);
  for (const key of ['offlineSendingUiCaptured', 'independentProcessRestartProven', 'installedBytesIndependentlyVerified',
    'physicalPostCommitLostReplyProven', 'realWorldRadioLossProven', 'iosUiExecuted', 'productionWrites', 'releaseComplete'])
    assert.equal(summary[key], false, key);
  assert.equal(summary.mapRequests, 0); assert.equal(summary.realPayments, false);
  assert.deepEqual(summary.driverSummary, {average: 5, count: 1});
  return summary;
}
export function validateReviewNetworkPhone(root, reference = {source: reviewNetworkPhoneFolder + 'summary.json'}) {
  assert.equal(reference.source, reviewNetworkPhoneFolder + 'summary.json');
  const base = resolve(root, reviewNetworkPhoneFolder), json = name => JSON.parse(readFileSync(resolve(base, name + '.json')));
  assertEvidenceBundleChecksums(base);
  const phone = json('records/session-results'), summary = assertReviewNetworkPhone(json('summary'), phone);
  assertRetainedSourceFiles(root, phone.sourceFiles);
  for (const row of phone.checks) assert.deepEqual(json('records/' + row.phase), row);
  for (const name of reviewNetworkCaptureNames) {
    const size = imageSize(readFileSync(resolve(base, 'captures/' + name + '.jpg')));
    assert.equal(size.type, 'jpg'); assert.equal(size.width, 258); assert.equal(size.height, 566);
  }
  assert.match(readFileSync(resolve(base, 'offline-provider.txt'), 'utf8'), /device is now offline/);
  assert.match(readFileSync(resolve(base, 'online-provider.txt'), 'utf8'), /Network condition changes have been applied\./);
  const disposal = json('disposal');
  for (const key of ['ownedRuntimeAbsent', 'privateSessionAbsent', 'ownedHelperAbsent', 'privateHandoffAbsent',
    'hostClipboardRestored', 'remoteClipboardReplaced', 'providerIdleObserved'])
    assert.equal(disposal[key], true, key);
  assert.equal(disposal.providerUninstallObserved, false); assert.equal(disposal.independentPackageAbsenceProven, false);
  assert.deepEqual(disposal.closedPorts, [5001, 8080, 9000, 9099, 45690, 45691]);
  return summary;
}
