import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { assertTripChangeInputsReceipt, assertTripChangeInputsRecords } from '../scripts/qa/trip-change-inputs-evidence.mjs';

const read = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const fixture = { tripId: 'trip-inputs', bookingId: 'booking-inputs',
  originalDepartureAt: '2026-10-18T09:00:00.000Z', proposedDepartureAt: '2026-10-18T10:00:00.000Z',
  before: { departureAt: '2026-10-18T09:00:00.000Z', priceCents: 250, seatsAvailable: 3,
    origin: { lat: 50.7167, lng: 4.6167 }, destination: { lat: 50.8503, lng: 4.3517 } },
  bookingBefore: { status: 'approved', seats: 1, parentUserId: 'parent', paymentStatus: 'unpaid' } };
const runId = 'a'.repeat(32);
const receipt = () => ({ projectId: 'demo-sgm-local-qa', runId, completed: true,
  scope: 'native-trip-change-time-and-address-safety-ui', tripId: fixture.tripId, bookingId: fixture.bookingId,
  originalDepartureAt: fixture.originalDepartureAt, proposedDepartureAt: fixture.proposedDepartureAt,
  nativeTimePickerUsed: true, unconfirmedOriginBlocked: true, unconfirmedDestinationBlocked: true,
  originalPlacesExplicitlyKept: true, parentSawBothTimes: true, parentConfirmed: true, missingRouteBlockedApplication: true });
function records() {
  const originalTerms = { departureAt: fixture.originalDepartureAt, arrivalBy: null, priceCents: 250,
    origin: structuredClone(fixture.before.origin), destination: structuredClone(fixture.before.destination) };
  return { trip: { ...structuredClone(fixture.before), pendingChangeId: 'proposal', updatedAt: 'now' },
    booking: structuredClone(fixture.bookingBefore), proposalId: 'proposal', parentUid: 'parent', driverUid: 'driver',
    change: { tripId: fixture.tripId, driverUserId: 'driver', status: 'confirmed', originalTerms,
      terms: { ...structuredClone(originalTerms), departureAt: '2026-10-18T10:00:00Z', priceCents: 400 },
      parentUserIds: ['parent'], bookingIds: [fixture.bookingId], decisions: { parent: { decision: 'accept' } } } };
}

test('every input-stage identity and actual native outcome is mandatory and run-bound', () => {
  assertTripChangeInputsReceipt(receipt(), fixture, runId);
  for (const [key, value] of Object.entries(receipt())) {
    assert.throws(() => assertTripChangeInputsReceipt({ ...receipt(), [key]: typeof value === 'boolean' ? false : 'stale' }, fixture, runId), key);
    const missing = receipt(); delete missing[key];
    assert.throws(() => assertTripChangeInputsReceipt(missing, fixture, runId), 'missing ' + key);
  }
});

test('saved proposal requires exact changed time, retained coordinates, one affected parent and unchanged original records', () => {
  assertTripChangeInputsRecords(records(), fixture);
  const mutations = [
    (r) => { r.trip.departureAt = fixture.proposedDepartureAt; },
    (r) => { r.trip.priceCents = 400; }, (r) => { r.trip.seatsAvailable = 2; },
    (r) => { r.trip.pendingChangeId = 'other'; }, (r) => { r.booking.paymentStatus = 'paid'; },
    (r) => { r.booking.status = 'cancelled'; }, (r) => { r.change.status = 'pending'; },
    (r) => { r.change.tripId = 'other'; }, (r) => { r.change.driverUserId = 'other'; },
    (r) => { r.change.parentUserIds = ['other']; }, (r) => { r.change.bookingIds = ['other']; },
    (r) => { r.change.decisions.parent.decision = 'decline'; },
    (r) => { r.change.decisions.outsider = { decision: 'accept' }; },
    (r) => { r.change.application = {}; },
    (r) => { r.change.originalTerms.departureAt = fixture.proposedDepartureAt; },
    (r) => { r.change.terms.departureAt = fixture.originalDepartureAt; },
    (r) => { r.change.terms.departureAt = 'not-a-time'; },
    (r) => { r.change.terms.priceCents = 250; }, (r) => { r.change.originalTerms.priceCents = 400; },
    (r) => { r.change.terms.origin.lat = 0; }, (r) => { r.change.terms.destination.lng = 0; },
    (r) => { r.change.originalTerms.origin.lat = 0; }, (r) => { r.change.originalTerms.destination.lng = 0; },
    (r) => { r.change.terms.arrivalBy = fixture.proposedDepartureAt; },
    (r) => { r.change.originalTerms.arrivalBy = fixture.proposedDepartureAt; },
  ];
  for (const mutate of mutations) { const input = records(); mutate(input); assert.throws(() => assertTripChangeInputsRecords(input, fixture)); }
});

