import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { content } from '../partner-portal/content.mjs';

const base = 'docs/release/evidence/local-trip-cancellation-2026-10-16/';
const read = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
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

test('CI runs cancellation checks and the private portal keeps native cancellation and real refunds open', () => {
  const workflow = read('.github/workflows/web-integration-smoke.yml');
  assert.equal(workflow.split('"tests/trip-cancellation-rules.test.ts"').length - 1, 2);
  assert.equal(workflow.split('"tests/trip-cancellation-evidence.test.mjs"').length - 1, 2);
  assert(workflow.includes('run: npm run test:trip-cancellation-rules'));
  assert.match(workflow, /^\s+run: node --test[^\n]*\btests\/trip-cancellation-evidence\.test\.mjs(?:\s|$)/m);
  assert.match(read('scripts/qa/local-flow-suite.mjs'), /check\('trip-cancellation'/);
  assert.match(read('scripts/qa/run-local-flows.mjs'), /result.steps.length, 20/);
  assert.match(read('scripts/qa/run-local-flows.mjs'), /result.tripCancellation\?\.notificationCount, 2/);
  const pkg = JSON.parse(read('package.json'));
  assert(pkg.scripts['test:rules'].includes('tests/trip-cancellation-rules.test.ts'));
  const flow = content.flows.find((item) => item.id === 'publication');
  assert.equal(flow.status, 'partial'); assert.equal(flow.local.source, base + 'services.json');
  assert(flow.local.groups.includes('trip-cancellation')); assert.equal(flow.source, base + 'README.md');
  assert.match(flow.remaining, /écran d’annulation/); assert.match(flow.remaining, /remboursements/);
  assert.match(flow.remaining, /téléphone/); assert.match(flow.remaining, /pas en ligne/);
  assert.equal(flow.ui, undefined); assert.match(read(base + 'README.md'), /not been deployed to production/);
});
