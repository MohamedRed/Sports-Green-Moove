import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { content } from '../partner-portal/content.mjs';

const root = new URL('../', import.meta.url);
const base = 'docs/release/evidence/local-trip-supplement-2026-10-16/';
const read = (path) => readFileSync(new URL(path, root), 'utf8');
const json = (name) => JSON.parse(read(base + name));

test('actual isolated supplement services preserve invoices and credit exactly the agreed differences', () => {
  const run = json('services.json'), result = run.tripSupplement;
  assert.equal(run.projectId, 'demo-sgm-local-qa'); assert.equal(run.scope, 'local-emulated-services-not-phone-ui');
  assert.equal(run.runId, '9e0b39d7cfd39ef1e1998b4370f9fc34'); assert.equal(run.testedAt, '2026-10-16T21:04:23.187Z');
  assert.equal(run.steps.length, 24); assert(run.steps.every((step) => step.status === 'passed'));
  assert(run.steps.some((step) => step.id === 'trip-change-supplement'));
  assert.equal(result.method, 'actual-local-transactional-payment-services-with-explicit-synthetic-provider');
  assert.equal(result.originalInvoiceCents, 250); assert.deepEqual(result.supplementsCents, [150, 150]);
  assert.equal(result.finalPaidCents, 550); assert.equal(result.finalReceiptCount, 3); assert.equal(result.firstSettlementLedgerCount, 4);
  for (const flag of ['concurrentCreatesOneIntent', 'duplicateEventsOneCredit', 'originalInvoicePreserved',
    'delayedOriginalEventPreservesTotal', 'paidStateNotDowngraded', 'settledBalancePermitsStart',
    'cancelledBookingClosedAndRefundPending', 'lostReplyReusesFrozenFeeAndIntent', 'mismatchedProviderResponseDeniedBeforeReconciliation',
    'agedUnknownAttemptBlocked', 'authenticatedStatusScoped', 'providerSynthetic']) assert.equal(result[flag], true, flag);
  assert.equal(Object.keys(result.edges).length, 7); assert(Object.values(result.edges).every((value) => value === true));
  for (const flag of ['nativeUi', 'livePayment', 'refundIssued', 'refundExecutionImplemented', 'productionDeployed']) assert.equal(result[flag], false, flag);
});

test('raw reports preserve failed races, complete successful suites and their exact bytes', () => {
  for (const [name, count] of [['unit.json', 189], ['rules.json', 182], ['webhook.json', 14]]) {
    const run = json(name); assert.equal(run.success, true); assert.equal(run.numTotalTests, count);
    assert.equal(run.numPassedTests, count); assert.equal(run.numFailedTests, 0);
    assert(run.testResults.every((suite) => suite.status === 'passed'));
  }
  const earlier = json('services-attempt-one.json');
  assert.equal(earlier.steps.length, 24); assert.equal(earlier.steps.filter((step) => step.status === 'failed').length, 1);
  assert.equal(earlier.steps.find((step) => step.id === 'trip-cancellation').status, 'failed');
  assert.equal(earlier.steps.find((step) => step.id === 'trip-change-supplement').status, 'passed');
  assert.equal(json('rules.json').testResults.find((suite) => suite.name.endsWith('/trip-change-rules.test.ts')).assertionResults.length, 100);
  const hashes = json('artifact-sha256.json'); assert.equal(Object.keys(hashes).length, 5);
  for (const [name, hash] of Object.entries(hashes)) assert.equal(createHash('sha256')
    .update(readFileSync(new URL(base + name, root))).digest('hex'), hash, name);
  const report = read(base + 'README.md');
  for (const phrase of ['not claimed fixed', 'not a real payment', 'Not deployed to production', 'refund execution']) assert(report.includes(phrase));
  assert(!read('scripts/qa/local-trip-cancellation-races.mjs').includes("['ABORTED', 'FAILED_PRECONDITION', 'INTERNAL']"));
});

test('CI requires the new actual service scenario, invoice contracts and protected receipt collection', () => {
  const index = read('functions/src/index.ts');
  for (const name of ['getTripChangePaymentStatus', 'createTripChangePaymentIntent']) assert(index.includes(name));
  assert(read('functions/src/services/stripeReconciliation.ts').includes('ridePaymentReceipts'));
  assert(read('functions/src/services/stripeReconciliation.ts').includes('reconcileTripChangePayment'));
  assert(read('functions/src/services/tripChangePaymentProvider.ts').indexOf('if (!matchesSupplementIntent') <
    read('functions/src/services/tripChangePaymentProvider.ts').indexOf('const result = await reconcileTripChangePayment'));
  assert(read('scripts/qa/local-flow-suite.mjs').includes("check('trip-change-supplement'"));
  assert(read('scripts/qa/run-local-flows.mjs').includes('result.steps.length, 24'));
  assert(read('tests/trip-change-rules.test.ts').includes('ridePaymentReceipts'));
  const workflow = read('.github/workflows/web-integration-smoke.yml');
  assert.equal(workflow.split('"tests/trip-supplement-evidence.test.mjs"').length - 1, 2);
  assert.equal(workflow.split('"tests/helpers/**"').length - 1, 2);
  assert.match(workflow, /^\s+run: node --test[^\n]*\btests\/trip-supplement-evidence\.test\.mjs(?:\s|$)/m);
});

test('private progress calls the payments simulated and retains older screen evidence and unfinished refunds', () => {
  const flow = content.flows.find((item) => item.id === 'payments');
  assert.equal(flow.status, 'partial'); assert.equal(flow.checkedAt, '2026-10-18');
  const latest = 'docs/release/evidence/local-payment-confirmation-2026-10-18/';
  assert.equal(flow.source, latest + 'README.md'); assert.equal(flow.local.source, latest + 'services.json');
  assert.deepEqual(flow.local.groups, ['ride-payment-confirmation']); assert.match(flow.summary, /essais locaux/);
  assert(read(latest + 'README.md').includes('../local-trip-supplement-2026-10-16/README.md'));
  assert.match(flow.images[0].alt, /11 octobre/); assert.match(flow.remaining, /écrans/);
  assert.match(flow.remaining, /remboursements/); assert.match(flow.remaining, /paiements réels sur téléphone/);
  assert(content.updates.some((item) => item.flow === 'payments' && /suppléments/.test(item.title)));
  assert(flow.local.checks.some((item) => /Aucun paiement ni remboursement réel/.test(item)));
});
