import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { sessionTransportPhases, validateSessionTransportObservations } from '../scripts/qa/session-transport-observations.mjs';

const runId = 'a'.repeat(32);
function fixture(phases = sessionTransportPhases) {
  return { scope: 'read-only-local-session-transport-not-flow-verification', projectId: 'demo-sgm-local-qa', runId,
    networkSettingsChanged: false, authenticationRetried: false,
    observations: phases.map((phase, index) => ({ phase, elapsedRealtimeMs: index * 100, activeNetwork: true,
      internetCapability: true, validatedCapability: false, transports: ['wifi'],
      ...(['before-sign-in', 'failure'].includes(phase) ? { tcp: ['auth', 'functions', 'controlled-proxy'].map((service, i) =>
        ({ service, port: [9099, 5001, 40123][i], connected: true, failureKind: null })) } : {}) })) };
}
test('complete and pre-UI failed observations stay diagnostics, never flow or provider verification', () => {
  const result = validateSessionTransportObservations(fixture(), runId, { complete: true });
  assert.deepEqual(result, { scope: fixture().scope, observationCount: 8, failureObserved: false });
  const failed = fixture(['before-sign-in', 'failure']);
  failed.observations[1].tcp[0].connected = false;
  failed.observations[1].tcp[0].failureKind = 'ConnectException';
  assert.equal(validateSessionTransportObservations(failed, runId).failureObserved, true);
  assert.throws(() => validateSessionTransportObservations(failed, runId, { complete: true }));
  assert.throws(() => validateSessionTransportObservations(fixture(sessionTransportPhases.slice(0, 7)), runId, { complete: true }));
});
for (const [name, mutate] of [
  ['wrong run', value => { value.runId = 'b'.repeat(32); }],
  ['real project', value => { value.projectId = 'sports-green-moove-prod'; }],
  ['network repair', value => { value.networkSettingsChanged = true; }],
  ['retry', value => { value.authenticationRetried = true; }],
  ['reordered phases', value => { value.observations.reverse(); }],
  ['duplicate phase', value => { value.observations[1].phase = value.observations[0].phase; }],
  ['missing sign-in boundary', value => { value.observations.splice(1, 1); }],
  ['secret field', value => { value.observations[0].token = 'synthetic-private-value'; }],
  ['wrong endpoint', value => { value.observations[0].tcp[0].port = 443; }],
  ['external host', value => { value.observations[0].tcp[0].host = 'external.example'; }],
  ['unbounded endpoint', value => { value.observations[0].tcp[2].port = 65536; }],
  ['raw error', value => { value.observations[0].tcp[0].failureKind = 'sensitive raw error'; }],
  ['invalid clock', value => { value.observations[1].elapsedRealtimeMs = -1; }],
  ['identifier as transport', value => { value.observations[0].transports.push('private-ssid'); }],
]) test(`${name} cannot be accepted as a bounded transport observation`, () => {
  const value = fixture(); mutate(value); assert.throws(() => validateSessionTransportObservations(value, runId));
});
test('failure must end the trace and use the same controlled proxy endpoint', () => {
  const changed = fixture(['before-sign-in', 'failure']); changed.observations[1].tcp[2].port++;
  assert.throws(() => validateSessionTransportObservations(changed, runId));
  const continued = fixture(['before-sign-in', 'failure', 'signed-in']);
  assert.throws(() => validateSessionTransportObservations(continued, runId));
});
test('native diagnostics only observe local sockets and do not weaken original UI or stored-state assertions', () => {
  const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
  const probe = read('android/app/src/androidTest/java/be/sportgreenmoove/app/ui/LocalSessionTransportDiagnostics.kt');
  for (const guard of ['BuildConfig.DEBUG && BuildConfig.SGM_USE_FIREBASE_EMULATOR', 'demo-sgm-local-qa',
    'disposableEmulator', 'getprop ro.kernel.qemu', 'read-only-local-session-transport-not-flow-verification']) assert(probe.includes(guard));
  assert(!/svc |settings put|requestNetwork|bindProcess|retry\(|repeat\(|while\s*\(|\.message|ssid|Authorization/.test(probe));
  const native = read('android/app/src/androidTest/java/be/sportgreenmoove/app/ui/LocalSessionRestorationTest.kt');
  assert.equal((native.match(/runtime\.auth\.signIn\(/g) ?? []).length, 1);
  for (const phase of [...sessionTransportPhases, 'failure']) assert(native.includes(`transport.checkpoint("${phase}")`));
  assert(native.indexOf('transport.checkpoint("before-sign-in")') < native.indexOf('runtime.auth.signIn('));
  assert(native.indexOf('transport.checkpoint("failure")') < native.indexOf('finally {'));
  assert(native.includes('error.addSuppressed(diagnostic)')); assert(native.includes('failure?.let { throw it }'));
  assert(native.includes('compose.waitUntil(60_000)')); assert(native.includes('assertEquals(4, control('));
  const host = read('scripts/qa/local-session-restoration-ui.mjs');
  assert(host.includes('session.runId, { complete: true }')); assert(host.includes('verifySessionRestorationRecords(baseline,'));
  assert(host.includes('assertInstrumentationPassed(transcript, 1)')); assert(host.includes('if (failure) throw failure;'));
  assert(host.includes('LocalSessionTransportDiagnostics.kt')); assert(host.includes('session-transport-observations.mjs'));
  for (const workflow of ['native-ci', 'web-integration-smoke']) {
    const text = read(`.github/workflows/${workflow}.yml`);
    assert.equal(text.split('"tests/session-transport-observations.test.mjs"').length - 1, 2);
    assert(text.includes('node --test tests/session-transport-observations.test.mjs '));
  }
});
