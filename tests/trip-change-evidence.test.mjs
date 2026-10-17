import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { content } from '../partner-portal/content.mjs';

const root = new URL('../', import.meta.url);
const base = 'docs/release/evidence/local-trip-change-consent-2026-10-16/';
const read = (path) => readFileSync(new URL(path, root), 'utf8');
const json = (name) => JSON.parse(read(base + name));

test('local consent uses two real isolated parents, exact proposed terms and unchanged original records', () => {
  const run = json('services.json');
  assert.equal(run.projectId, 'demo-sgm-local-qa'); assert.equal(run.scope, 'local-emulated-services-not-phone-ui');
  assert.equal(run.testedAt.slice(0, 10), '2026-10-16'); assert.match(run.runId, /^[a-f0-9]{32}$/);
  assert.equal(run.runId, '4d93d74f2e29613df25a7fa878006ff6'); assert.equal(run.testedAt, '2026-10-16T19:43:49.389Z');
  assert.equal(run.steps.length, 22); assert(run.steps.every((step) => step.status === 'passed'));
  assert(run.steps.some((step) => step.id === 'trip-change-parent-confirmation'));
  const result = run.tripChanges;
  assert.equal(result.method, 'authenticated-local-callables-with-independent-persisted-checks');
  assert.equal(result.parentCount, 2); assert.equal(result.bookingCount, 4); assert.equal(result.acceptedParentCount, 2);
  assert.equal(result.confirmedStatus, 'confirmed'); assert.equal(result.finalStatus, 'withdrawn');
  assert.equal(result.confirmationNotificationCount, 5);
  assert.equal(result.originalTerms.priceCents, 250); assert.equal(result.proposedTerms.priceCents, 400);
  assert.notDeepEqual(result.originalTerms.origin, result.proposedTerms.origin);
  assert.notEqual(result.originalTerms.departureAt, result.proposedTerms.departureAt);
  for (const flag of ['originalTripAndBookingsPreserved', 'repeatedRequestsIdempotent', 'parentViewsScoped',
    'pendingBookingApprovalPaymentAndStartDenied', 'syntheticPaymentMetadata']) assert.equal(result[flag], true);
  for (const flag of ['nativeUi', 'applicationImplemented', 'livePayment', 'refundIssued', 'productionDeployed']) assert.equal(result[flag], false);
  const { concurrentProposalWinners, ...edges } = result.edges;
  assert.equal(concurrentProposalWinners, 1); assert.equal(Object.keys(edges).length, 14);
  assert(Object.values(edges).every((value) => value === true));
  for (const name of ['guardianRevocationInvalidatesPriorConsent', 'cancellationClosesProposal', 'corruptRevisionRejected',
    'omittedParentRejected', 'latePaymentInvalidatesProposal', 'emptyTripDoesNotApplyWithoutIntegration']) assert.equal(edges[name], true);
});

test('backend contract and complete rules reports retain their actual scope and original bytes', () => {
  for (const [file, count] of [['unit.json', 154], ['rules.json', 102]]) {
    const run = json(file);
    assert.equal(run.numTotalTests, count); assert.equal(run.numPassedTests, count); assert.equal(run.numFailedTests, 0);
    assert.equal(run.success, true); assert(run.testResults.every((suite) => suite.status === 'passed'));
  }
  assert.equal(json('unit.json').testResults.find((suite) => suite.name.endsWith('/trip-change-contract.test.ts')).assertionResults.length, 15);
  assert.equal(json('rules.json').testResults.find((suite) => suite.name.endsWith('/trip-change-rules.test.ts')).assertionResults.length, 20);
  const hashes = json('artifact-sha256.json'); assert.equal(Object.keys(hashes).length, 3);
  for (const [name, hash] of Object.entries(hashes)) assert.equal(createHash('sha256')
    .update(readFileSync(new URL(base + name, root))).digest('hex'), hash, name);
});

test('current server wiring preserves the original flow while making parent consent mandatory to the pending stage', () => {
  const index = read('functions/src/index.ts');
  for (const name of ['getTripChangePreview', 'proposeTripChanges', 'getTripChangeReview', 'respondToTripChanges', 'withdrawTripChanges'])
    assert(index.includes(name));
  for (const name of ['bookings', 'rideStart']) assert(read(`functions/src/callables/${name}.ts`).includes('pendingChangeId'));
  assert(read('functions/src/services/ridePaymentPreparation.ts').includes('pendingChangeId'));
  assert.match(read('functions/src/domain/matching.ts'), /if \(trip.pendingChangeId\) return false/);
  assert.match(read('functions/src/services/tripCancellation.ts'), /status: "cancelled", updatedAt: now/);
  const state = read('functions/src/services/tripChangeState.ts');
  assert.match(state, /child.updateTime/); assert.match(state, /Current guardian authority is required/);
  assert.match(state, /applied: change.status === "applied", applicationImplemented: true/);
  assert.match(state, /state.revision === change.expectedRevision/);
  assert.match(read('scripts/qa/run-local-flows.mjs'), /result.steps.length, 24/);
  assert.match(read('scripts/qa/run-local-flows.mjs'), /result.tripChanges\?\.acceptedParentCount, 2/);
  const workflow = read('.github/workflows/web-integration-smoke.yml');
  assert.equal(workflow.split('"tests/trip-change-rules.test.ts"').length - 1, 2);
  assert.equal(workflow.split('"tests/trip-change-evidence.test.mjs"').length - 1, 2);
  assert(workflow.includes('run: npm run test:trip-change-rules'));
  assert.match(workflow, /^\s+run: node --test[^\n]*\btests\/trip-change-evidence\.test\.mjs(?:\s|$)/m);
  assert(JSON.parse(read('package.json')).scripts['test:rules'].includes('tests/trip-change-rules.test.ts'));
});

test('private progress keeps historical consent separate from native editing and actual money movement', () => {
  const flow = content.flows.find((item) => item.id === 'publication');
  const current = 'docs/release/evidence/local-trip-change-native-2026-10-17/';
  assert.equal(flow.status, 'partial'); assert.equal(flow.source, current + 'README.md');
  assert.equal(flow.local.source, current + 'services.json'); assert(flow.local.groups.includes('trip-change-parent-confirmation'));
  assert.equal(flow.ui.source, current + 'results.json');
  assert.match(flow.remaining, /modification/); assert.match(flow.remaining, /remboursements réels/);
  assert.match(flow.remaining, /téléphone/); assert.match(flow.remaining, /pas en ligne/);
  assert(content.updates.some((update) => update.flow === 'publication' && /contrôles des confirmations/.test(update.title) && /écrans/.test(update.text)));
  const report = read(base + 'README.md');
  assert.match(report, /not deployed to production/); assert.match(report, /not a real payment/);
  assert.match(report, /Final application/); assert.match(report, /no new screenshot or video/);
});
