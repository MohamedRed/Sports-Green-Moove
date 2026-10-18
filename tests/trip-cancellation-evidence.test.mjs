import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { XMLParser } from 'fast-xml-parser';
import { content, captures } from '../partner-portal/content.mjs';
import { assertInstrumentationPassed } from '../scripts/qa/android-instrumentation-result.mjs';
import { assertChatLossReceipt } from '../scripts/qa/chat-loss-evidence.mjs';
import { assertChatNetworkReceipt, assertCellularRequestSetup } from '../scripts/qa/chat-network-evidence.mjs';
import { assertChatRestartReceipt } from '../scripts/qa/chat-restart-evidence.mjs';

const base = 'docs/release/evidence/local-trip-cancellation-2026-10-16/';
const root = fileURLToPath(new URL('../', import.meta.url));
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const json = (name) => JSON.parse(read(base + name));

test('local cancellation evidence retains all earlier service groups without accepting app or live payment scope', () => {
  const run = json('services.json');
  assert.equal(run.projectId, 'demo-sgm-local-qa');
  assert.equal(run.scope, 'local-emulated-services-not-phone-ui');
  assert.equal(run.testedAt.slice(0, 10), '2026-10-16'); assert.match(run.runId, /^[a-f0-9]{32}$/);
  assert.equal(run.steps.length, 20); assert(run.steps.every((step) => step.status === 'passed'));
  for (const group of ['team-ownership', 'chat-post-commit-response-loss', 'trip-capacity-ownership', 'trip-cancellation'])
    assert(run.steps.some((step) => step.id === group));
  const result = run.tripCancellation;
  assert.equal(result.method, 'authenticated-local-callable-http-with-independent-persisted-checks');
  assert.equal(result.bookingCount, 3); assert.equal(result.notificationCount, 2);
  assert.equal(result.refundPendingCount, 1); assert.equal(result.seatsInitiallyOffered, 3);
  assert.equal(result.seatsAfterApproval, 1); assert.equal(result.seatsAfterCancellation, 3);
  const receipt = result.receipt;
  assert.equal(receipt.tripId, result.tripId); assert.equal(receipt.status, 'cancelled');
  assert.equal(receipt.bookingCount, 3); assert.equal(receipt.refundPendingCount, 1);
  assert.match(receipt.expectedRevision, /^[a-f0-9]{64}$/); assert.match(receipt.requestId, /^[a-f0-9-]{36}$/);
  assert.deepEqual(receipt.bookingIds, result.bookingIds); assert.equal(new Set(receipt.bookingIds).size, 3);
  assert.equal(result.savedTrip.seatsAvailable, 3); assert.equal(result.savedTrip.seatsTotal, 4);
  assert.equal(result.savedTrip.status, 'cancelled'); assert.equal(result.savedTrip.cancelledByUserId, receipt.actorUserId);
  assert.equal(result.savedTrip.cancelledAt, receipt.cancelledAt);
  assert.deepEqual(result.reservations.map((item) => item.bookingId).sort(), receipt.bookingIds);
  assert(result.reservations.every((item) => item.status === 'cancelled' && item.cancelledAt === receipt.cancelledAt &&
    item.cancelledByUserId === receipt.actorUserId));
  assert.equal(result.reservations.filter((item) => item.refundStatus === 'pending').length, 1);
  assert.equal(result.reservations.filter((item) => item.refundStatus === 'notRequired').length, 2);
  assert.equal(result.notifications.length, 2); assert.equal(new Set(result.notifications.map((item) => item.userId)).size, 2);
  assert.equal(new Set(result.notifications.map((item) => item.id)).size, 2);
  assert.deepEqual(result.notifications.flatMap((item) => item.bookingIds).sort(), receipt.bookingIds);
  for (const flag of ['repeatedAndConcurrentRequestsIdempotent', 'closedReservationUnchanged',
    'staleBookingApprovalPaymentRejected', 'malformedMetadataRejected', 'resourceLimitRejectedAtomically',
    'hundredReservationsCancelledAtomically', 'cancelledReservationsVisibleToParents', 'parentInboxNotificationsVerified']) assert.equal(result[flag], true);
  for (const flag of ['nativeUi', 'livePayment', 'refundIssued', 'productionDeployed']) assert.equal(result[flag], false);
  for (const flag of ['crossDriverDenied', 'explicitAdminCancellationRecorded', 'closedTripsRejected', 'activeRideAndOrphanRejected'])
    assert.equal(result.races[flag], true);
  assert.deepEqual(result.races.outcomes.map((item) => item.action), ['requestBooking', 'approveBooking', 'startRide']);
  assert(result.races.outcomes.every((item) => item.consistent && (item.tripStatus !== 'cancelled' || item.activeBookingCount === 0)));
});

