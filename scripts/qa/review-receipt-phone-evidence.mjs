import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {imageSize} from 'image-size';
import {assertEvidenceBundleChecksums} from './evidence-bundle-checksums.mjs';
import {assertRetainedSourceFiles} from './retained-source-evidence.mjs';
import {latestMeminfo} from './review-context-replay-process.mjs';

export const reviewReceiptFolder = 'docs/release/evidence/review-receipt-phone-2026-10-30/';
export const reviewReceiptPhases = ['parent-ready', 'receipt-lost', 'retry-ready', 'parent-confirmed', 'parent-restored', 'driver-summary', 'signed-out'];
export const reviewReceiptImages = ['receipt-lost', 'parent-confirmed', 'parent-restored', 'driver-summary', 'driver-requests'];
export function assertReviewReceiptPhone(summary, phone) {
  assert.equal(summary.scope, 'physical-android-controlled-post-commit-reply-loss-not-release');
  assert.equal(summary.runId, phone.runId); assert.match(phone.runId, /^[a-f0-9]{32}$/);
  assert.equal(summary.sourceCommit, 'b56c59f725d913f969cc8b1ec47427b177f9e54f');
  assert.equal(phone.projectId, 'demo-sgm-local-qa'); assert.equal(phone.completed, true);
  for (const key of ['adminClientClosed', 'firestoreClientTerminated', 'sourceFilesUnchanged']) assert.equal(phone[key], true, key);
  assert.equal(phone.fixtureSubmittedRatings, 0); assert.equal(phone.controllerSubmittedRatings, false);
  assert.equal(phone.phoneUiProvenByObserver, false); assert.equal(phone.proxy.failed, false);
  assert.equal(phone.sourceApkSha256, '21d325914327eee4c883c5378d263ec31ba425fb3c628690f4c2c3f866666942');
  assert.equal(summary.sourceApkSha256, phone.sourceApkSha256);
  assert.deepEqual(phone.checks.map(row => row.phase), reviewReceiptPhases);
  for (const [index, row] of phone.checks.entries()) {
    assert.equal(row.status, 'passed'); assert.equal(row.ratingCount, Number(index > 0));
    assert.equal(row.parentRequests, index ? 1 : 2); assert.equal(row.driverRequests, 2);
    assert.equal(row.originalRecordsAndClaimsPreserved, true); assert.equal(row.proxy.failed, false);
    assert.equal(row.originalTimestampAndFieldsPreserved, index > 0); assert.equal(row.phoneUiProvenByObserver, false);
  }
  assert.deepEqual(phone.proxy.attempts.map(row => [row.phase, row.upstreamAcknowledged, row.responseReleased]),
    [['armed', true, false], ['recover', true, true]]);
  assert.equal(new Set(phone.proxy.attempts.map(row => row.ratingId)).size, 1);
  assert(phone.proxy.requests.some(row => row.method === 'listDriverBookingRequests' && row.upstreamStatus === 200));
  assert(phone.proxy.requests.every(row => !row.failed && row.upstreamStatus === 200));
  for (const key of ['phoneUiReviewed', 'storedReplyWithheld', 'singleRatingAfterRetry', 'olderTripRestored',
    'independentProcessRestartProven', 'driverMeanAndCountObserved', 'separateDriverRequestsObserved', 'finalSignOutObserved'])
    assert.equal(summary[key], true, key);
  for (const key of ['realWorldRadioLossProven', 'iosUiExecuted', 'releaseComplete', 'installedBytesIndependentlyVerified',
    'independentPackageAbsenceProven', 'rawRatingTimestampExported', 'productionWrites', 'realPayments']) assert.equal(summary[key], false, key);
  assert.equal(summary.mapRequests, 0); assert.equal(summary.recordCheckpoints, 7);
  return summary;
}
export function validateReviewReceiptPhone(root, reference = {source: reviewReceiptFolder + 'summary.json'}) {
  assert.equal(reference.source, reviewReceiptFolder + 'summary.json');
  const base = resolve(root, reviewReceiptFolder), json = path => JSON.parse(readFileSync(resolve(base, path + '.json')));
  assertEvidenceBundleChecksums(base);
  const phone = json('records/session-results'), summary = assertReviewReceiptPhone(json('summary'), phone);
  assertRetainedSourceFiles(root, phone.sourceFiles);
  for (const row of phone.checks) assert.deepEqual(json('records/' + row.phase), row);
  const pids = ['before', 'stopped', 'reopened'].map(phase => {
    const row = json('process/' + phase); assert.equal(row.runId, phone.runId);
    return latestMeminfo(row, readFileSync(resolve(base, 'process/' + phase + '-ax.txt'), 'utf8'));
  });
  assert(pids[0] && pids[2]); assert.equal(pids[1], null); assert.notEqual(pids[0], pids[2]);
  const times = ['before', 'stopped', 'reopened'].map(phase => Date.parse(json('process/' + phase).observedAt));
  assert(times[0] < times[1] && times[1] < times[2]);
  for (const name of reviewReceiptImages) {
    const size = imageSize(readFileSync(resolve(base, 'captures/' + name + '.jpg')));
    assert.equal(size.type, 'jpg'); assert.equal(size.width, 375); assert.equal(size.height, 833);
  }
  const failed = json('failed-attempt/session-results');
  assert.equal(failed.completed, false); assert.equal(failed.failedCheckpoint, 'driver-summary');
  assert.equal(failed.checks.length, 5); assert.equal(failed.proxy.failed, true); assert.notEqual(failed.runId, phone.runId);
  assertRetainedSourceFiles(root, failed.sourceFiles);
  const disposal = json('disposal');
  for (const key of ['ownedPortsClosed', 'runtimeHandoffAbsent', 'appSessionAbsent', 'helperHandoffAbsent',
    'hostClipboardRestored', 'remoteClipboardReplaced', 'providerIdleObserved']) assert.equal(disposal[key], true, key);
  assert.equal(disposal.independentPackageAbsenceProven, false);
  return summary;
}
