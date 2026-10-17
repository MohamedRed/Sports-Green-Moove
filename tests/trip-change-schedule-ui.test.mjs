import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { tripScheduleFixtureTimes, assertTripScheduleReceipt, assertTripScheduleRecords } from '../scripts/qa/trip-change-schedule-evidence.mjs';

const read = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const fixture = { tripId: 'schedule-trip', bookingId: 'schedule-booking',
  ...tripScheduleFixtureTimes(Date.parse('2026-10-17T15:00:00Z')),
  before: { departureAt: '2026-10-18T09:00:00.000Z', priceCents: 250, seatsAvailable: 3,
    origin: { lat: 50.7167, lng: 4.6167 }, destination: { lat: 50.8503, lng: 4.3517 } },
  bookingBefore: { parentUserId: 'parent', seats: 1, status: 'approved', paymentStatus: 'unpaid' } };
const runId = 'a'.repeat(32);
const receipt = () => ({ projectId: 'demo-sgm-local-qa', runId, scope: 'native-trip-change-date-and-arrival-consent-ui', completed: true,
  tripId: fixture.tripId, bookingId: fixture.bookingId, originalDepartureAt: fixture.originalDepartureAt,
  proposedDepartureAt: fixture.proposedDepartureAt, desiredArrivalBy: fixture.desiredArrivalBy,
  nativeDatePickerUsed: true, nativeTimePickerUsed: true, dateCancellationPreservedDraft: true, pastDepartureBlocked: true,
  arrivalBeforeDepartureBlocked: true, desiredArrivalAdded: true, parentSawDatesAndArrival: true, parentConfirmed: true, notApplied: true });
function records() {
  const originalTerms = { departureAt: fixture.originalDepartureAt, arrivalBy: null, priceCents: 250,
    origin: structuredClone(fixture.before.origin), destination: structuredClone(fixture.before.destination) };
  return { trip: { ...structuredClone(fixture.before), pendingChangeId: 'proposal', updatedAt: 'now' },
    booking: structuredClone(fixture.bookingBefore), proposalId: 'proposal', parentUid: 'parent', driverUid: 'driver',
    change: { tripId: fixture.tripId, driverUserId: 'driver', status: 'confirmed', originalTerms,
      terms: { ...structuredClone(originalTerms), departureAt: fixture.proposedDepartureAt, arrivalBy: fixture.desiredArrivalBy },
      parentUserIds: ['parent'], bookingIds: [fixture.bookingId], decisions: { parent: { decision: 'accept' } } } };
}

test('date fixtures remain future/past and adjacent-month safe across month, year, leap and Brussels offset boundaries', () => {
  for (const date of ['2026-01-30T23:59:00Z', '2026-01-31T00:00:00Z', '2026-12-30T23:59:00Z',
    '2028-02-27T23:59:00Z', '2028-02-28T23:59:00Z', '2026-03-27T23:59:00Z', '2026-10-23T23:59:00Z']) {
    const now = Date.parse(date), times = tripScheduleFixtureTimes(now);
    const original = Date.parse(times.originalDepartureAt), proposed = Date.parse(times.proposedDepartureAt);
    assert(original > now); assert(Date.parse(times.pastDepartureAt) < now);
    assert.equal(proposed - original, 24 * 3600_000); assert.equal(Date.parse(times.desiredArrivalBy) - proposed, 3600_000);
    assert.equal(new Date(original).getUTCHours(), 9); assert.equal(new Date(proposed).getUTCHours(), 9);
  }
  const hour = (iso) => new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Brussels', hour: '2-digit', hourCycle: 'h23' }).format(new Date(iso));
  const spring = tripScheduleFixtureTimes(Date.parse('2026-03-27T12:00:00Z'));
  assert.equal(hour(spring.originalDepartureAt), '10'); assert.equal(hour(spring.proposedDepartureAt), '11');
  const autumn = tripScheduleFixtureTimes(Date.parse('2026-10-23T12:00:00Z'));
  assert.equal(hour(autumn.originalDepartureAt), '11'); assert.equal(hour(autumn.proposedDepartureAt), '10');
  for (const value of [NaN, Infinity, 'today']) assert.throws(() => tripScheduleFixtureTimes(value));
});

test('date/arrival evidence requires every native action, exact fixture and the current run', () => {
  assertTripScheduleReceipt(receipt(), fixture, runId);
  for (const [key, value] of Object.entries(receipt())) {
    assert.throws(() => assertTripScheduleReceipt({ ...receipt(), [key]: typeof value === 'boolean' ? false : 'other' }, fixture, runId), key);
    const missing = receipt(); delete missing[key]; assert.throws(() => assertTripScheduleReceipt(missing, fixture, runId), key);
  }
});