test('rules and synthetic webhook reports cover cancellation authority, late success, ordering and retained refund state', () => {
  for (const [file, count] of [['rules.json', 49], ['payments.json', 11]]) {
    const run = json(file);
    assert.equal(run.numTotalTests, count); assert.equal(run.numPassedTests, count); assert.equal(run.numFailedTests, 0);
    assert.equal(run.success, true); assert(run.testResults.every((suite) => suite.status === 'passed'));
    assert.equal(new Date(run.startTime).toISOString().slice(0, 10), '2026-10-16');
  }
  const rules = json('rules.json').testResults.find((item) => item.name.endsWith('/tests/trip-cancellation-rules.test.ts'));
  assert.equal(rules.assertionResults.length, 9);
  const payments = json('payments.json').testResults.flatMap((item) => item.assertionResults);
  for (const order of ['payment-first', 'cancellation-first', 'concurrent'])
    assert(payments.some((item) => item.fullName.endsWith('across ' + order) && item.status === 'passed'));
  assert.equal(payments.filter((item) => item.fullName.includes('flags a late payment')).length, 3);
  assert(payments.some((item) => item.fullName.includes('does not reopen a settled refund') && item.status === 'passed'));
});

test('CI runs cancellation checks and the private portal separates local app proof from real refunds', () => {
  const workflow = read('.github/workflows/web-integration-smoke.yml');
  assert.equal(workflow.split('"tests/trip-cancellation-rules.test.ts"').length - 1, 2);
  assert.equal(workflow.split('"tests/trip-cancellation-evidence.test.mjs"').length - 1, 2);
  assert(workflow.includes('run: npm run test:trip-cancellation-rules'));
  assert.match(workflow, /^\s+run: node --test[^\n]*\btests\/trip-cancellation-evidence\.test\.mjs(?:\s|$)/m);
  assert.match(read('scripts/qa/local-flow-suite.mjs'), /check\('trip-cancellation'/);
  assert.match(read('scripts/qa/run-local-flows.mjs'), /result.steps.length, 24/);
  assert.match(read('scripts/qa/run-local-flows.mjs'), /result.tripCancellation\?\.notificationCount, 2/);
  const pkg = JSON.parse(read('package.json'));
  assert(pkg.scripts['test:rules'].includes('tests/trip-cancellation-rules.test.ts'));
  const flow = content.flows.find((item) => item.id === 'publication');
  assert.equal(flow.status, 'partial'); assert.equal(flow.local.source, detailsBase + 'services.json');
  assert(flow.local.groups.includes('trip-cancellation'));
  assert.equal(flow.source, 'docs/release/evidence/local-trip-history-2026-10-18/README.md');
  assert.match(flow.remaining, /parcours.*application/); assert.match(flow.remaining, /remboursements réels/);
  assert.match(flow.remaining, /téléphone/); assert.match(flow.remaining, /pas encore en ligne/i);
  assert.equal(flow.ui.source, 'docs/release/evidence/local-trip-history-2026-10-18/completed-native/results.json');
  assert(flow.ui.groups.includes('trip-change-parent-confirmation-ui'));
  assert.match(read(base + 'README.md'), /not been deployed to production/);
  for (const name of ['trip-cancel-review', 'trip-cancel-confirmed', 'trip-cancel-parent']) assert(captures[name].startsWith(uiBase));
});

const uiBase = 'docs/release/evidence/local-trip-cancellation-ui-2026-10-16/';
const detailsBase = 'docs/release/evidence/local-trip-change-native-2026-10-17/';
const uiJson = (name) => JSON.parse(read(uiBase + name));

test('completed app cancellation requires the actual same-run receipt and independently verified closed state', () => {
  const run = uiJson('results.json');
  assert.equal(run.projectId, 'demo-sgm-local-qa'); assert.equal(run.scope, 'local-ui-not-physical-device');
  assert.equal(run.runId, '4043ac86a7274758c6e74a9212987c66');
  assert.equal(run.testedAt, '2026-10-16T18:07:54.115Z');
  assert.equal(run.testCount, 21); assert.equal(run.steps.length, 22);
  assert(run.steps.every((item) => item.status === 'passed'));
  assert(run.steps.some((item) => item.id === 'driver-trip-cancellation-ui'));
  const result = run.tripCancellation;
  assert.equal(result.method, 'app-ui-with-independent-persisted-checks');
  assert.equal(result.bookingCount, 2); assert.equal(result.notificationCount, 1); assert.equal(result.refundPendingCount, 1);
  assert.equal(result.seatsInitiallyOffered, 3); assert.equal(result.seatsAfterApproval, 1); assert.equal(result.seatsAfterCancellation, 3);
  assert.equal(result.receipt.tripId, result.tripId); assert.equal(result.receipt.actorUserId, 'sgm-qa-driver');
  assert.equal(result.receipt.status, 'cancelled'); assert.equal(result.receipt.bookingCount, 2);
  assert.equal(result.receipt.refundPendingCount, 1); assert.equal(result.receipt.seatsAvailable, 3);
  assert.equal(new Set(result.receipt.bookingIds).size, 2);
  assert.match(result.receipt.expectedRevision, /^[a-f0-9]{64}$/); assert.match(result.receipt.requestId, /^[a-f0-9-]{36}$/);
  for (const key of ['parentCancelledReservationsVisible', 'parentPendingRefundVisible', 'repeatedRequestIdempotent',
    'rebookApproveStartDenied', 'syntheticPaymentMetadata']) assert.equal(result[key], true);
  for (const key of ['livePayment', 'refundIssued', 'productionDeployed']) assert.equal(result[key], false);
  assertInstrumentationPassed(read(uiBase + 'LocalTripCancellationFlowTest-instrumentation.txt'), 1);
});

test('raw replay artifacts and interrupted attempts remain unchanged and the earlier groups still pass', () => {
  const hashes = uiJson('artifact-sha256.json');
  assert.equal(Object.keys(hashes).length, 38);
  for (const [name, hash] of Object.entries(hashes)) assert.equal(createHash('sha256')
    .update(readFileSync(resolve(root, uiBase, name))).digest('hex'), hash, name);
  for (const attempt of ['one', 'two', 'three', 'four']) assert.match(read(uiBase + `attempt-${attempt}-instrumentation.txt`), /FAILURES!!!/);
  const transcripts = Object.keys(hashes).filter((name) => name.endsWith('-instrumentation.txt') && !name.startsWith('attempt-'));
  assert.equal(transcripts.length, 13);
  for (const name of transcripts) assertInstrumentationPassed(read(uiBase + name), name.startsWith('LocalAppFlowTest-') ? 9 : 1);
  const run = uiJson('results.json');
  for (const phase of ['confirmed-restart', 'response-loss', 'network-recovery']) {
    const receipt = uiJson(`adb-pull-${phase}.json`);
    assert.equal(receipt.runId, run.runId); assert.equal(receipt.status, 0); assert.equal(receipt.completed, true);
  }
  assertChatLossReceipt(uiJson('local-chat-loss-ui.json'), uiJson('local-chat-loss-proxy.json'), run.runId, run.chatResponseLoss.sourceId);
  assertChatNetworkReceipt(uiJson('local-chat-network-ui.json')); assertCellularRequestSetup(uiJson('local-chat-network-ui.json'));
  assertChatRestartReceipt(uiJson('local-chat-restart-before.json'), uiJson('local-chat-restart-stop.json'), uiJson('local-chat-restart-after.json'), run.runId);
});

test('all cancellation component cases executed while local app cases remain deliberately separate', () => {
  const suite = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '', parseAttributeValue: true,
    processEntities: false, isArray: (name) => name === 'testcase' }).parse(read(uiBase + 'component.xml')).testsuite;
  assert.equal(suite.tests, 73); assert.equal(suite.failures, 0); assert.equal(suite.errors, 0); assert.equal(suite.skipped, 16);
  const cases = suite.testcase.filter((item) => item.classname === 'be.sportgreenmoove.app.ui.TripCancellationFlowTest');
  assert.equal(cases.length, 3); assert(cases.every((item) => !item.failure && !Object.hasOwn(item, 'skipped')));
  assert.match(read(uiBase + 'README.md'), /does not establish why that submit was not confirmed/);
  assert.match(read(uiBase + 'README.md'), /no general crash, transport or/);
});
