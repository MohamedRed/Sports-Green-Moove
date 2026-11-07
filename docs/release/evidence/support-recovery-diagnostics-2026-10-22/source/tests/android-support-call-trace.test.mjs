import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { validateSupportDiagnosticEvidence, validateSupportDiagnosticScope } from '../scripts/qa/support-recovery-diagnostic-evidence.mjs';
const read = file => readFileSync(file, 'utf8');
test('support request-boundary tracing is opt-in, local-only, debug-only and off for release', () => {
  const gradle = read('android/app/build.gradle.kts');
  assert(gradle.includes('check(!localSupportTrace || useFirebaseEmulator)'));
  assert(gradle.includes('buildConfigField("Boolean", "SGM_LOCAL_SUPPORT_TRACE", "false")'));
  assert(gradle.indexOf('getByName("debug")') < gradle.indexOf('localSupportTrace.toString()'));
  const observer = read('android/app/src/main/java/be/sportgreenmoove/app/services/LocalSupportCallDiagnostics.kt');
  assert(observer.includes('BuildConfig.DEBUG && BuildConfig.SGM_USE_FIREBASE_EMULATOR && BuildConfig.SGM_LOCAL_SUPPORT_TRACE'));
  assert(observer.includes('JSONObject(fields).toString()'));
  assert.doesNotMatch(observer, /\.data|\.exception|password|authToken|description|reason|payload/);
});
test('observing a task does not replace the production callable, catch its error or change awaiting its result', () => {
  const gateway = read('android/app/src/main/java/be/sportgreenmoove/app/services/FirebaseAndroidGateway.kt');
  const method = gateway.slice(gateway.indexOf('override suspend fun createReport('), gateway.indexOf('override suspend fun writeNativeLocationFallback'));
  assert(method.includes('functions.getHttpsCallable("submitSupportReport").call(submission.payload())'));
  assert(method.includes('LocalSupportCallDiagnostics.observe(submission.requestId, task)'));
  assert(method.includes('val result = task.await()')); assert.doesNotMatch(method, /catch|retry|delay/);
});
test('the second expired phone experiment remains incomplete and its observer is only compiled', () => {
  const source = 'docs/release/evidence/support-recovery-diagnostics-2026-10-22/summary.json';
  const report = validateSupportDiagnosticEvidence(process.cwd(), source);
  for (const key of ['physicalRecoveryAccepted', 'replayOriginEstablished', 'sdkInvocationsMeasured',
    'callDiagnosticsPhysicalDeviceVerified', 'runnerReadinessRemoteVerified', 'releaseComplete'])
    assert.throws(() => validateSupportDiagnosticScope({ ...report, [key]: true }));
});
