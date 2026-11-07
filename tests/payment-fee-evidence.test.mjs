import assert from 'node:assert/strict';
import test from 'node:test';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { validatePaymentFeeEvidence } from '../scripts/qa/payment-fee-evidence.mjs';

const record = {source: 'docs/release/evidence/payment-fees-2026-10-23/summary.json', checkedAt: '2026-10-23',
  checksums: 'docs/release/evidence/payment-fees-2026-10-23/artifact-sha256.json'};
test('fee recovery binds eighteen isolated preparation cases and exact source without claiming live payments', () => {
  const result = validatePaymentFeeEvidence(process.cwd(), record);
  assert.equal(result.financialCasesPassed, 78); assert.equal(result.realPayments, false);
});
for (const key of ['nativeApprovalRegressionExecuted', 'realPayments', 'realRefunds', 'physicalPaymentsAccepted', 'productionWrites', 'newMediaPublished', 'releaseComplete'])
  test('payment evidence cannot promote ' + key, t => {
    const root = mkdtempSync(resolve(tmpdir(), 'sgm-fee-proof-')); t.after(() => rmSync(root, {recursive: true, force: true}));
    const base = dirname(record.source); cpSync(base, resolve(root, base), {recursive: true});
    const path = resolve(root, record.source), row = JSON.parse(readFileSync(path)); row[key] = true;
    writeFileSync(path, JSON.stringify(row)); assert.throws(() => validatePaymentFeeEvidence(root, record));
  });
test('the payment preparation test and retained evidence are part of the existing smoke gate', () => {
  const scripts = JSON.parse(readFileSync('package.json')).scripts;
  assert(scripts['test:stripe-webhook-flow'].includes('tests/ride-payment-preparation-flow.test.ts'));
  const workflow = readFileSync('.github/workflows/web-integration-smoke.yml', 'utf8');
  for (const name of ['tests/ride-payment-preparation-flow.test.ts', 'tests/payment-fee-evidence.test.mjs'])
    assert.equal(workflow.split('"' + name + '"').length - 1, 2);
  assert(workflow.includes('npm run test:stripe-webhook-flow && node --test tests/payment-fee-evidence.test.mjs'));
});
