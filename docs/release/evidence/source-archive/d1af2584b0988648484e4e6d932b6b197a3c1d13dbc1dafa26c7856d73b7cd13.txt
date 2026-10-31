import assert from 'node:assert/strict';

const plans = {
  'after-acknowledgement': {
    phases: ['parent-ready', 'confirmation-open', 'receipt-lost', 'retry-ready', 'confirmed',
      'reopened', 'process-restarted', 'other-card', 'signed-out'],
    retryPhase: 'retry-ready',
  },
  'before-acknowledgement': {
    phases: ['parent-ready', 'confirmation-open', 'receipt-lost', 'process-stopped-unconfirmed',
      'process-restarted-unconfirmed', 'reopened-pending', 'other-card', 'reservation-list', 'signed-out'],
    retryPhase: null,
  },
};
export function bookingReceiptPlan(name = 'after-acknowledgement') {
  assert(Object.hasOwn(plans, name), 'Unknown booking restart scenario');
  return {name, ...structuredClone(plans[name])};
}
export function assertBookingReceiptPhase(plan, phase, index, receipt) {
  assert.deepEqual(plan, bookingReceiptPlan(plan.name));
  assert.equal(phase, plan.phases[index]); assert.equal(receipt.failed, false);
  const acknowledgements = receipt.attempts.filter(row => row.upstreamAcknowledged);
  if (index < 2) {assert.equal(acknowledgements.length, 0); return;}
  assert.equal(acknowledgements[0]?.responseReleased, false);
  if (plan.name === 'before-acknowledgement' || index < 4) {
    assert.equal(receipt.phase, 'lost'); assert.equal(acknowledgements.length, 1);
  } else {
    assert.equal(receipt.phase, 'recover'); assert.equal(acknowledgements.length, 2);
    assert.equal(acknowledgements[1].responseReleased, true);
  }
}
