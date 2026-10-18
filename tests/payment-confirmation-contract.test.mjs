import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const android = 'android/app/src/main/java/be/sportgreenmoove/app/';
const ios = 'ios/Sources/SportsGreenMooveApp/';

test('payment status is an owning-parent read without provider requests or financial writes', () => {
  const source = read('functions/src/callables/ridePaymentStatus.ts');
  for (const text of ['requireAuth(', 'requireRole(request.auth?.token, "parent")', 'booking.parentUserId ?? booking.requesterUserId',
    '.strict()', 'runTransaction', 'ridePaymentReceipts', 'rewardLedger', 'recordedRidePaymentState']) assert(source.includes(text), text);
  assert(!/transaction\.(set|update|create|delete)\(/.test(source));
  assert(!/stripeConnect|providerSecrets|clientSecret|publishableKey/.test(source));
  assert(read('functions/src/index.ts').includes('export { getRidePaymentStatus }'));
  assert(read('tests/stripe-webhook-flow.test.ts').includes('registerRidePaymentStatusChecks'));
});

test('native checkout completion delegates to an explicit server reconciliation read', () => {
  const coordinator = read(android + 'services/RidePaymentCoordinator.kt');
  const swift = read(ios + 'AppState+RidePayments.swift');
  assert(coordinator.includes('gateway.ridePaymentStatus(target.bookingId, target.paymentIntentId)'));
  assert(swift.includes('stripe.ridePaymentStatus(bookingId: target.bookingId, paymentIntentId: target.paymentIntentId)'));
  assert(coordinator.includes('if (currentUid() != target.ownerUid) return'));
  assert(swift.includes('guard session?.uid == target.ownerUid else { return }'));
  assert(coordinator.includes('if (state == RidePaymentState.Recorded) refresh()'));
  assert(swift.includes('if state == .recorded { await refreshAppData() }'));
  assert(!read(android + 'ui/PaymentSheetResultHandler.kt').includes('Paiement confirmé.'));
  assert(!read(ios + 'PaymentsScreen.swift').includes('noticeMessage = "Paiement confirmé."'));
  assert(!read(android + 'ui/SportsGreenMooveRideActions.kt').includes('fun launchPayment('));
});

test('pending confirmation has a distinct verification action and collected responsive component evidence', () => {
  assert(read(android + 'ui/PaymentsScreen.kt').includes('testTag = "payments.verify"'));
  assert(read(ios + 'PaymentsScreen.swift').includes('appState.verifyRidePayment()'));
  const component = read('android/app/src/androidTest/java/be/sportgreenmoove/app/ui/PaymentConfirmationLayoutTest.kt');
  for (const text of ['320.dp', 'fontScale = 1.3f', 'assertIsNotEnabled()', 'payment-pending-narrow.png', 'payment-review.png'])
    assert(component.includes(text), text);
  const collect = read('scripts/run-android-ui-tests-and-collect-screenshots.sh');
  assert(collect.includes('adb pull /sdcard/Download/sgm-payment-confirmation'));
  assert(collect.includes('payment-pending-narrow-window.png'));
  assert(read('docs/contracts/ride-payment-confirmation.md').includes('process-death'));
});

test('retained service evidence is an actual isolated run, not a real or physical payment claim', () => {
  const report = JSON.parse(read('docs/release/evidence/local-payment-confirmation-2026-10-18/services.json'));
  assert.equal(report.projectId, 'demo-sgm-local-qa');
  assert.equal(report.scope, 'local-emulated-services-not-phone-ui');
  assert.equal(report.runId, 'd7dd675fde98227a73c2b4ca2d486617');
  assert.equal(report.testedAt, '2026-10-18T13:56:38.897Z');
  assert.deepEqual(report.steps, [{ id: 'ride-payment-confirmation', status: 'passed' }]);
  assert.equal(report.checks.length, 11); assert(report.checks.every((check) => check.status === 'passed'));
  assert.equal(new Set(report.checks.map((check) => check.id)).size, 11);
  for (const key of ['nativeUi', 'physicalDevice', 'livePayment', 'refundIssued', 'productionDeployed']) assert.equal(report[key], false);
  assert.equal(report.providerResponsesSynthetic, true); assert.equal(report.providerRequests, 0);
  assert(read('.github/workflows/backend-ci.yml').includes('run: node scripts/qa/run-local-payment-status.mjs'));
  const workflow = read('.github/workflows/web-integration-smoke.yml');
  assert.equal(workflow.split('"tests/payment-confirmation-contract.test.mjs"').length - 1, 2);
  assert.match(workflow, /^\s+run: node --test[^\n]*\btests\/payment-confirmation-contract\.test\.mjs(?:\s|$)/m);
});