test('saved schedule approval cannot alter the initial trip, booking, price, coordinates or parent boundary', () => {
  assertTripScheduleRecords(records(), fixture);
  const mutations = [
    (r) => { r.trip.departureAt = fixture.proposedDepartureAt; }, (r) => { r.trip.seatsAvailable = 2; },
    (r) => { r.trip.arrivalBy = fixture.desiredArrivalBy; }, (r) => { r.trip.pendingChangeId = 'other'; },
    (r) => { r.booking.status = 'cancelled'; }, (r) => { r.booking.paymentStatus = 'paid'; },
    (r) => { r.change.status = 'pending'; }, (r) => { r.change.tripId = 'other'; },
    (r) => { r.change.driverUserId = 'other'; }, (r) => { r.change.parentUserIds = ['other']; },
    (r) => { r.change.bookingIds = ['other']; }, (r) => { r.change.decisions.parent.decision = 'decline'; },
    (r) => { r.change.decisions.outsider = { decision: 'accept' }; }, (r) => { r.change.application = {}; },
    (r) => { r.change.originalTerms.departureAt = fixture.proposedDepartureAt; },
    (r) => { r.change.terms.departureAt = fixture.originalDepartureAt; },
    (r) => { r.change.terms.arrivalBy = fixture.originalDepartureAt; }, (r) => { r.change.terms.arrivalBy = null; },
    (r) => { r.change.terms.arrivalBy = 'invalid'; }, (r) => { r.change.originalTerms.arrivalBy = fixture.desiredArrivalBy; },
    (r) => { r.change.terms.priceCents = 400; }, (r) => { r.change.originalTerms.priceCents = 400; },
    (r) => { r.change.terms.origin.lat = 0; }, (r) => { r.change.terms.destination.lng = 0; },
    (r) => { r.change.originalTerms.origin.lat = 0; }, (r) => { r.change.originalTerms.destination.lng = 0; },
  ];
  for (const mutate of mutations) { const input = records(); mutate(input); assert.throws(() => assertTripScheduleRecords(input, fixture)); }
});

test('native calendar and time controls gate the real two-account schedule flow and independent host verification', () => {
  const nativePath = 'android/app/src/androidTest/java/be/sportgreenmoove/app/ui/LocalTripChangeScheduleFlowTest.kt';
  const native = read(nativePath);
  for (const marker of ['BuildConfig.DEBUG && BuildConfig.SGM_USE_FIREBASE_EMULATOR', 'demo-sgm-local-qa',
    'ActivityScenario.launch(MainActivity::class.java)', 'AuthTestInteractions(compose, activity)',
    'confirm = false', 'assertDate("departure", original.toLocalDate())', 'Le départ doit être dans le futur.',
    'L’arrivée ne peut pas précéder le départ.', 'pickTime("departure", proposed)', 'pickTime("arrival", arrival)',
    'Arrivée souhaitée : ${display(arrival)}', 'Accords reçus : 1 / 1', '"trip.change.apply").assertDoesNotExist()',
    'local-trip-change-schedule-ui.json', 'captureLocalUi(compose, "local-trip-change-date-arrival-confirmed.png"']) assert(native.includes(marker), marker);
  assert(!/setSgmUiTestContent|UiFlow.*Gateway|performSemanticsAction|runOnUiThread|proposeTripChange\(|applyTripChange\(/.test(native));
  const calendar = read('android/app/src/androidTest/java/be/sportgreenmoove/app/ui/NativeDatePickerInput.kt');
  for (const marker of ['day_picker_view_pager', '"next" else "prev"', 'By.desc(label)', 'day.click()',
    'if (confirm) "button1" else "button2"', 'distance in -1L..1L']) assert(calendar.includes(marker), marker);
  assert(!/catch|retry|Thread.sleep|runOnUiThread|updateDate\(|setDate\(/.test(calendar));
  const host = read('scripts/qa/local-trip-change-schedule-ui.mjs');
  for (const marker of ['assertTripScheduleReceipt(native, fixture, runId)', 'assertTripScheduleRecords(',
    'assert.equal(changes.size, 1', "denied('getTripChangeReview', outsider", 'assert.equal(quotes.size, 0)',
    'assert.equal(notes.size, 3)', 'applicationExercised: false', 'routeProviderExercised: false', 'paymentExercised: false',
    'fullAppReplay: false', "{ flag: 'wx' }"]) assert(host.includes(marker), marker);
  assert(!/proposeTripChange|respondToTripChange|quoteTripChange|applyTripChange/.test(host));
  const runner = read('scripts/qa/local-android-session.mjs');
  assert(runner.includes("instrument(['LocalTripChangeScheduleFlowTest'], 1"));
  assert(runner.indexOf("collectEvidence('trip-change-schedule')") < runner.indexOf('await verifyTripScheduleUi'));
  assert(runner.indexOf('await verifyTripScheduleUi') < runner.indexOf('replayWithNetworkCleanup(adb'));
  assert(runner.includes('testCount: 27')); assert(runner.includes("'trip-change-schedule-ui'"));
  assert(read('scripts/qa/collect-local-ui-evidence.mjs').includes("'trip-change-schedule'"));
  for (const workflow of ['native-ci.yml', 'web-integration-smoke.yml']) {
    assert.equal(read('.github/workflows/' + workflow).split('"tests/trip-change-schedule-ui.test.mjs"').length - 1, 2);
  }
  assert(JSON.parse(read('package.json')).scripts['test:local-flow-isolation'].includes('tests/trip-change-schedule-ui.test.mjs'));
  for (const path of [nativePath, 'android/app/src/androidTest/java/be/sportgreenmoove/app/ui/NativeDatePickerInput.kt',
    'scripts/qa/trip-change-schedule-evidence.mjs', 'scripts/qa/local-trip-change-schedule-ui.mjs']) assert(read(path).split('\n').length < 300);
});
