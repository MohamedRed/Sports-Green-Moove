import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { content } from '../partner-portal/content.mjs';

const source = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const base = 'docs/release/evidence/local-reservations-2026-10-16/';
test('reservation decisions retain the completed fifteen-group isolated service run', () => {
  const result = JSON.parse(source(base + 'services.json'));
  assert.equal(result.projectId, 'demo-sgm-local-qa');
  assert.equal(result.scope, 'local-emulated-services-not-phone-ui');
  assert.equal(result.steps.length, 15);
  assert(result.steps.every((step) => step.status === 'passed'));
  assert.deepEqual(result.reservationDecisions, {
    declinedSeatsBefore: 4, declinedSeatsAfter: 4, declineNotificationCount: 1,
    cancellationSeatsBefore: 2, cancellationSeatsAfter: 4, concurrentCancellationWinners: 1,
    concurrentDecisionWinners: 1, historicalBookingsPerRole: 25, activePassengerCancellationRejected: true,
    malformedActiveRideRejected: true, livePayment: false,
  });
});
test('native decision state and payload checks do not imply phone or refund approval', () => {
  for (const [file, count] of [['state-passed.xml', 10], ['payload-passed.xml', 3]]) {
    assert(source(base + file).includes(`tests="${count}" skipped="0" failures="0" errors="0"`));
  }
  assert.equal(content.flows.find((flow) => flow.id === 'booking').status, 'partial');
  assert.equal(content.flows.find((flow) => flow.id === 'tracking').status, 'untested');
  assert.match(source(base + 'README.md'), /have not been deployed to production/);
});
test('new reservation actions are wired to scoped state and persisted app verification', () => {
  const root = 'android/app/src/main/java/be/sportgreenmoove/app/';
  assert.match(source(root + 'ui/SportsGreenMooveApp.kt'), /ReservationManagementRoute/);
  assert(!source(root + 'ui/SportsGreenMooveApp.kt').includes('launchApproveBooking'));
  assert.match(source(root + 'services/FirebaseAndroidRuntime.kt'), /reservations = FirebaseAndroidReservationGateway\(\)/);
  assert.match(source(root + 'services/FirebaseAndroidReservationGateway.kt'), /checkIdentity\(user\)/);
  const route = source(root + 'ui/ReservationManagementRoute.kt');
  assert.match(route, /remember\(uid, role, gateway\)/);
  assert.match(route, /onDispose \{ state.close\(\) \}/);
  assert.match(route, /bookings.confirm/);
  const runner = source('scripts/qa/local-android-session.mjs');
  assert.match(runner, /instrument\(\['LocalBookingDecisionsFlowTest'\], 1\)/);
  assert.match(runner, /const reservationDecisions = await verifyReservationUi\(reservationFixture\)/);
  assert.match(runner, /testCount: 33/);
  assert.match(source('.github/workflows/web-integration-smoke.yml'), /tests\/reservation-evidence.test.mjs/);
});
test('published reservation captures require the completed native run and saved outcomes', () => {
  const run = JSON.parse(source(base + 'ui-results.json'));
  assert.equal(run.projectId, 'demo-sgm-local-qa');
  assert.equal(run.scope, 'local-ui-not-physical-device');
  assert.equal(run.testCount, 15);
  assert.equal(run.steps.length, 16);
  assert(run.steps.every((step) => step.status === 'passed'));
  assert.deepEqual(run.reservationDecisions, {
    method: 'app-ui-with-persisted-checks', requestedCancellation: 'cancelled', approvedCancellation: 'cancelled',
    declinedStatus: 'declined', requestedSeats: 2, approvedSeatsBeforeCancellation: 2, seatsAfterEachDecision: 4,
    notificationCount: 3, livePayment: false,
  });
  for (const [classes, count] of [
    ['LocalAppFlowTest-LocalDriverFlowTest-LocalLandscapeLoginTest-LocalUiRegressionTest-SearchSessionFlowTest-SearchCriteriaFlowTest', 9],
    ...['LocalThemeRestartTest', 'LocalMultiSeatSdkTest', 'LocalRideFlowTest', 'LocalChatFlowTest',
      'LocalConversationDirectoryFlowTest', 'LocalBookingDecisionsFlowTest'].map((name) => [name, 1]),
  ]) {
    const raw = source(base + `${classes}-instrumentation.txt`);
    assert.match(raw, new RegExp(`OK \\(${count} tests?\\)`));
    assert(!/FAILURES|INSTRUMENTATION_FAILED/.test(raw));
  }
  assert.match(source(base + 'general-ui-passed.xml'), /tests="60" failures="0" errors="0" skipped="10"/);
  const flow = content.flows.find((item) => item.id === 'booking');
  assert.equal(run.testedAt.slice(0, 10), '2026-10-16');
  assert.equal(flow.ui.checkedAt, '2026-10-17');
  assert.equal(flow.ui.source, 'docs/release/evidence/local-booking-search-feedback-2026-10-17/results.json');
  assert(flow.ui.groups.includes('booking-response-loss-search-ui'));
  for (const file of ['reservation-cancelled', 'reservation-declined'])
    assert(flow.images.some((image) => image.file === file && /16 octobre/.test(image.alt)));
  assert.equal(flow.status, 'partial');
  assert.match(flow.remaining, /téléphone/);
  assert.match(flow.remaining, /remboursements/);
  assert(!content.blockers.some((item) => item.id === 'booking-decisions'));
});
