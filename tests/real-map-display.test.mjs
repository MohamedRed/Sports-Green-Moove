import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { assertRealMapDisplay, assertFramedRealMapDisplay } from '../scripts/qa/real-map-display-evidence.mjs';

const source = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const display = () => ({ sdkLoaded: true, capture: 'native-display', screenFile: 'local-real-map-display.png',
  regionFile: 'local-real-map-region.png', left: 20, top: 200, width: 800, height: 600,
  samples: 8000, colorBins: 40, dominantFraction: 0.3 });

test('a callback without a nonblank, fully visible native raster is not map evidence', () => {
  assertRealMapDisplay(display());
  for (const mutation of [
    (d) => { delete d.sdkLoaded; }, (d) => { d.sdkLoaded = false; },
    (d) => { d.capture = 'compose-only'; }, (d) => { d.regionFile = '../other.png'; },
    (d) => { d.width = 0; }, (d) => { d.height = 199; }, (d) => { d.left = -1; },
    (d) => { d.samples = 100; }, (d) => { d.colorBins = 15; }, (d) => { d.colorBins = 5000; },
    (d) => { d.dominantFraction = 0.85; }, (d) => { d.dominantFraction = NaN; },
    (d) => { d.dominantFraction = 0; },
  ]) {
    const evidence = display(); mutation(evidence); assert.throws(() => assertRealMapDisplay(evidence));
  }
  assert.throws(() => assertRealMapDisplay(undefined));
});

test('isolated map display requires explicit opt-in and keeps all other provider resources disabled', () => {
  const gradle = source('android/app/build.gradle.kts');
  assert.match(gradle, /val localRealMapsUi = providers\s+\.gradleProperty\("SGM_LOCAL_REAL_MAPS_UI"\)/);
  assert.match(gradle, /check\(!localRealMapsUi \|\| useFirebaseEmulator\)/);
  assert.match(gradle, /check\(!localRealMapsUi \|\| googleMapsAndroidApiKey.isNotBlank\(\)\)/);
  assert.match(gradle, /"sgm_google_maps_android_api_key", if \(useFirebaseEmulator && !localRealMapsUi\) "" else googleMapsAndroidApiKey/);
  for (const key of ['sgm_radar_publishable_key', 'sgm_stripe_connect_return_url', 'sgm_stripe_connect_refresh_url',
    'facebook_app_id', 'facebook_client_token', 'fb_login_protocol_scheme']) {
    assert(gradle.includes(`resValue("string", "${key}", if (useFirebaseEmulator) "" else `), key);
  }
  assert.match(source('scripts/run-real-maps-android-ui.sh'), /-PSGM_USE_FIREBASE_EMULATOR=true -PSGM_LOCAL_REAL_MAPS_UI=true/);
});

test('native display proof waits for real SDK load and captures the real screen without fake map content', () => {
  const map = source('android/app/src/main/java/be/sportgreenmoove/app/ui/GoogleMapsRoutePreview.kt');
  assert.match(map, /stateDescription = if \(loaded\)/);
  assert.match(map, /onSizeChanged \{ viewport = it \}/);
  assert.match(map, /FitRouteMapCamera\(cameraState, points, listOf\(start, end\), viewport, paddingPixels\)/);
  assert(!map.includes('routeZoom('));
  const fit = source('android/app/src/main/java/be/sportgreenmoove/app/ui/FitRouteMapCamera.kt');
  assert.match(fit, /\(points \+ anchors\).forEach\(::include\)/);
  assert.match(fit, /newLatLngBounds\(bounds, viewport.width, viewport.height, paddingPixels\)/);
  assert(fit.indexOf('camera.move(') < fit.indexOf('map.setOnMapLoadedCallback {'));
  assert.match(fit, /map.projection.toScreenLocation/); assert.match(fit, /reportLoaded\(routeMapAnchorsFit/);
  assert.match(fit, /finally \{ map.setOnMapLoadedCallback\(null\) \}/);
  const capture = source('android/app/src/androidTest/java/be/sportgreenmoove/app/ui/RealMapDisplayEvidence.kt');
  assert(capture.indexOf('StateDescription') < capture.indexOf('uiAutomation.takeScreenshot()'));
  assert.match(capture, /getLocationOnScreen/); assert.match(capture, /node.boundsInRoot/);
  assert.match(capture, /bins.size >= 16 && dominantFraction < 0.85/);
  assert(!capture.includes('Thread.sleep') && !capture.includes('captureToImage'));
  const ui = source('android/app/src/androidTest/java/be/sportgreenmoove/app/ui/LocalRealMapsTripChangeTest.kt');
  assert.match(ui, /check\(BuildConfig.SGM_LOCAL_REAL_MAPS_UI\)/);
  assert.match(ui, /captureLoadedTripMap\(compose, "trip.change.proposed.map"\)/);
  assert.match(ui, /onNodeWithTag\("trip.change.close"\).assertIsDisplayed\(\).assertIsEnabled\(\).performClick\(\)/);
  const dialog = source('android/app/src/main/java/be/sportgreenmoove/app/ui/TripChangeDialog.kt');
  assert(dialog.indexOf('testTag("trip.change.close")') < dialog.indexOf('verticalScroll(rememberScrollState())'));
  assert.match(dialog, /Column\(Modifier.weight\(1f\).fillMaxWidth\(\).verticalScroll/);
  assert.match(source('android/app/src/androidTest/java/be/sportgreenmoove/app/ui/TripChangeFlowTest.kt'),
    /largeTextReviewKeepsCloseVisibleAfterScrollingToTheDecision/);
  assert.match(source('scripts/qa/real-maps-trip-ui.mjs'), /verifyRealMapDisplayFiles\(native.mapDisplay, directory\)/);
  assert.match(source('scripts/qa/run-real-maps-android.mjs'), /assertFramedRealMapDisplay\(result.native.mapDisplay\)/);
  const session = source('scripts/qa/real-maps-android-session.mjs');
  assert.match(session, /instrumentation.txt'\), redact\(output\)/);
  assert.match(session, /new Error\(redact\(error.stack \?\? error\)\)/);
  assert.match(session, /map-display-provider-errors.txt'\), redact\(logs\)/);
});

test('a loaded raster does not retroactively prove marker framing', () => {
  const prior = display(); assertRealMapDisplay(prior);
  assert.throws(() => assertFramedRealMapDisplay(prior));
  assertFramedRealMapDisplay({ ...prior, anchorsFramed: true });
  assert.throws(() => assertFramedRealMapDisplay({ ...prior, anchorsFramed: false }));
});

test('all trip editor and review replays require the pinned close control to be visible', () => {
  const root = 'android/app/src/androidTest/java/be/sportgreenmoove/app/ui/';
  for (const name of ['TripDraftPersistenceFlowTest', 'LocalTripChangeFlowTest', 'LocalTripChangeInputsFlowTest',
    'LocalTripChangeScheduleFlowTest', 'LocalTripConsentRecoveryTest', 'LocalTripScheduleDraftRestartTest',
    'LocalTripDraftRestartTest', 'LocalTripConsentRestartTest', 'LocalTripHistoryAssertions', 'TripHistoryFlowTest']) {
    const replay = source(root + name + '.kt');
    assert.match(replay, /onNodeWithTag\("trip.change.close"(?:, useUnmergedTree = true)?\).assertIsDisplayed\(\).assertIsEnabled\(\).performClick\(\)/, name);
    assert(!replay.includes('onNodeWithContentDescription("Fermer")'), name);
  }
});
