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
