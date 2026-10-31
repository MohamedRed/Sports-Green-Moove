import assert from 'node:assert/strict';
import test from 'node:test';
import {cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {dirname, resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import { sessionTransportPhases, validateSessionTransportObservations } from '../scripts/qa/session-transport-observations.mjs';
import {disconnectRecheckFolder, validateDisconnectRecheck} from '../scripts/qa/session-disconnect-recheck-evidence.mjs';
import {content} from '../partner-portal/content.mjs';
import {validateRecoveryRecheck, recoveryRecheckFolder} from '../scripts/qa/session-recovery-recheck-evidence.mjs';
import {assertSessionRestorationSourceLayout} from '../scripts/qa/session-restoration-source-layouts.mjs';

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

test('the disconnect flow reuses the bounded prefix without claiming the longer restoration sequence', () => {
  const receipt = fixture(sessionTransportPhases.slice(0, 4));
  assert.deepEqual(validateSessionTransportObservations(receipt, runId), {scope: receipt.scope,
    observationCount: 4, failureObserved: false});
  assert.throws(() => validateSessionTransportObservations(receipt, runId, {complete: true}));
  const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
  const native = read('android/app/src/androidTest/java/be/sportgreenmoove/app/ui/LocalSessionDisconnectTest.kt');
  const observer = native.indexOf('val transport = LocalSessionTransportDiagnostics(');
  assert(native.indexOf('directory(context)') < observer);
  assert.equal((native.match(/runtime\.auth\.signIn\(/g) ?? []).length, 1);
  for (const phase of [...sessionTransportPhases.slice(0, 4), 'failure']) assert(native.includes(`transport.checkpoint("${phase}")`));
  assert(native.indexOf('transport.checkpoint("before-sign-in")') < native.indexOf('runtime.auth.signIn('));
  assert(native.indexOf('transport.checkpoint("initial-error")') < native.indexOf('.performClick()'));
  assert(native.includes('error.addSuppressed(diagnostic)')); assert(native.includes('failure?.let { throw it }'));
  const host = read('scripts/qa/local-session-disconnect-ui.mjs');
  assert(host.includes("transport = validateSessionTransportObservations(json('session-transport-observations.json'), session.runId)"));
  assert(host.includes('assert.equal(transport.failureObserved, false)'));
  assert(host.includes('assert.equal(transport.observationCount, 4)'));
  assert(host.includes('LocalSessionTransportDiagnostics.kt')); assert(host.includes('session-transport-observations.mjs'));
  assert(host.indexOf('assertSessionDisconnectStage(') < host.indexOf('if (failure) throw failure;'));
  assert(host.includes('verifySessionRestorationRecords(baseline,'));
});

test('restoration failures retain the live screen before activity closure without changing the replay', () => {
  const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
  const base = 'android/app/src/androidTest/java/be/sportgreenmoove/app/ui/';
  const capture = read(base + 'SessionFailureObservation.kt');
  for (const guard of ['BuildConfig.DEBUG && BuildConfig.SGM_USE_FIREBASE_EMULATOR', 'demo-sgm-local-qa',
    'disposableEmulator', 'getprop ro.kernel.qemu', 'check(!file.exists())', 'check(!screenshot.exists())']) assert(capture.includes(guard));
  assert.match(capture, /use \{ activity ->[\s\S]*try \{ block\(activity\) \}[\s\S]*observe\(activity\)/);
  assert(capture.includes('failure.addSuppressed(diagnostic)')); assert(capture.includes('throw failure'));
  assert(capture.indexOf('device.takeScreenshot(screenshot)') < capture.indexOf('fetchSemanticsNodes()'));
  assert(capture.indexOf('file.writeText(report.toString(2))') < capture.indexOf('fetchSemanticsNodes()'));
  assert(!/getIdToken|signIn\(|retry\(|svc |settings put|logcat|\.message|EditableText|\.text\b/.test(capture));
  const replay = read(base + 'LocalSessionRestorationTest.kt');
  assert(replay.includes('.useWithFailureObservation({ activity ->'));
  assert(replay.includes('captureSessionFailureBeforeClose(context, device, session, compose, phase, activity.state.name)'));
  assert(replay.includes('phase = "retry"')); assert(replay.includes('compose.waitUntil(60_000)'));
  assert.equal((replay.match(/runtime\.auth\.signIn\(/g) ?? []).length, 1);
  assert(read('scripts/qa/local-session-restoration-ui.mjs').includes('assertInstrumentationPassed(transcript, 1)'));
  const cases = read(base + 'SessionFailureObservationTest.kt');
  for (const name of ['originalFailureIsObservedWhileResumedAndRethrownAfterClosing',
    'failedObservationCannotReplaceTheOriginalFailureOrSkipClosing', 'successClosesWithoutGeneratingAFailureObservation']) assert(cases.includes(name));
  assert(cases.includes('assertSame(original, failure)')); assert(cases.includes('Lifecycle.State.DESTROYED'));
  for (const workflow of ['native-ci', 'web-integration-smoke']) {
    assert.equal(read('.github/workflows/' + workflow + '.yml').split('"android/app/src/androidTest/java/be/sportgreenmoove/app/ui/SessionFailureObservation*.kt"').length - 1, 2);
  }
});

const root = fileURLToPath(new URL('..', import.meta.url));
test('current session and owner-draft rechecks preserve separate failures and partial phone scope', () => {
  assert.deepEqual(validateRecoveryRecheck(root), {passedRestorationCases:1, passedChatCases:1,
    passedDiagnosticCases:3, fullNativeGateAccepted:false, releaseAccepted:false});
  const report = JSON.parse(readFileSync(resolve(root, recoveryRecheckFolder, 'restoration/session-restoration-results.json')));
  assertSessionRestorationSourceLayout(report.sourceFiles, 'transport-observed');
  assert.throws(() => assertSessionRestorationSourceLayout(report.sourceFiles));
  assert.throws(() => assertSessionRestorationSourceLayout(report.sourceFiles, 'failure-observed'));
  assert.throws(() => assertSessionRestorationSourceLayout(report.sourceFiles, 'unknown'));
  const original = {...report.sourceFiles};
  for (const key of Object.keys(original).filter(key => /android-case-apks|session-transport-observations|LocalSessionTransportDiagnostics/.test(key))) delete original[key];
  assertSessionRestorationSourceLayout(original);
  const candidate = {...report.sourceFiles, ['android/app/src/androidTest/java/be/sportgreenmoove/app/ui/SessionFailureObservation.kt']:'a'.repeat(64)};
  assertSessionRestorationSourceLayout(candidate, 'failure-observed');
  assert.throws(() => assertSessionRestorationSourceLayout({...candidate, 'extra.kt':'a'.repeat(64)}, 'failure-observed'));
  const flow = content.flows.find(row => row.id === 'messages'); assert.equal(flow.status, 'partial');
  assert.equal(flow.images.filter(row => !row.file.startsWith('chat-phone-pending-')).length, 25);
  assert.equal(flow.pendingSendRestartPhone.checkedAt, '2026-10-31'); assert.equal(flow.unsentDraftReplayPhone.checkedAt, '2026-10-31');
  assert.equal(flow.ownerDraftRecheck.checkedAt, '2026-10-31');
  for (const id of ['messages','session-restoration']) assert(content.updates.some(row => row.flow === id && row.source === recoveryRecheckFolder + 'README.md'));
});
for (const key of ['priorSessionFailureFixed','rootCauseOfSessionFailureConfirmed','fullNativeGateAccepted',
  'newFailureCaptureExercisedDuringSessionFailure','diskGuardCiVerified','physicalDeviceAccepted',
  'realNetworkLossVerified','productionWrites','releaseAccepted']) test('a rehashed recheck cannot promote ' + key, t => {
  const temp = mkdtempSync(resolve(tmpdir(), 'sgm-recovery-recheck-')); t.after(() => rmSync(temp, {recursive:true,force:true}));
  const folder = resolve(temp, recoveryRecheckFolder); cpSync(resolve(root, recoveryRecheckFolder), folder, {recursive:true});
  const archive = resolve(temp, 'docs/release/evidence/source-archive');
  symlinkSync(resolve(root, 'docs/release/evidence/source-archive'), archive);
  validateRecoveryRecheck(temp);
  const review = JSON.parse(readFileSync(resolve(folder,'review.json'))); review[key] = true;
  const bytes = JSON.stringify(review); writeFileSync(resolve(folder,'review.json'),bytes);
  const hashes = JSON.parse(readFileSync(resolve(folder,'artifact-sha256.json')));
  hashes['review.json'] = createHash('sha256').update(bytes).digest('hex');
  writeFileSync(resolve(folder,'artifact-sha256.json'),JSON.stringify(hashes));
  assert.throws(() => validateRecoveryRecheck(temp), new RegExp(key));
});
test('a passing disconnect replay retains its preceding auth failure and the original dated gallery', () => {
  assert.deepEqual(validateDisconnectRecheck(root), {failedInitialAuthAttempts: 1, passedNativeCases: 2,
    localDisconnectReplayAccepted: true, releaseAccepted: false});
  assert(content.updates.some(row => row.flow === 'session-disconnect' && row.source === disconnectRecheckFolder + 'README.md'));
  const flow = content.flows.find(row => row.id === 'session-disconnect');
  assert.equal(flow.status, 'partial'); assert.equal(flow.checkedAt, '2026-10-20');
  assert.equal(flow.ui.source, 'docs/release/evidence/session-disconnect-native-2026-10-20/session-disconnect-results.json');
  assert.equal(flow.images.length, 3); assert.equal(flow.tour.length, 3);
});
for (const key of ['priorAuthFailureFixed', 'rootCauseConfirmed', 'newDiagnosticsExercised', 'fullNativeGateAccepted',
  'physicalDeviceAccepted', 'realNetworkLossVerified', 'productionWrites', 'releaseAccepted'])
  test('rehashing the new replay cannot promote ' + key, t => {
    const temp = mkdtempSync(resolve(tmpdir(), 'sgm-disconnect-recheck-')); t.after(() => rmSync(temp, {recursive: true, force: true}));
    const folder = resolve(temp, disconnectRecheckFolder); cpSync(resolve(root, disconnectRecheckFolder), folder, {recursive: true});
    const archive = resolve(temp, 'docs/release/evidence/source-archive'); mkdirSync(dirname(archive), {recursive: true});
    symlinkSync(resolve(root, 'docs/release/evidence/source-archive'), archive);
    validateDisconnectRecheck(temp);
    const review = JSON.parse(readFileSync(resolve(folder, 'review.json'))); review[key] = true;
    const bytes = JSON.stringify(review); writeFileSync(resolve(folder, 'review.json'), bytes);
    const hashes = JSON.parse(readFileSync(resolve(folder, 'artifact-sha256.json')));
    hashes['review.json'] = createHash('sha256').update(bytes).digest('hex');
    writeFileSync(resolve(folder, 'artifact-sha256.json'), JSON.stringify(hashes));
    assert.throws(() => validateDisconnectRecheck(temp), new RegExp(key));
  });
