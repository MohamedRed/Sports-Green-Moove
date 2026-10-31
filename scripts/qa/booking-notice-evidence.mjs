import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { assertRetainedSourceFiles } from './retained-source-evidence.mjs';

export const bookingNoticeChecks = [
  'approval-notice-write-conflict-rolls-back-decision-and-capacity',
  'approval-commits-one-notice-and-one-seat-change',
  'approval-replay-does-not-create-extra-notices-or-remove-more-seats',
  'decline-notice-write-conflict-keeps-request-pending',
  'decline-commits-one-notice-without-consuming-capacity',
  'decline-replay-does-not-create-a-second-notice',
  'cancellation-notice-write-conflict-keeps-approved-booking-and-capacity',
  'cancellation-commits-one-driver-notice-and-restores-one-seat',
  'cancellation-replay-cannot-restore-capacity-or-create-notices-twice',
  'inbox-delivers-only-the-intended-parent-and-driver-notices',
  'concurrent-driver-approval-commits-one-decision-notice-and-seat-change',
  'unrelated-records-and-original-claims-remain-unchanged',
];
export function validateBookingNoticeRun(run) {
  assert.equal(run.projectId, 'demo-sgm-local-qa'); assert.match(run.runId, /^[a-f0-9]{32}$/);
  assert.equal(run.scope, 'isolated-booking-decision-and-notification-atomicity-not-phone-ui');
  assert.equal(run.completed, true); assert.equal(run.adminClientClosed, true); assert.equal(run.isolatedEnvironmentDestroyed, true);
  assert.equal(run.protectedRecordCount, 158); assert.deepEqual(run.steps, bookingNoticeChecks.map(id => ({id, status: 'passed'})));
  assert(Number.isFinite(Date.parse(run.testedAt)));
  for (const key of ['physicalDevice', 'nativeUiExecuted', 'pushDeliveryVerified', 'paymentExercised', 'productionWrites'])
    assert.equal(run[key], false, key);
  assert.deepEqual(run.emulatorEndpoints, {host: '127.0.0.1', ports: [9099, 8080, 9000, 5001], closed: true});
  assert.deepEqual(run.observations.map(row => [row.actor, row.notices.length]),
    [['sgm-qa-parent', 2], ['sgm-qa-driver', 1], ['sgm-qa-outsider', 0]]);
  const notices = run.observations.flatMap(row => row.notices); assert.equal(new Set(notices).size, 3);
  assert(notices.every(id => /^bookingDecision_[a-f0-9]{64}$/.test(id)));
  return run;
}
export function validateRetainedBookingNotices(root, source, readFile = readFileSync) {
  const run = validateBookingNoticeRun(JSON.parse(readFile(resolve(root, source))));
  assertRetainedSourceFiles(root, run.sourceFiles); return run;
}