test('the real app uses the native picker and existing address actions without bypasses or provider substitutes', () => {
  const native = read('android/app/src/androidTest/java/be/sportgreenmoove/app/ui/LocalTripChangeInputsFlowTest.kt');
  for (const marker of ['BuildConfig.DEBUG && BuildConfig.SGM_USE_FIREBASE_EMULATOR', 'demo-sgm-local-qa',
    'ActivityScenario.launch(MainActivity::class.java)', 'AuthTestInteractions(compose, activity)', 'enterNativePickerTime(proposedTime)',
    'trip.change.validation', '.assertIsNotEnabled()', 'trip.change.$place.keep', 'assertTerms("original", original',
    'assertTerms("proposed", proposed', 'Accords reçus : 1 / 1', 'Itinéraire non confirmé. Actualisez avant de réessayer.',
    '"trip.change.quote").assertDoesNotExist()', '"trip.change.apply").assertDoesNotExist()', 'local-trip-change-inputs-ui.json']) {
    assert(native.includes(marker), marker);
  }
  assert(!/setSgmUiTestContent|UiFlow.*Gateway|performSemanticsAction|runOnUiThread|quoteTripChange\(|applyTripChange\(/.test(native));
  const picker = read('android/app/src/androidTest/java/be/sportgreenmoove/app/ui/NativeTimePickerInput.kt');
  for (const id of ['toggle_mode', 'input_hour', 'input_minute', 'button1']) assert(picker.includes(`"${id}"`));
  assert(!/catch|retry|Thread.sleep|tap\(/.test(picker));
  const verifier = read('scripts/qa/local-trip-change-inputs-ui.mjs');
  for (const marker of ['assertTripChangeInputsReceipt(native, fixture, runId)', 'assertTripChangeInputsRecords(',
    'assert.equal(changes.size, 1)', 'assert.equal(quotes.size, 0', 'assert.equal(notes.size, 3)',
    "denied('getTripChangeReview', outsider", 'successfulRouteChangeExercised: false', 'applicationExercised: false',
    'routeProviderExercised: false', 'paymentExercised: false', 'datePickerExercised: false', 'fullAppReplay: false',
    "{ flag: 'wx' }"]) assert(verifier.includes(marker), marker);
  assert(!/proposeTripChange|respondToTripChange|quoteTripChange|applyTripChange/.test(verifier));
  const runner = read('scripts/qa/local-android-session.mjs');
  assert(runner.includes("instrument(['LocalTripChangeInputsFlowTest'], 1"));
  assert(runner.indexOf("collectEvidence('trip-change-inputs')") < runner.indexOf('await verifyTripChangeInputsUi'));
  assert(runner.indexOf('await verifyTripChangeInputsUi') < runner.indexOf('replayWithNetworkCleanup(adb'));
  assert(runner.includes('testCount: 26')); assert(runner.includes("'trip-change-inputs-ui'"));
  assert(read('scripts/qa/collect-local-ui-evidence.mjs').includes("'trip-change-inputs'"));
  for (const workflow of ['native-ci.yml', 'web-integration-smoke.yml']) {
    assert.equal(read('.github/workflows/' + workflow).split('"tests/trip-change-inputs-ui.test.mjs"').length - 1, 2);
  }
  assert(JSON.parse(read('package.json')).scripts['test:local-flow-isolation'].includes('tests/trip-change-inputs-ui.test.mjs'));
  for (const path of ['scripts/qa/local-trip-change-inputs-ui.mjs', 'scripts/qa/trip-change-inputs-evidence.mjs',
    'android/app/src/androidTest/java/be/sportgreenmoove/app/ui/LocalTripChangeInputsFlowTest.kt',
    'android/app/src/androidTest/java/be/sportgreenmoove/app/ui/NativeTimePickerInput.kt']) assert(read(path).split('\n').length < 300);
});
