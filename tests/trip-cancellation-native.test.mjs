import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const android = 'android/app/src/main/java/be/sportgreenmoove/app/';

test('driver cancellation is reachable through the app and bound to identity and role', () => {
  assert.match(read(`${android}ui/SportsGreenMooveApp.kt`), /AppScreen.Trips -> TripsRoute\(/);
  const route = read(`${android}ui/TripsRoute.kt`);
  for (const text of ['remember(uid, role, gateway)', 'role == AppRole.Driver', 'uid == trip.driverUserId',
    'activeTripId != trip.id', 'TripCancellationDialog(uid, role, trip, gateway']) assert(route.includes(text));
  const dialog = read(`${android}ui/TripCancellationDialog.kt`);
  assert.match(dialog, /remember\(uid, role, trip.id, gateway\)/);
  assert.match(dialog, /onDispose \{ state.close\(\) \}/);
  assert.match(dialog, /verticalScroll\(rememberScrollState\(\)\)/);
  assert.match(dialog, /Aucun remboursement n'est confirmé ici/);
});

test('cancellation uses authenticated callables and never direct client writes', () => {
  const gateway = read(`${android}services/FirebaseAndroidTripCancellationGateway.kt`);
  assert.match(gateway, /getHttpsCallable\("getTripCancellation"\)/);
  assert.match(gateway, /getHttpsCallable\("cancelTrip"\)/);
  assert.equal(gateway.match(/check\(uid\(\) == user\)/g).length, 2);
  assert(!gateway.includes('.update(') && !gateway.includes('.set('));
  const indexes = JSON.parse(read('firestore.indexes.json')).indexes;
  for (const field of ['cancelledAt', 'departureAt']) assert(indexes.some((index) => index.collectionGroup === 'trips' &&
    index.fields.map((item) => item.fieldPath).join(',') === `driverUserId,status,${field}`));
});

test('new local app replay is independently verified before success and OS disconnect remains last', () => {
  const runner = read('scripts/qa/local-android-session.mjs');
  assert.match(runner, /instrument\(\['LocalTripCancellationFlowTest'\], 1,/);
  assert.match(runner, /const tripCancellation = await verifyTripCancellationUi\(cancellationFixture\)/);
  assert.match(runner, /testCount: 21/);
  assert(runner.indexOf('verifyTripCancellationUi(cancellationFixture)') < runner.indexOf('replayWithNetworkCleanup(adb'));
  assert(runner.indexOf('verifyTripCancellationUi(cancellationFixture)') < runner.indexOf('result = { projectId'));
  const fixture = read('scripts/qa/local-trip-cancellation-ui.mjs');
  for (const marker of ["'tripCancellations'", 'notes.size, 1', "'ALREADY_EXISTS'", "'FAILED_PRECONDITION'",
    'syntheticPaymentMetadata: true', 'livePayment: false', 'refundIssued: false']) assert(fixture.includes(marker));
});

test('production and test cancellation modules stay below the repository limit', () => {
  for (const path of ['ui/TripsScreen.kt', 'ui/TripListCards.kt', 'ui/TripsRoute.kt', 'ui/TripCancellationState.kt',
    'ui/TripCancellationDialog.kt', 'ui/SportsGreenMooveApp.kt', 'services/FirebaseAndroidGateway.kt',
    'services/TripCancellationMapping.kt', 'services/ProviderContracts.kt', 'data/Models.kt']) {
    assert(read(`${android}${path}`).split('\n').length < 300, path);
  }
});
