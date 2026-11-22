import assert from 'node:assert/strict';

export function assertBookingUiLoss(result, runId) {
  assert.match(runId, /^[a-f0-9]{32}$/);
  assert.equal(result.projectId, 'demo-sgm-local-qa'); assert.equal(result.runId, runId);
  assert.equal(result.scope, 'native-search-ui-with-real-booking-sdk-and-stubbed-matching');
  assert.equal(result.completed, true); assert.equal(result.livePayment, false); assert.equal(result.productionDeployed, false);
  assert.equal(result.bookingCount, 1); assert.equal(result.receiptCount, 1);
  const { ui, attempts } = result;
  assert.equal(ui.projectId, result.projectId); assert.equal(ui.runId, runId); assert.equal(ui.scope, result.scope);
  for (const key of ['completed', 'sendingObservedBeforeDispatch', 'unconfirmedReplyVisible', 'retryActionVisible',
    'pendingIdentityPersisted', 'confirmedVisible', 'secondSubmissionActionAbsent', 'staleCallbackIgnored',
    'pendingClearedAfterAcknowledgement']) assert.equal(ui[key], true, key);
  assert.equal(ui.sdkCalls, 2); assert.equal(attempts.length, 2);
  assert.equal(attempts[0].number, 1); assert.equal(attempts[1].number, 2);
  assert.equal(attempts[0].acknowledgementDropped, true); assert.equal(attempts[1].acknowledgementDropped, false);
  assert(attempts.every((attempt) => attempt.upstreamStatus === 200));
  const original = attempts[0].commit;
  assert.equal(original.bookingCount, 1); assert.equal(original.receiptCount, 1);
  assert.equal(typeof ui.bookingId, 'string'); assert(ui.bookingId.length > 0);
  assert.equal(original.bookingId, ui.bookingId); assert.equal(original.clientRequestId, ui.clientRequestId);
  assert.match(ui.clientRequestId, /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/);
  assert(Number.isSafeInteger(original.createdAtMillis) && original.createdAtMillis > 0);
}
