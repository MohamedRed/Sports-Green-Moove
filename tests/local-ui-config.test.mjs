import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { localFirebaseConfig } from '../admin/src/localFirebaseConfig.ts';
import { assertInstrumentationPassed } from '../scripts/qa/android-instrumentation-result.mjs';

test('management local mode supplies its own isolated configuration', () => {
  const config = localFirebaseConfig(true);
  assert.equal(config.projectId, 'demo-sgm-local-qa');
  assert.match(config.databaseURL, /^http:\/\/127\.0\.0\.1:9000\//);
  assert.equal(config.apiKey, 'local-emulator-only-api-key');
  assert.throws(() => localFirebaseConfig(false), /development-only/);
});

test('Android local builds skip live Firebase resources and use a separate app sandbox', () => {
  const gradle = readFileSync(new URL('../android/app/build.gradle.kts', import.meta.url), 'utf8');
  assert.match(gradle, /if \(!useFirebaseEmulator && file\("google-services.json"\).exists\(\)\)/);
  assert.match(gradle, /if \(useFirebaseEmulator\) applicationIdSuffix = "\.local"/);
  assert.match(gradle, /if \(useFirebaseEmulator\) \{\s+sourceSets.getByName\("debug"\).manifest.srcFile\("src\/localDebug\/AndroidManifest.xml"\)/);
  const manifest = readFileSync(new URL('../android/app/src/main/AndroidManifest.xml', import.meta.url), 'utf8');
  assert.match(manifest, /android:windowSoftInputMode="adjustResize"/);
  assert(!manifest.includes('ACCESS_MOCK_LOCATION'));
  const runtime = readFileSync(new URL('../android/app/src/main/java/be/sportgreenmoove/app/services/FirebaseAndroidRuntime.kt', import.meta.url), 'utf8');
  assert.match(runtime, /check\(BuildConfig.DEBUG\)/);
  assert.match(runtime, /all \{ it.options.projectId == "demo-sgm-local-qa" \}/);
});

test('instrumentation must finish with the expected count, not just exit zero', () => {
  assertInstrumentationPassed('Time: 2\nOK (1 test)', 1);
  assertInstrumentationPassed('Time: 2\nOK (5 tests)', 5);
  for (const output of ['FAILURES!!!\nOK (5 tests)', 'Process crashed.', 'INSTRUMENTATION_FAILED', 'OK (1 test)', '']) {
    assert.throws(() => assertInstrumentationPassed(output, 5));
  }
});

test('search ownership is bound to the session and logout invalidates pending handlers', () => {
  const read = (name) => readFileSync(new URL(`../android/app/src/main/java/be/sportgreenmoove/app/ui/${name}.kt`, import.meta.url), 'utf8');
  const app = read('SportsGreenMooveApp');
  const owner = read('RememberSearchController');
  const requests = read('SearchRequests');
  assert.match(app, /sessionUid = session\?\.uid/);
  assert.match(app, /searchController.close\(\)/);
  assert(app.indexOf('searchController.close()') < app.indexOf('providers.auth.signOut()'));
  assert.match(owner, /remember\(providers, scope, sessionUid\)/);
  assert.match(owner, /onDispose \{ controller.close\(\) \}/);
  assert.match(requests, /currentCoroutineContext\(\).ensureActive\(\)/);
  assert.match(requests, /catch \(cancelled: CancellationException\) \{ throw cancelled \}/);
  assert.match(read('SearchRoute'), /key\(searchController\)/);
  assert.match(read('SearchRoute'), /onFormChange = searchController::updateForm/);
  assert.match(read('SearchController'), /criteria != currentCriteria\(\) \|\| match !in matches/);
});

test('the native booking gateway uses the selected seat payload and requires persisted SDK verification', () => {
  const gateway = readFileSync(new URL('../android/app/src/main/java/be/sportgreenmoove/app/services/FirebaseAndroidGateway.kt', import.meta.url), 'utf8');
  assert.match(gateway, /return bookingGateway.requestBooking\(trip, childId, seats\)/);
  const booking = readFileSync(new URL('../android/app/src/main/java/be/sportgreenmoove/app/services/FirebaseAndroidBookingGateway.kt', import.meta.url), 'utf8');
  assert.match(booking, /bookingRequestPayload\(trip, childId, seats\)/);
  const controller = readFileSync(new URL('../android/app/src/main/java/be/sportgreenmoove/app/ui/SearchController.kt', import.meta.url), 'utf8');
  assert.match(controller, /requestBooking\(match.summary, criteria.childUserId, criteria.seatsNeeded\)/);
  assert.match(controller, /match.tripId != match.summary.id/);
  const verifier = readFileSync(new URL('../scripts/qa/verify-local-multi-seat-sdk.mjs', import.meta.url), 'utf8');
  assert.match(verifier, /assert.equal\(snapshot.size, 1/);
  assert.match(verifier, /assert.equal\(booking.get\('seats'\), 2\)/);
  const local = readFileSync(new URL('../scripts/qa/run-local-flows.mjs', import.meta.url), 'utf8');
  assert.match(local, /assert.equal\(result.steps.length, 24\)/);
});

test('mock positions require an explicitly disposable emulator and a local-only manifest', () => {
  const runner = readFileSync(new URL('../scripts/qa/run-local-android-flows.mjs', import.meta.url), 'utf8');
  assert.match(runner, /assert.equal\(process.env.SGM_LOCAL_DISPOSABLE_EMULATOR, 'true'/);
  const local = readFileSync(new URL('../android/app/src/localDebug/AndroidManifest.xml', import.meta.url), 'utf8');
  assert.match(local, /ACCESS_MOCK_LOCATION/);
  const fixture = readFileSync(new URL('../android/app/src/androidTest/java/be/sportgreenmoove/app/ui/LocalMockLocation.kt', import.meta.url), 'utf8');
  assert.match(fixture, /session.getBoolean\("disposableEmulator"\)/);
});

test('local conversation evidence requires app execution and independent persisted-state checks', () => {
  const runner = readFileSync(new URL('../scripts/qa/local-android-session.mjs', import.meta.url), 'utf8');
  assert.match(runner, /instrument\(\['LocalChatFlowTest'\], 1\)/);
  assert.match(runner, /const chat = await verifyLocalChatUi\(\)/);
  assert.match(runner, /instrument\(\['LocalConversationDirectoryFlowTest'\], 1\)/);
  assert.match(runner, /const directory = await verifyLocalChatDirectoryUi\(directoryFixture\)/);
  assert.match(runner, /testCount: 36/);
  assert.match(runner, /instrument\(\['LocalMembershipFlowTest'\], 1\)/);
  assert.match(runner, /await verifyNativeMembershipUi\(\)/);
  assert.match(runner, /instrument\(\['LocalBookingDecisionsFlowTest'\], 1\)/);
  assert.match(runner, /await verifyReservationUi\(reservationFixture\)/);
  assert.match(runner, /'SearchSessionFlowTest', 'SearchCriteriaFlowTest'\], 9/);
  assert.match(runner, /instrument\(\['LocalMultiSeatSdkTest'\], 1\)/);
  assert.match(runner, /const multiSeatSdk = await verifyLocalMultiSeatSdk\(session.multiSeatTripId\)/);
  assert.match(runner, /component-ui-with-explicit-fake-gateway/);
  assert.match(runner, /collectNativeProcessFailure\(\{ adb, serial, directory: evidenceDir/);
  const failureDiagnostics = readFileSync(new URL('../scripts/qa/native-process-failure-evidence.mjs', import.meta.url), 'utf8');
  assert.match(failureDiagnostics, /'logcat', '-d', '-b', 'crash'/);
  assert.match(failureDiagnostics, /packageName = 'be.sportgreenmoove.app.local'/);
  assert.match(failureDiagnostics, /'dumpsys', 'activity', 'exit-info', packageName/);
  assert.match(runner, /throw failure/);
  const peer = readFileSync(new URL('../android/app/src/androidTest/java/be/sportgreenmoove/app/ui/LocalConversationPeer.kt', import.meta.url), 'utf8');
  assert.match(peer, /check\(BuildConfig.DEBUG && BuildConfig.SGM_USE_FIREBASE_EMULATOR\)/);
  assert.match(peer, /check\(options.projectId == "demo-sgm-local-qa"\)/);
  assert.match(peer, /app.delete\(\)/);
  const chat = readFileSync(new URL('../android/app/src/androidTest/java/be/sportgreenmoove/app/ui/LocalChatFlowTest.kt', import.meta.url), 'utf8');
  assert.match(chat, /captureLocalUi\(compose, "local-chat-landscape-draft.png", landscape = true\)/);
  assert.match(chat, /compose.waitUntil\(30_000\) \{ keyboardVisible\(\) \}/);
  assert.match(chat, /compose.waitUntil\(30_000\) \{ !keyboardVisible\(\) \}/);
  const send = chat.slice(chat.indexOf('private fun send('), chat.indexOf('private fun draft('));
  assert(send.indexOf('draft().isEmpty()') < send.indexOf('waitForText(body)'));
  assert.match(send, /boundsInRoot.top - restingTop/);
  assert.match(send, /throw failure/);
});

test('rotation cleanup preserves the inherited lock and waits for portrait before the next case', () => {
  for (const name of ['LocalLandscapeLoginTest', 'LocalThemeRestartTest']) {
    const fixture = readFileSync(new URL(`../android/app/src/androidTest/java/be/sportgreenmoove/app/ui/${name}.kt`, import.meta.url), 'utf8');
    assert.match(fixture, /val autoRotation = Settings.System.getInt\(context.contentResolver, Settings.System.ACCELEROMETER_ROTATION, 0\)/);
    const cleanup = fixture.slice(fixture.lastIndexOf('} finally {'));
    assert.match(cleanup, /device.setOrientationNatural\(\)/);
    assert.match(cleanup, /compose.waitUntil\(15_000\)/);
    assert.match(cleanup, /Configuration.ORIENTATION_PORTRAIT/);
    assert.match(cleanup, /device.displayWidth < device.displayHeight/);
    assert.match(cleanup, /waitForIdleSync\(\)/);
    assert.match(cleanup, /if \(autoRotation != 0\) device.unfreezeRotation\(\)/);
  }
});
test('chat replay retains keyboard, rotation and send checks without queuing a redundant hide', () => {
  const chat = readFileSync(new URL('../android/app/src/androidTest/java/be/sportgreenmoove/app/ui/LocalChatFlowTest.kt', import.meta.url), 'utf8');
  assert.match(chat, /if \(keyboardVisible\(\)\) \{/);
  assert.match(chat, /performClick\(\).assertIsFocused\(\)/);
  assert.match(chat, /compose.waitUntil\(30_000\) \{ keyboardVisible\(\) \}/);
  assert.match(chat, /device.displayWidth > device.displayHeight/);
  assert.match(chat, /windowFocused/);
  assert.match(chat, /draft\(\).isEmpty\(\)/);
  assert.match(chat, /writeSendDiagnostic\(phase, device\)/);
  assert.match(chat, /compose.waitUntil\(30_000\) \{ windowFocused\(\) \}/);
  assert.match(chat, /foregroundPackage/);
  assert.match(chat, /local-chat-native-window.png/);
});

test('landscape login requires real keyboard readiness and one submit touch without exposing credentials', () => {
  const root = '../android/app/src/androidTest/java/be/sportgreenmoove/app/ui/';
  const helper = readFileSync(new URL(root + 'AuthTestInteractions.kt', import.meta.url), 'utf8');
  const replay = readFileSync(new URL(root + 'LocalLandscapeLoginTest.kt', import.meta.url), 'utf8');
  assert(replay.includes('AuthTestInteractions(compose, activity).use'));
  assert(helper.includes('animations.isEmpty()'));
  assert(helper.includes('awaitKeyboard(true)') && helper.includes('awaitKeyboard(false)'));
  assert.equal(helper.match(/AuthEmailAction\)\.performScrollTo\(\).*\.performClick\(\)/g).length, 1);
  assert(helper.includes('compose.waitUntil(60_000)'));
  assert(helper.includes('throw failure'));
  assert(!helper.includes('Thread.sleep') && !helper.includes('performSemanticsAction'));
  assert(!helper.includes('.put("password",') && !helper.includes('.put("email",'));
});
