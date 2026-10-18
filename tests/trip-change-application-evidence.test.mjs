import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { content } from '../partner-portal/content.mjs';

const root = new URL('../', import.meta.url);
const base = 'docs/release/evidence/local-trip-change-application-2026-10-16/';
const read = (path) => readFileSync(new URL(path, root), 'utf8');
const json = (name) => JSON.parse(read(base + name));

test('actual isolated application preserves original invoices and records unsettled balances', () => {
  const run = json('services.json'), result = run.tripApplication;
  assert.equal(run.projectId, 'demo-sgm-local-qa'); assert.equal(run.scope, 'local-emulated-services-not-phone-ui');
  assert.equal(run.runId, 'b1eb4082f0c9bad923b854ee0dc28c20'); assert.equal(run.testedAt, '2026-10-16T20:29:04.849Z');
  assert.equal(run.steps.length, 23); assert(run.steps.every((step) => step.status === 'passed'));
  assert(run.steps.some((step) => step.id === 'trip-change-application'));
  assert.equal(result.method, 'authenticated-local-application-callables-with-explicit-injected-route-provider');
  assert.equal(result.receipt.status, 'applied'); assert.equal(result.receipt.actorUserId, 'sgm-qa-driver');
  assert.equal(result.receipt.tripId, result.tripId); assert.equal(result.receipt.bookingIds.length, 1);
  assert.equal(result.receipt.settlementRequiredCount, 0);
  for (const field of ['proposalId', 'proposalRevision', 'quoteId']) assert.match(result.receipt[field], /^[a-f0-9]{64}$/);
  assert.equal(result.savedTrip.distanceKm, 12); assert.equal(result.savedTrip.routeDurationSeconds, 900);
  assert.equal(result.savedTrip.co2SavedKgEstimate, 6.4); assert.equal(result.savedTrip.regionGeohash, 'u1529757wv');
  assert.deepEqual(result.balances, [
    { agreedPriceCents: 400, originalInvoiceCents: 250, balanceCents: 150, state: 'paymentDue' },
    { agreedPriceCents: 100, originalInvoiceCents: 250, balanceCents: -150, state: 'refundDue' },
  ]);
  for (const flag of ['originalInvoicesPreserved', 'paidBalanceBlocksStart', 'cancelledBalancesClosedWithoutRefundClaim',
    'duplicateApplicationIdempotent', 'staleAndExpiredQuotesDenied', 'guardianChangeInvalidatesQuote', 'providerFailureLeavesNoQuote',
    'changedSourceDuringQuoteRejected', 'foreignDriverDenied', 'competingApplicationsSingleWinner', 'unpaidEditedTripBlockedUntilPayment',
    'syntheticRouteQuote', 'syntheticPaymentEvents']) assert.equal(result[flag], true, flag);
  assert.equal(Object.keys(result.fence).length, 12); assert(Object.values(result.fence).every((value) => value === true));
  for (const flag of ['nativeUi', 'liveMaps', 'livePayment', 'adjustmentExecutionImplemented', 'refundIssued', 'productionDeployed'])
    assert.equal(result[flag], false, flag);
});

test('unit, rules and exact raw bytes are preserved without promoting synthetic evidence', () => {
  for (const [name, count] of [['unit.json', 172], ['rules.json', 162]]) {
    const run = json(name); assert.equal(run.success, true); assert.equal(run.numTotalTests, count);
    assert.equal(run.numPassedTests, count); assert.equal(run.numFailedTests, 0);
    assert(run.testResults.every((suite) => suite.status === 'passed'));
  }
  assert.equal(json('rules.json').testResults.find((suite) => suite.name.endsWith('/trip-change-rules.test.ts')).assertionResults.length, 80);
  const hashes = json('artifact-sha256.json'); assert.equal(Object.keys(hashes).length, 3);
  for (const [name, hash] of Object.entries(hashes)) assert.equal(createHash('sha256')
    .update(readFileSync(new URL(base + name, root))).digest('hex'), hash, name);
  assert.match(read(base + 'README.md'), /EADDRINUSE/); assert.match(read(base + 'README.md'), /not deployed to production/);
  assert.match(read(base + 'README.md'), /not a real payment/);
});

test('current source requires atomic application, owned invoice attempts and CI coverage', () => {
  const index = read('functions/src/index.ts');
  for (const name of ['getTripChangeApplicationQuote', 'applyTripChanges']) assert(index.includes(name));
  const application = read('functions/src/services/tripChangeApplication.ts');
  for (const term of ['changeStillCurrent', 'tripChangeBookingPrice', 'tripChangeQuotes', 'tripChangeBalances',
    'settlementRequiredCount', 'geohashForLocation', 'estimateCo2SavedKg', 'transaction.create']) assert(application.includes(term));
  const payment = read('functions/src/callables/payments.ts');
  assert(payment.includes('paymentIntents.retrieve(prepared.existingIntentId)'));
  assert(payment.includes('prepareRidePayment')); assert(payment.includes('finishRidePayment'));
  const runner = read('scripts/qa/run-local-flows.mjs');
  assert(runner.includes('result.steps.length, 24')); assert(runner.includes('result.tripApplication?.receipt.status'));
  const workflow = read('.github/workflows/web-integration-smoke.yml');
  assert.equal(workflow.split('"tests/trip-change-application-evidence.test.mjs"').length - 1, 2);
  assert.match(workflow, /^\s+run: node --test[^\n]*\btests\/trip-change-application-evidence\.test\.mjs(?:\s|$)/m);
});

test('private progress separates simulated editing screens from full native replay and money movement', () => {
  const flow = content.flows.find((item) => item.id === 'publication');
  const current = 'docs/release/evidence/local-trip-change-native-2026-10-17/';
  assert.equal(flow.status, 'partial');
  assert.equal(flow.source, 'docs/release/evidence/local-trip-consent-recovery-native-2026-10-17/README.md');
  assert.equal(flow.local.source, current + 'services.json'); assert(flow.local.groups.includes('trip-change-application'));
  assert.equal(flow.ui.source, 'docs/release/evidence/local-trip-consent-recovery-native-2026-10-17/completed/results.json');
  assert.match(flow.remaining, /historique et les brouillons après fermeture/);
  assert.match(flow.remaining, /paiements et remboursements réels/);
  assert.match(flow.remaining, /téléphone/); assert.match(flow.remaining, /pas encore en ligne/i);
  assert(content.updates.some((item) => /changements confirmés s’appliquent/.test(item.title)));
  assert(flow.local.checks.some((item) => /Aucun paiement ni remboursement réel/.test(item)));
});
