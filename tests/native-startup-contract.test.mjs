import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const text = (file) => readFileSync(new URL('../' + file, import.meta.url), 'utf8');
const service = (name) => text(`android/app/src/main/java/be/sportgreenmoove/app/services/${name}.kt`);
test('a native start requires one matching acknowledgement, not a positive write count or any ignored point', () => {
  const startup = service('FirebaseAndroidNativeLocationStartup');
  assert(startup.indexOf('requireNativeLocationAcknowledgement(result.data, update)') < startup.indexOf('startForegroundService'));
  assert(startup.indexOf('requireOwner()', startup.indexOf('requireNativeLocationAcknowledgement')) < startup.indexOf('startForegroundService'));
  const parser = service('NativeLocationAcknowledgement');
  for (const fragment of ['singleOrNull()', 'receipt["rideSessionId"]', 'receipt["role"]', 'receipt["capturedAt"]',
    '"retained" ->', '"written" ->', 'else -> invalid()', 'written + ignored != 1L']) assert(parser.includes(fragment));
  assert(!startup.includes('written <= 0')); assert(!startup.includes('runCatching'));
});
test('the atomic outcome distinguishes valid retained observations from invalid inputs and actual commits', () => {
  const writer = text('functions/src/lib/liveTrips.ts');
  assert(writer.includes('return await writeLiveLocationOutcome(update) === "written"'));
  assert(writer.includes('return result.committed ? "written" : outcome'));
  assert(writer.indexOf('const now = Date.now()') > writer.indexOf('.transaction('));
  assert(writer.includes('hasValidLocationCapture(update, now) ? "retained" : "invalid"'));
  const callable = text('functions/src/callables/locations.ts');
  assert(callable.indexOf('if (!canWriteLiveLocation') < callable.indexOf('writeLiveLocationOutcome(update)'));
  for (const fragment of ['ignored: results.length - written', 'receipts', 'role: updates[index].role', 'capturedAt: updates[index].capturedAt']) assert(callable.includes(fragment));
});
test('native startup proof requires its original case, primary copy and completed cleanup before promotion', () => {
  const replay = text('scripts/qa/local-native-startup-ui.mjs');
  for (const fragment of ['await execute(adb', 'assertInstrumentationPassed(transcript, 1)', "phase: 'native-startup'",
    'setLocalMockPermission(shell, originalMockMode)', 'await verifyReadOnlyRideFixtureIsolation(fixture)', 'resetDisposableLocalApps(adb, serial)']) assert(replay.includes(fragment));
  assert(replay.indexOf('if (failure) throw failure') < replay.indexOf("'native-startup-app-results.json'"));
  assert(!replay.includes('isolatedFixtureCleanupVerified'));
  assert(text('scripts/qa/run-local-native-startup-ui.mjs').includes("await runIsolatedRideUi('native-startup')"));
  const owner = text('scripts/qa/run-isolated-ride-ui.mjs');
  for (const fragment of ['runtime.cleanup()', '!existsSync(runtime.temp)', 'await assertLocalEndpointsClosed(ports)'])
    assert(owner.indexOf(fragment) < owner.indexOf('`${name}-results.json`'));
  assert(owner.indexOf('if (failure) throw failure') < owner.indexOf('`${name}-results.json`'));
  assert(!replay.includes('process.exit('));
  const suite = text('scripts/run-focused-android-ui.sh');
  assert(suite.indexOf('run-local-ride-observation-ui.mjs') < suite.indexOf('run-local-native-startup-ui.mjs'));
  assert(suite.includes('if [[ "$observation_status" -ne 0 ]]; then exit "$observation_status"; fi'));
  assert(suite.includes('if [[ "$startup_status" -ne 0 ]]; then exit "$startup_status"; fi'));
});
test('the synthetic sensor keeps one capture identity and must stop without suppressing errors', () => {
  const feed = text('android/app/src/androidTest/java/be/sportgreenmoove/app/ui/LocalMockLocationFeed.kt');
  for (const fragment of ['emit(capturedAt)', 'sensorError.compareAndSet(null, error)', 'task.cancel(false)',
    'scheduler.shutdown()', 'scheduler.awaitTermination(20, TimeUnit.SECONDS)', 'failure?.let { throw it }'])
    assert(feed.includes(fragment));
  assert(!feed.includes('System.currentTimeMillis'));
  const trial = text('android/app/src/androidTest/java/be/sportgreenmoove/app/ui/LocalNativeTrackingStartupTest.kt');
  assert.equal((trial.match(/step\(capturedAt\)/g) ?? []).length, 2);
  assert(trial.includes('step(System.currentTimeMillis() + 86_400_000)'));
  assert(trial.includes('printToString().replace(session.getString("password"), "[REDACTED]")'));
});
test('window captures await one committed frame and one successful copy without a secondary image path', () => {
  const capture = text('android/app/src/androidTest/java/be/sportgreenmoove/app/ui/LocalNativeStartupCapture.kt');
  for (const fragment of ['registerFrameCommitCallback', 'unregisterFrameCommitCallback', 'getLocationInWindow',
    'HardwareRendererCompat.setDrawingEnabled(true)', 'HardwareRendererCompat.setDrawingEnabled(drawingEnabled)',
    'val decor = window.decorView', 'decor.invalidate()',
    'PixelCopy.request(window, rectangle, bitmap', 'copied.await(10, TimeUnit.SECONDS)', 'result.get() == PixelCopy.SUCCESS',
    'check(!output.exists())', 'colors.size > 16']) assert(capture.includes(fragment));
  assert(!capture.includes('uiAutomation.takeScreenshot')); assert(!capture.includes('captureToImage'));
  assert.equal((capture.match(/PixelCopy.request\(/g) ?? []).length, 1);
});
