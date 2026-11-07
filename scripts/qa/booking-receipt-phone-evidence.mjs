import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {imageSize} from 'image-size';
import {assertEvidenceBundleChecksums} from './evidence-bundle-checksums.mjs';
import {assertRetainedSourceFiles} from './retained-source-evidence.mjs';
import {latestMeminfo} from './review-context-replay-process.mjs';
import {verifyDirectBookingCheckpoint} from './direct-booking-phone-checkpoints.mjs';

export const bookingReceiptFolder = 'docs/release/evidence/booking-receipt-phone-2026-10-30/';
export const bookingReceiptPhases = ['parent-ready', 'confirmation-open', 'receipt-lost', 'retry-ready', 'confirmed', 'reopened', 'process-restarted', 'other-card', 'signed-out'];
export const bookingReceiptImages = ['receipt-lost', 'confirmed', 'process-restarted', 'other-card', 'reservation-list'];
export function assertBookingReceiptPhone(summary, phone, baseline) {
  assert.equal(summary.scope, 'physical-android-controlled-adult-booking-reply-loss-not-release');
  assert.equal(summary.runId, phone.runId); assert.equal(phone.projectId, 'demo-sgm-local-qa'); assert.equal(phone.completed, true);
  assert.equal(phone.sourceFilesUnchanged, true); assert.equal(phone.proxy.failed, false);
  assert.equal(phone.adminClientClosed, true); assert.equal(phone.firestoreClientTerminated, true);
  for (const key of ['fixtureSubmittedAdultBooking', 'controllerSubmittedBooking', 'phoneUiProvenByObserver',
    'processRestartProvenByObserver', 'realWorldRadioLossProven', 'installedBytesIndependentlyVerified', 'productionWrites', 'realPayments'])
    assert.equal(phone[key], false, key);
  assert.equal(phone.mapRequests, 0); assert.equal(phone.sourceApkSha256, '21d325914327eee4c883c5378d263ec31ba425fb3c628690f4c2c3f866666942');
  assert.equal(summary.sourceApkSha256, phone.sourceApkSha256); assert.equal(summary.recordCheckpoints, 9);
  assert.deepEqual(phone.checks.map(row => row.phase), bookingReceiptPhases);
  const firstCommitted = phone.checks[2].state, bookingId = phone.checks[2].result.bookingId;
  for (const [index, row] of phone.checks.entries()) {
    assert.equal(row.runId, phone.runId); assert.equal(row.status, 'passed'); assert.equal(row.proxy.failed, false);
    assert.equal(row.phoneUiProvenByObserver, false); assert.equal(row.originalRecordsAndClaimsPreserved, true);
    assert.equal(row.committedFieldsAndTimestampsUnchanged, index >= 2);
    assert.deepEqual(row.result, verifyDirectBookingCheckpoint(index < 2 ? 'opened-no-write' : 'confirmed', baseline, row.state, bookingId));
    if (index >= 2) assert.deepEqual(row.state, firstCommitted);
  }
  const attempts = phone.proxy.attempts.filter(row => row.upstreamAcknowledged);
  assert.equal(attempts.length, 2); assert.deepEqual(attempts.map(row => [row.phase, row.responseReleased]), [['armed', false], ['recover', true]]);
  assert.deepEqual(attempts[0].commit, attempts[1].commit); assert.equal(attempts[0].requestSha256, attempts[1].requestSha256);
  assert.equal(attempts[0].commit.bookingId, bookingId);
  assert.deepEqual([attempts[0].commit.bookingCount, attempts[0].commit.receiptCount, attempts[0].commit.notificationCount], [1, 1, 1]);
  assert(phone.proxy.requests.every(row => !row.failed && row.upstreamStatus === 200));
  for (const key of ['phoneUiReviewed', 'sendingUiCaptured', 'unconfirmedReplyVisible', 'explicitRetryConfirmed',
    'pendingRequestAfterRestart', 'sameRequestFromTrips', 'reservationsListReviewed', 'finalSignOutObserved',
    'hostClipboardRestored', 'remoteClipboardReplaced', 'providerIdleObserved', 'independentProcessRestartProven']) assert.equal(summary[key], true, key);
  for (const key of ['processRestartBeforeAcknowledgement', 'searchScreenRecoveryProven', 'multipleDevicesTested',
    'driverNotificationUiReviewed', 'installedBytesIndependentlyVerified', 'independentPackageAbsenceProven', 'realWorldRadioLossProven',
    'iosUiExecuted', 'releaseComplete', 'productionWrites', 'realPayments']) assert.equal(summary[key], false, key);
  assert.equal(summary.mapRequests, 0); return summary;
}
export function validateBookingReceiptPhone(root, reference = {source: bookingReceiptFolder + 'summary.json'}) {
  assert.equal(reference.source, bookingReceiptFolder + 'summary.json');
  const base = resolve(root, bookingReceiptFolder), json = path => JSON.parse(readFileSync(resolve(base, path + '.json')));
  assertEvidenceBundleChecksums(base);
  const phone = json('records/session-results'), summary = assertBookingReceiptPhone(json('summary'), phone, json('records/baseline').baseline);
  assertRetainedSourceFiles(root, phone.sourceFiles);
  for (const row of phone.checks) assert.deepEqual(json('records/' + row.phase), row);
  const pids = ['before', 'stopped', 'reopened'].map(phase => {
    const row = json('process/' + phase); assert.equal(row.runId, phone.runId);
    return latestMeminfo(row, readFileSync(resolve(base, 'process/' + phase + '-ax.txt'), 'utf8'));
  });
  assert(pids[0] && pids[2]); assert.equal(pids[1], null); assert.notEqual(pids[0], pids[2]);
  const times = ['before', 'stopped', 'reopened'].map(phase => Date.parse(json('process/' + phase).observedAt));
  assert(times[0] < times[1] && times[1] < times[2]);
  assert.deepEqual(summary.deviceRectangle, {x: 484, y: 105, width: 200, height: 444});
  for (const name of bookingReceiptImages) {
    const crop = imageSize(readFileSync(resolve(base, 'captures/' + name + '.jpg')));
    assert.equal(crop.type, 'jpg'); assert.equal(crop.width, 200); assert.equal(crop.height, 444);
    const original = imageSize(readFileSync(resolve(base, 'original-session-captures/' + name + '.jpg')));
    assert.equal(original.width, 1200); assert.equal(original.height, 596);
  }
  const disposal = json('disposal');
  for (const key of ['ownedPortsClosed', 'runtimeHandoffAbsent', 'appSessionAbsent', 'helperHandoffAbsent']) assert.equal(disposal[key], true, key);
  return summary;
}
