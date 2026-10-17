import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const base = 'android/app/src/main/java/be/sportgreenmoove/app/';

test('driver editing and affected-parent review are reachable with account-scoped disposal', () => {
  for (const marker of ['trip.pendingChangeId == null', 'uid == trip.driverUserId', 'TripChangeDialog(uid, role, id', 'trips.singleOrNull'])
    assert(read(base + 'ui/TripsRoute.kt').includes(marker));
  assert(read(base + 'ui/SportsGreenMooveApp.kt').includes('providers.reservations, providers.firebase'));
  assert(read(base + 'ui/ReservationManagementRoute.kt').includes('TripChangeDialog(uid, role, item.booking.tripId'));
  const dialog = read(base + 'ui/TripChangeDialog.kt');
  for (const marker of ['remember(uid, role, tripId, gateway)', 'onDispose { state.close() }', 'verticalScroll(rememberScrollState())',
    'state.decide(TripChangeDecision.Accept', 'state.decide(TripChangeDecision.Decline', 'state.calculateRoute()', 'state.apply(onChanged)']) assert(dialog.includes(marker));
});

test('native writes use existing authenticated callables without direct Firestore writes or provider substitutes', () => {
  const gateway = read(base + 'services/FirebaseAndroidTripChangeGateway.kt');
  for (const name of ['getTripChangePreview', 'getTripChangeReview', 'proposeTripChanges', 'respondToTripChanges',
    'withdrawTripChanges', 'getTripChangeApplicationQuote', 'applyTripChanges', 'resolveTripChangeProposal']) assert(gateway.includes('"' + name + '"'));
  assert(gateway.includes('check(uid() == user)'));
  assert(!gateway.includes('.update(') && !gateway.includes('.set('));
  assert(gateway.includes('trip-change-quote-expired'));
  const review = read(base + 'ui/TripChangeReviewContent.kt');
  assert(review.includes('showRoute = false'), 'Endpoint-only maps must not invent a driving route');
  assert(review.includes('Aucun règlement ni remboursement n’est confirmé ici.'));
});

test('new code is modular and smoke coverage includes both sides of the change contract', () => {
  for (const path of ['data/TripChangeModels.kt', 'domain/TripChangeInput.kt', 'services/TripChangeGateway.kt',
    'services/TripChangeWire.kt', 'services/TripChangeMapping.kt', 'services/FirebaseAndroidTripChangeGateway.kt',
    'ui/TripChangeDraft.kt', 'ui/TripChangeState.kt', 'ui/TripChangeDialog.kt', 'ui/TripChangeEditorForm.kt',
    'ui/TripChangeReviewContent.kt', 'ui/TripsRoute.kt', 'ui/ReservationManagementRoute.kt']) assert(read(base + path).split('\n').length < 300, path);
  const workflow = read('.github/workflows/web-integration-smoke.yml');
  for (const pattern of ['"tests/trip-change-native.test.mjs"', '"android/app/src/main/java/be/sportgreenmoove/app/data/TripChangeModels.kt"',
    '"android/app/src/main/java/be/sportgreenmoove/app/domain/TripChangeInput.kt"',
    '"android/app/src/test/java/be/sportgreenmoove/app/ui/TripChange*Test.kt"',
    '"android/app/src/androidTest/java/be/sportgreenmoove/app/ui/TripChange*Test.kt"']) assert.equal(workflow.split(pattern).length - 1, 2);
  assert(workflow.includes('run: node --test tests/trip-cancellation-native.test.mjs tests/trip-change-native.test.mjs'));
  assert(read('scripts/run-android-ui-tests-and-collect-screenshots.sh').includes('adb pull /sdcard/Download/sgm-trip-changes'));
});
