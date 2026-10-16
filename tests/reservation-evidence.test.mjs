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
  for (const [file, count] of [['state-passed.xml', 9], ['payload-passed.xml', 3]]) {
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
  assert.match(runner, /testCount: 15/);
  assert.match(source('.github/workflows/web-integration-smoke.yml'), /tests\/reservation-evidence.test.mjs/);
});
