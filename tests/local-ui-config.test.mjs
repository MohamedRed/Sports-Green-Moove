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
  assert.match(runner, /testCount: 9/);
  const peer = readFileSync(new URL('../android/app/src/androidTest/java/be/sportgreenmoove/app/ui/LocalConversationPeer.kt', import.meta.url), 'utf8');
  assert.match(peer, /check\(BuildConfig.DEBUG && BuildConfig.SGM_USE_FIREBASE_EMULATOR\)/);
  assert.match(peer, /check\(options.projectId == "demo-sgm-local-qa"\)/);
  assert.match(peer, /app.delete\(\)/);
  const chat = readFileSync(new URL('../android/app/src/androidTest/java/be/sportgreenmoove/app/ui/LocalChatFlowTest.kt', import.meta.url), 'utf8');
  assert.match(chat, /captureLocalUi\(compose, "local-chat-landscape-draft.png", landscape = true\)/);
});
