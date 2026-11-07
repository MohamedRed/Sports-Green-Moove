import assert from 'node:assert/strict';
import { assertIsolatedTunnelSettings } from './browserstack-local-policy.mjs';

export function assertParentPhoneBooking(run, checkpoints, driver, policy) {
  assert.equal(run.scope, 'physical-android-parent-ui-with-isolated-services-and-sdk-peer');
  assert.equal(run.projectId, 'demo-sgm-local-qa'); assert.match(run.runId, /^[a-f0-9]{32}$/);
  assert.equal(run.physicalDevice, true); assert.equal(run.driverNativeUi, false);
  assert.equal(run.paymentExercised, false); assert.equal(run.productionDataWritten, false);
  assert.equal(run.childBookingVerified, false); assert.equal(run.trackingVerified, false);
  assert.equal(run.twoPhoneFlowVerified, false); assert.equal(run.videoCaptured, false);
  assert.equal(run.device.model, 'Google Pixel 8'); assert.equal(run.device.os, 'Android 14');
  assert.match(run.sourceCommit, /^[a-f0-9]{40}$/); assert.match(run.appSha256, /^[a-f0-9]{64}$/);
  assert.deepEqual(run.steps, ['parent-requested', 'parent-saw-approval', 'parent-cancelled']);
  assert.deepEqual(run.captures, ['phone-booking-requested.png', 'phone-booking-approved.png', 'phone-booking-cancelled.png']);
  assertIsolatedTunnelSettings(policy);
  assert.equal(checkpoints.length, 3);
  const first = checkpoints[0];
  for (const [index, phase] of ['requested', 'approved', 'cancelled'].entries()) {
    const current = checkpoints[index];
    assert.equal(current.scope, 'independent-local-persisted-checkpoint-not-native-ui-or-two-phone-proof');
    assert.equal(current.phase, phase); assert.equal(current.status, phase);
    for (const field of ['projectId', 'runId', 'parentUserId', 'parentEmail', 'bookingId', 'tripId', 'driverUserId'])
      assert.equal(current[field], first[field], field);
    assert.equal(current.projectId, run.projectId); assert.equal(current.runId, run.runId);
    assert.deepEqual(current.parentRoles, ['parent']); assert.match(current.parentEmail, /^phone-[a-z0-9-]+@example\.test$/);
    assert.equal(current.driverUserId, 'sgm-qa-driver'); assert.notEqual(current.parentUserId, current.driverUserId);
    assert.equal(current.bookingCount, 1); assert.equal(current.requestReceiptCount, 1); assert.equal(current.seats, 1);
    assert.equal(current.seatsAvailable, phase === 'approved' ? 3 : 4);
    assert.equal(current.paymentExercised, false); assert.equal(current.productionDataWritten, false);
    assert(Number.isFinite(Date.parse(current.recordedAt)));
    if (index > 0) assert(Date.parse(current.recordedAt) > Date.parse(checkpoints[index - 1].recordedAt));
  }
  assert.equal(driver.scope, 'authenticated-local-peer-call-not-driver-native-ui');
  for (const field of ['projectId', 'runId', 'bookingId', 'driverUserId']) assert.equal(driver[field], first[field]);
  assert.deepEqual(driver.response, { bookingId: first.bookingId, status: 'approved' });
  assert(Date.parse(driver.recordedAt) > Date.parse(first.recordedAt));
  assert(Date.parse(driver.recordedAt) < Date.parse(checkpoints[1].recordedAt));
  assert.equal(run.testedAt, checkpoints[2].recordedAt);
  assert.deepEqual(first.notifications, []);
  const approved = { type: 'bookingApproved', userId: first.parentUserId };
  assert.deepEqual(checkpoints[1].notifications, [approved]);
  assert.deepEqual(checkpoints[2].notifications, [approved, { type: 'bookingCancelled', userId: first.driverUserId }]);
  assert.equal(checkpoints[2].cancelledByUserId, first.parentUserId); assert.equal(checkpoints[2].refundStatus, 'notRequired');
}
