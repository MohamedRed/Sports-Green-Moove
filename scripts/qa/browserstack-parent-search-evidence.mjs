import assert from 'node:assert/strict';
import { assertIsolatedTunnelSettings } from './browserstack-local-policy.mjs';

export const parentSearchScope = 'physical-android-parent-search-validation-with-isolated-services';
export const parentSearchCaptures = Object.freeze(['phone-session-restored.png',
  'phone-child-two-seats-consent.png', 'phone-child-consent-reset.png', 'phone-child-incomplete-search.png']);

export function assertParentPhoneSearch(run, fixture, checkpoint, connection) {
  assert.equal(run.scope, parentSearchScope);
  assert.equal(run.method, 'manual-native-ui-with-independent-persisted-checkpoint');
  assert.equal(run.projectId, 'demo-sgm-local-qa');
  assert.match(run.runId, /^[a-f0-9]{32}$/);
  assert.match(run.sourceCommit, /^[a-f0-9]{40}$/);
  assert.match(run.appSha256, /^[a-f0-9]{64}$/);
  assert.equal(run.physicalDevice, true);
  assert.equal(run.device.model, 'Google Pixel 8');
  assert.equal(run.device.os, 'Android 14');
  assert.deepEqual(run.captures, parentSearchCaptures);
  assert.deepEqual(run.steps, ['parent-session-relaunch', 'child-two-seat-selection',
    'guardian-consent-reset', 'incomplete-search-blocked']);
  for (const flag of ['driverNativeUi', 'paymentExercised', 'productionDataWritten',
    'childBookingVerified', 'guardianConsentEventVerified', 'trackingVerified',
    'twoPhoneFlowVerified', 'videoCaptured', 'realMapsVerified']) assert.equal(run[flag], false, flag);
  for (const record of [fixture, checkpoint]) {
    assert.equal(record.projectId, run.projectId); assert.equal(record.runId, run.runId);
    assert.deepEqual(record.parentRoles, ['parent']);
    assert.match(record.parentEmail, /^phone-child-[a-z0-9-]+@example\.test$/);
    assert.equal(record.parentUserId, run.parentUserId);
    assert.equal(record.paymentExercised, false); assert.equal(record.productionDataWritten, false);
  }
  assert.equal(fixture.scope, 'sdk-prepared-guardian-fixture-not-consent-ui-proof');
  assert.equal(checkpoint.scope, 'persisted-negative-search-checkpoint-not-guardian-consent-or-completed-booking-proof');
  assert.equal(fixture.parentEmail, checkpoint.parentEmail);
  assert.equal(checkpoint.children.length, 1);
  assert.equal(checkpoint.children[0].id, fixture.childId);
  assert.equal(checkpoint.children[0].displayName, fixture.childDisplayName);
  assert.deepEqual(checkpoint.children[0].guardianUserIds, [run.parentUserId]);
  assert.equal(checkpoint.bookingCount, 0); assert.equal(checkpoint.requestReceiptCount, 0);
  const times = [fixture.preparedAt, checkpoint.recordedAt, run.testedAt].map(Date.parse);
  assert(times.every(Number.isFinite)); assert(times[0] <= times[1] && times[1] === times[2]);
  assert.equal(connection.projectId, run.projectId); assert.equal(connection.runId, run.runId);
  assertIsolatedTunnelSettings(connection.settings);
}
