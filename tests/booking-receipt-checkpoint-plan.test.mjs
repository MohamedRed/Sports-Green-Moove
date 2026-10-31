import assert from 'node:assert/strict';
import test from 'node:test';
import {bookingReceiptPlan, assertBookingReceiptPhase} from '../scripts/qa/booking-receipt-checkpoint-plan.mjs';

const held = {phase: 'lost', failed: false, attempts: [{upstreamAcknowledged: true, responseReleased: false}]};
test('before-acknowledgement restart keeps the original successful reply withheld through all remaining checkpoints', () => {
  const plan = bookingReceiptPlan('before-acknowledgement');
  assert.equal(plan.retryPhase, null); assert.equal(plan.phases.length, 9);
  assert.deepEqual(plan.phases.slice(3, 6), ['process-stopped-unconfirmed', 'process-restarted-unconfirmed', 'reopened-pending']);
  for (let i = 0; i < plan.phases.length; i++)
    assert.doesNotThrow(() => assertBookingReceiptPhase(plan, plan.phases[i], i, i < 2 ? {...held, attempts: []} : held));
});
test('a released receipt, second acknowledged mutation, failed facade or out-of-order checkpoint rejects the new trial', () => {
  const plan = bookingReceiptPlan('before-acknowledgement');
  for (const mutate of [
    value => value.attempts[0].responseReleased = true,
    value => value.attempts.push({upstreamAcknowledged: true, responseReleased: false}),
    value => value.failed = true,
    value => value.phase = 'recover',
  ]) {
    const value = structuredClone(held); mutate(value);
    assert.throws(() => assertBookingReceiptPhase(plan, plan.phases[4], 4, value));
  }
  assert.throws(() => assertBookingReceiptPhase(plan, plan.phases[5], 4, held));
});
test('the original explicit retry scenario keeps its nine checkpoints and its exact release boundary', () => {
  const plan = bookingReceiptPlan(); assert.equal(plan.name, 'after-acknowledgement');
  assert.equal(plan.retryPhase, 'retry-ready'); assert.equal(plan.phases[4], 'confirmed');
  for (let i = 0; i < plan.phases.length; i++) {
    const value = i < 2 ? {...held, attempts: []} : i < 4 ? held
      : {phase: 'recover', failed: false, attempts: [...held.attempts, {upstreamAcknowledged: true, responseReleased: true}]};
    assert.doesNotThrow(() => assertBookingReceiptPhase(plan, plan.phases[i], i, value));
  }
  assert.throws(() => assertBookingReceiptPhase(plan, 'confirmed', 4, held));
});
test('unknown or mutated plans cannot silently select a different test scope', () => {
  assert.throws(() => bookingReceiptPlan('other'));
  const plan = bookingReceiptPlan('before-acknowledgement'); plan.retryPhase = 'receipt-lost';
  assert.throws(() => assertBookingReceiptPhase(plan, plan.phases[2], 2, held));
  assert.equal(bookingReceiptPlan('before-acknowledgement').retryPhase, null);
});
