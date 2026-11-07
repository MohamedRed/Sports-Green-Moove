import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {imageSize} from 'image-size';
import {assertEvidenceBundleChecksums} from './evidence-bundle-checksums.mjs';
import {assertRetainedSourceFiles} from './retained-source-evidence.mjs';
import {verifyDirectBookingCheckpoint} from './direct-booking-phone-checkpoints.mjs';
import {bookingReceiptPlan, assertBookingReceiptPhase} from './booking-receipt-checkpoint-plan.mjs';

export const bookingBeforeAckFolder = 'docs/release/evidence/booking-before-ack-phone-2026-10-30/';
export const bookingBeforeAckImages = ['receipt-lost', 'reopened-pending', 'other-card', 'reservation-list'];
export function assertBookingBeforeAck(summary, phone, baseline) {
  const plan = bookingReceiptPlan('before-acknowledgement');
  assert.equal(summary.scope, 'physical-android-controlled-adult-booking-restart-before-acknowledgement-not-release');
  assert.equal(phone.scenario, plan.name); assert.equal(summary.runId, phone.runId);
  assert.equal(phone.projectId, 'demo-sgm-local-qa'); assert.equal(phone.completed, true);
  assert.equal(phone.sourceFilesUnchanged, true); assert.equal(phone.proxy.failed, false);
  assert.equal(summary.controllerSourcesBoundByHash, true);
  for (const file of ['scripts/qa/manual-booking-receipt-loss-session.mjs', 'scripts/qa/booking-receipt-loss-proxy.mjs',
    'scripts/qa/booking-receipt-checkpoint-plan.mjs', 'scripts/qa/direct-booking-phone-checkpoints.mjs',
    'scripts/qa/session-restoration-records.mjs', 'functions/src/domain/bookingIntent.ts'])
    assert.match(phone.sourceFiles[file], /^[a-f0-9]{64}$/);
  assert.equal(phone.adminClientClosed, true); assert.equal(phone.firestoreClientTerminated, true);
  assert.equal(phone.checks.length, 9); assert.equal(summary.recordCheckpoints, 9);
  assert.deepEqual(phone.checks.map(row => row.phase), plan.phases);
  const committed = phone.checks[2], bookingId = committed.result.bookingId;
  for (const [index, row] of phone.checks.entries()) {
    assert.equal(row.runId, phone.runId); assert.equal(row.status, 'passed');
    assert.equal(row.originalRecordsAndClaimsPreserved, true); assert.equal(row.phoneUiProvenByObserver, false);
    assert.equal(row.committedFieldsAndTimestampsUnchanged, index >= 2);
    assertBookingReceiptPhase(plan, row.phase, index, row.proxy);
    assert.deepEqual(row.result, verifyDirectBookingCheckpoint(index < 2 ? 'opened-no-write' : 'confirmed', baseline, row.state, bookingId));
    if (index >= 2) assert.deepEqual(row.state, committed.state);
  }
  assertBookingReceiptPhase(plan, 'signed-out', 8, phone.proxy);
  const attempt = phone.proxy.attempts.filter(row => row.upstreamAcknowledged)[0];
  assert.equal(attempt.phase, 'armed'); assert.equal(attempt.commit.bookingId, bookingId);
  assert.deepEqual([attempt.commit.bookingCount, attempt.commit.receiptCount, attempt.commit.notificationCount], [1, 1, 1]);
  assert(phone.proxy.requests.every(row => !row.failed && row.upstreamStatus === 200));
  for (const key of ['fixtureSubmittedAdultBooking', 'controllerSubmittedBooking', 'phoneUiProvenByObserver',
    'processRestartProvenByObserver', 'realWorldRadioLossProven', 'installedBytesIndependentlyVerified', 'productionWrites', 'realPayments'])
    assert.equal(phone[key], false, key);
  for (const key of ['phoneUiReviewed', 'unconfirmedReplyVisible', 'androidForceStopConfirmed',
    'androidForceStopDisabledAfterConfirmation', 'restartWithoutLogin', 'pendingWithoutResubmission',
    'sameRequestFromTrips', 'reservationsListReviewed', 'finalSignOutObserved', 'hostClipboardRestored',
    'remoteClipboardReplaced', 'providerIdleObserved', 'processRestartBeforeAcknowledgement']) assert.equal(summary[key], true, key);
  for (const key of ['independentPidMeasurement', 'explicitRetryAfterRestart', 'searchScreenRecoveryProven', 'multipleDevicesTested',
    'driverNotificationUiReviewed', 'installedBytesIndependentlyVerified', 'independentPackageAbsenceProven',
    'realWorldRadioLossProven', 'iosUiExecuted', 'releaseComplete', 'productionWrites', 'realPayments']) assert.equal(summary[key], false, key);
  assert.equal(phone.mapRequests, 0); assert.equal(summary.mapRequests, 0);
  assert.equal(phone.sourceApkSha256, '21d325914327eee4c883c5378d263ec31ba425fb3c628690f4c2c3f866666942');
  assert.equal(summary.sourceApkSha256, phone.sourceApkSha256); return summary;
}
export function validateBookingBeforeAck(root, reference = {source: bookingBeforeAckFolder + 'summary.json'}) {
  assert.equal(reference.source, bookingBeforeAckFolder + 'summary.json');
  const base = resolve(root, bookingBeforeAckFolder), json = file => JSON.parse(readFileSync(resolve(base, file + '.json')));
  assertEvidenceBundleChecksums(base);
  const phone = json('records/session-results'), summary = assertBookingBeforeAck(json('summary'), phone, json('records/baseline').baseline);
  assertRetainedSourceFiles(root, phone.sourceFiles);
  for (const row of phone.checks) assert.deepEqual(json('records/' + row.phase), row);
  const times = json('system-ui-observations');
  const ordered = [phone.checks[2].observedAt, times.before, times.confirmation, times.stopped,
    phone.checks[3].observedAt, times.reopened, phone.checks[4].observedAt, phone.checks[5].observedAt].map(Date.parse);
  assert(ordered.every(Number.isFinite)); assert(ordered.every((value, index) => !index || value > ordered[index - 1]));
  for (const name of bookingBeforeAckImages) {
    const crop = imageSize(readFileSync(resolve(base, 'captures/' + name + '.jpg')));
    assert.equal(crop.type, 'jpg'); assert.equal(crop.width, 200); assert.equal(crop.height, 444);
    const original = imageSize(readFileSync(resolve(base, 'original-session-captures/' + name + '.jpg')));
    assert.equal(original.width, 1200); assert.equal(original.height, 596);
  }
  const disposal = json('disposal');
  for (const key of ['ownedPortsClosed', 'runtimeHandoffAbsent', 'appSessionAbsent', 'helperHandoffAbsent']) assert.equal(disposal[key], true);
  return summary;
}
