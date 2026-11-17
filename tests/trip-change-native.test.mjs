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
  for (const marker of ['remember(uid, role, tripId, gateway, storage)', 'onDispose { state.close() }', 'verticalScroll(rememberScrollState())',
    'state.decide(TripChangeDecision.Accept', 'state.decide(TripChangeDecision.Decline', 'state.calculateRoute()', 'state.apply(onChanged)']) assert(dialog.includes(marker));
});

test('private drafts retain unfinished input and resolve frozen requests before reopening an editor', () => {
  const state = read(base + 'ui/TripChangeState.kt');
  assert(state.indexOf('drafts.load()') < state.indexOf('gateway.previewTripChange(tripId)'));
  assert(state.indexOf('drafts.save(loaded, requireNotNull(draft).snapshot(), request)') < state.indexOf('gateway.proposeTripChange(request)'));
  for (const marker of ['draftSaveError == null', '!draftConflict', 'drafts.open(loaded, ::saveDraft)', 'fun discardDraft()']) assert(state.includes(marker));
  const draft = read(base + 'ui/TripChangeDraft.kt');
  assert(draft.includes('if (restored == null) initial else restored.point'));
  assert(draft.includes('fun snapshot() = TripChangeDraftInput('));
  const storage = read(base + 'services/SharedPreferencesTripChangeDrafts.kt');
  assert(storage.includes('Context.MODE_PRIVATE')); assert(storage.includes('check(edit.commit())'));
  const codec = read(base + 'services/TripChangeDraftCodec.kt');
  assert(codec.includes('json["uid"] == uid && json["tripId"] == tripId'));
  assert(codec.includes('request["expectedRevision"] == revision'));
  assert(!storage.includes('Firebase') && !storage.includes('println'));
  assert(read('android/app/src/main/AndroidManifest.xml').includes('android:allowBackup="false"'));
  for (const path of ['data/TripChangeDraftRecord.kt', 'services/TripChangeDraftStorage.kt', 'services/TripChangeDraftCodec.kt',
    'services/SharedPreferencesTripChangeDrafts.kt', 'ui/TripChangeDraftSession.kt']) assert(read(base + path).split('\n').length < 300, path);
  const workflow = read('.github/workflows/web-integration-smoke.yml');
  assert.equal(workflow.split('"' + base + 'data/TripChangeDraftRecord.kt"').length - 1, 2);
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
    'ui/TripChangeReviewContent.kt', 'ui/TripsRoute.kt', 'ui/ReservationManagementRoute.kt', 'ui/GoogleMapsRoutePreview.kt',
    'ui/FitRouteMapCamera.kt', 'ui/RouteMapViewport.kt']) assert(read(base + path).split('\n').length < 300, path);
  const workflow = read('.github/workflows/web-integration-smoke.yml');
  for (const pattern of ['"tests/trip-change-native.test.mjs"', '"android/app/src/main/java/be/sportgreenmoove/app/data/TripChangeModels.kt"',
    '"android/app/src/main/java/be/sportgreenmoove/app/domain/TripChangeInput.kt"',
    '"android/app/src/test/java/be/sportgreenmoove/app/ui/TripChange*Test.kt"',
    '"android/app/src/androidTest/java/be/sportgreenmoove/app/ui/Trip*Test.kt"',
    '"android/app/src/androidTest/java/be/sportgreenmoove/app/ui/LocalTrip*.kt"']) assert.equal(workflow.split(pattern).length - 1, 2);
  assert(workflow.includes('run: node --test tests/trip-cancellation-native.test.mjs tests/trip-change-native.test.mjs'));
  assert(read('scripts/run-android-ui-tests-and-collect-screenshots.sh').includes('adb pull /sdcard/Download/sgm-trip-changes'));
});

test('screen fixtures preserve real input readiness, app scrolling and failure artifacts', () => {
  const dir = 'android/app/src/androidTest/java/be/sportgreenmoove/app/ui/';
  const input = read(dir + 'TripFormTestInput.kt');
  for (const marker of ['InputWindowReadiness(compose, input)', 'window.awaitFocus(15_000)',
    'performClick().assertIsFocused()', 'performTextReplacement(value)', 'EditableText].text == value',
    'pressBack()', '!window.keyboardVisible()', 'assertIsDisplayed().assertIsEnabled()', 'internal fun enterCancellationReason']) assert(input.includes(marker));
  assert(!input.includes('WindowInspector'), 'Another window cannot prove this field has a keyboard');
  const screens = read(dir + 'TripChangeFlowTest.kt');
  assert.equal(screens.split('enterTripFormText(compose, "trip.change.price", "4,00")').length - 1, 2);
  assert(input.includes('compose.onNodeWithTag("trip.cancel.confirm").assertIsDisplayed().assertIsEnabled()'));
  assert(!input.includes('actionTag'), 'Layout-specific button scrolling must remain with its screen test');
  assert(screens.includes('Column(Modifier.verticalScroll(rememberScrollState()))'));
  assert(screens.includes('compose.waitUntil(10_000)'));
  assert(screens.includes('assertEquals(1, gateway.proposals)'));
  assert(screens.includes('device.takeScreenshot(File(directory, windowName))'));
  assert(screens.includes('captureLocalUi(compose, name, dialog = true)'));
  const collection = read('scripts/run-android-ui-tests-and-collect-screenshots.sh');
  assert(collection.includes('if [[ "$test_status" -ne 0 ]]; then'));
  assert(collection.includes('for directory in sgm-trip-changes sgm-payment-confirmation'));
  assert(collection.includes('adb shell test -d "/sdcard/Download/$directory"'));
  assert(collection.includes('adb pull "/sdcard/Download/$directory" "$output_dir/partial-components"'));
  assert(collection.includes('exit "$test_status"'));
  assert(collection.includes('Missing native trip change display capture: $window_name'));
});
