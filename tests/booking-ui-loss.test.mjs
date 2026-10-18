import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { assertBookingUiLoss } from '../scripts/qa/booking-ui-loss-evidence.mjs';

const runId = 'a'.repeat(32);
function fixture() {
  const ui = { projectId: 'demo-sgm-local-qa', runId, scope: 'native-search-ui-with-real-booking-sdk-and-stubbed-matching',
    completed: true, sendingObservedBeforeDispatch: true, unconfirmedReplyVisible: true, retryActionVisible: true,
    pendingIdentityPersisted: true, confirmedVisible: true, secondSubmissionActionAbsent: true, staleCallbackIgnored: true,
    pendingClearedAfterAcknowledgement: true, sdkCalls: 2, bookingId: 'synthetic-booking',
    clientRequestId: '00000000-0000-4000-8000-000000000000' };
  return { projectId: ui.projectId, runId, scope: ui.scope, ui, completed: true, livePayment: false,
    productionDeployed: false, bookingCount: 1, receiptCount: 1, attempts: [
      { number: 1, acknowledgementDropped: true, upstreamStatus: 200, commit: {
        bookingId: ui.bookingId, clientRequestId: ui.clientRequestId, bookingCount: 1, receiptCount: 1, createdAtMillis: 1792200000000 } },
      { number: 2, acknowledgementDropped: false, upstreamStatus: 200 },
    ] };
}
test('screen evidence needs both real transport attempts, the same acknowledgement and every UI phase', () => {
  assertBookingUiLoss(fixture(), runId);
  for (const mutate of [
    (r) => { r.completed = false; }, (r) => { r.livePayment = true; }, (r) => { r.productionDeployed = true; },
    (r) => { r.runId = 'b'.repeat(32); }, (r) => { r.ui.runId = 'b'.repeat(32); },
    (r) => { r.ui.scope = 'native-sdk-booking-response-loss-not-ui'; }, (r) => { r.bookingCount = 2; },
    (r) => { r.receiptCount = 2; }, (r) => { r.ui.sdkCalls = 3; },
    (r) => { r.attempts[0].acknowledgementDropped = false; }, (r) => { r.attempts[1].upstreamStatus = 500; },
    (r) => { r.ui.bookingId = 'different-booking'; }, (r) => { r.ui.clientRequestId = 'different-id'; },
    (r) => { r.attempts[0].commit.receiptCount = 2; },
  ]) { const r = fixture(); mutate(r); assert.throws(() => assertBookingUiLoss(r, runId)); }
  for (const key of Object.keys(fixture().ui).filter((key) => typeof fixture().ui[key] === 'boolean')) {
    const r = fixture(); r.ui[key] = false; assert.throws(() => assertBookingUiLoss(r, runId));
  }
});
test('real screen replay is mandatory and clearly separates stubbed discovery from actual booking transport', () => {
  const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
  const native = 'android/app/src/androidTest/java/be/sportgreenmoove/app/ui/';
  const runner = read('scripts/qa/local-android-session.mjs');
  assert.match(runner, /await replayBookingUiLoss/); assert.match(runner, /testCount: 34/);
  assert.match(read('scripts/qa/local-booking-ui-loss.mjs'), /assert.equal\(bookings.size, 1\)/);
  assert.match(read('scripts/qa/local-booking-ui-loss.mjs'), /assertBookingUiLoss\(result, runId\)/);
  const host = read(native + 'LocalBookingResponseLossUiTest.kt');
  for (const stage of ['ENVOI EN COURS', 'RÉESSAYER', 'BookingRequestConfirmed', 'assertIsNotEnabled()',
    'fixture.storage.read(fixture.slot)', 'controller.requestMatch(displayed)']) assert(host.includes(stage));
  const fixtureSource = read(native + 'LocalBookingUiFixture.kt');
  assert.match(fixtureSource, /booking.requestBooking\(trip, childId, seats\)/);
  assert.match(fixtureSource, /runtime.firebase.searchTrips\(\).single/);
  assert.match(fixtureSource, /session.getBoolean\("disposableEmulator"\)/);
  assert.match(read(native + 'BookingFeedbackLayoutTest.kt'), /Density\(density.density, 1.5f\)/);
  const workflow = read('.github/workflows/web-integration-smoke.yml');
  assert.equal(workflow.split('"tests/booking-ui-loss.test.mjs"').length - 1, 2);
  assert.match(workflow, /run: node --test[^\n]*tests\/booking-ui-loss.test.mjs/);
});
