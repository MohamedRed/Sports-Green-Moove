import assert from 'node:assert/strict';
import test from 'node:test';
import { resolve } from 'node:path';
import { content } from '../partner-portal/content.mjs';
import { validatePayoutAccountingEvidence } from '../scripts/qa/payout-accounting-evidence.mjs';
const root = resolve(import.meta.dirname, '..');

test('paired accounting regressions pass without promoting money, native or release evidence', () => {
  const report = validatePayoutAccountingEvidence(root, content);
  assert.equal(report.financialCasesPassed, 60); assert.equal(report.releaseComplete, false);
});
test('dated accounting and failed replay history cannot silently disappear when the current blocker changes', () => {
  const changed = structuredClone(content); changed.updates = changed.updates.filter(item => !item.source?.includes('payout-accounting-2026-10-23'));
  assert.throws(() => validatePayoutAccountingEvidence(root, changed));
});
test('new accounting proof cannot relabel the older payment screenshots', () => {
  const changed = structuredClone(content); changed.flows.find(item => item.id === 'payments').checkedAt = '2026-10-23';
  assert.throws(() => validatePayoutAccountingEvidence(root, changed));
});
