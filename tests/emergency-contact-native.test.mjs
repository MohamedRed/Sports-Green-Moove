import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { XMLParser } from 'fast-xml-parser';
import { content } from '../partner-portal/content.mjs';
import { emergencyNativeChecks, emergencyNativeScreenshots, validateEmergencyDevice } from '../scripts/qa/emergency-contact-evidence.mjs';

const runId = 'a'.repeat(32), png = Buffer.alloc(24);
Buffer.from('89504e470d0a1a0a', 'hex').copy(png); png.writeUInt32BE(320, 16); png.writeUInt32BE(720, 20);
const hash = createHash('sha256').update(png).digest('hex');
const marker = () => ({ projectId: 'demo-sgm-local-qa', runId, scope: 'local-native-contact-ui-with-sdk-and-dialer-not-physical',
  checks: emergencyNativeChecks.map((id) => ({ id, status: 'passed' })),
  screenshots: Object.fromEntries(emergencyNativeScreenshots.map((name) => [name, hash])), dialerPackage: 'com.android.dialer',
  dialerActionObserved: 'android.intent.action.DIAL', directCallIntentCount: 0, dialerNumberMatched: true,
  managerRevokeRequestId: 'e0f9228a-c4f6-45ed-a273-139d9c191125' });
const receipt = () => ({ projectId: 'demo-sgm-local-qa', runId, scope: 'local-adb-file-sync-command-not-flow-verification',
  phase: 'emergency-contact', completed: true, status: 0, signal: null, errorCode: null });
const read = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('native contact proof requires exact original captures, complete checks and a dial-only handoff', () => {
  validateEmergencyDevice(marker(), receipt(), runId, () => png);
  for (const patch of [{ runId: 'b'.repeat(32) }, { projectId: 'production' }, { checks: marker().checks.slice(1) },
    { dialerPackage: 'be.sportgreenmoove.app.local' }, { dialerActionObserved: 'android.intent.action.CALL' },
    { directCallIntentCount: 1 }, { dialerNumberMatched: false }, { managerRevokeRequestId: 'unknown' },
    { screenshots: { ...marker().screenshots, 'extra.png': hash } }])
    assert.throws(() => validateEmergencyDevice({ ...marker(), ...patch }, receipt(), runId, () => png));
  const failed = marker(); failed.checks[0].status = 'failed';
  assert.throws(() => validateEmergencyDevice(failed, receipt(), runId, () => png));
  assert.throws(() => validateEmergencyDevice(marker(), receipt(), runId, () => Buffer.from('changed')));
  const blank = Buffer.from(png); blank.writeUInt32BE(0, 16);
  assert.throws(() => validateEmergencyDevice(marker(), receipt(), runId, () => blank));
});
test('later cleanup or failed evidence transfer cannot stand in for the primary contact copy', () => {
  for (const patch of [{ phase: 'failure-cleanup' }, { completed: false }, { status: 1 }, { signal: 'SIGTERM' },
    { errorCode: 'ETIMEDOUT' }, { runId: 'b'.repeat(32) }, { projectId: 'production' }])
    assert.throws(() => validateEmergencyDevice(marker(), { ...receipt(), ...patch }, runId, () => png));
});
test('the new replay is additive and verifies backend effects before successful cleanup and reporting', () => {
  const runner = read('scripts/qa/local-android-session.mjs'), replay = read('scripts/qa/local-emergency-contact-ui.mjs');
  assert(runner.includes("collectEvidence('emergency-contact')")); assert(runner.includes('testCount: 36, nativeCaseCount: 38'));
  assert(runner.indexOf('await replayGuardianParentUi') < runner.indexOf('await replayEmergencyContactUi'));
  assert(runner.indexOf('await replayEmergencyContactUi') < runner.indexOf("instrument(['LocalAppFlowTest'"));
  assert(read('scripts/qa/collect-local-ui-evidence.mjs').includes("'emergency-contact'"));
  assert(replay.indexOf('await verifyEmergencyNativeFixture') < replay.indexOf('await cleanupEmergencyNativeFixture'));
  assert(replay.indexOf('if (failure) throw failure') < replay.indexOf("'emergency-contact-results.json'"));
  assert(replay.includes('assertInstrumentationPassed')); assert(replay.includes('verificationPreseeded: false'));
  assert(replay.includes('authenticated-local-sdk-request-verify-revoke'));
  assert(replay.includes('childOwnAccountDialImplemented: false'));
  const fixture = read('scripts/qa/local-emergency-native-fixture.mjs');
  assert(fixture.includes("['p@example.test', 'request', 0], ['c@example.test', 'verify', 1]"));
  assert(fixture.includes("call('transitionGuardianVerification'"));
  for (const guard of ['assert.equal(operations.length, 3)', 'assert.deepEqual(await protectedState(), fixture.before)',
    "assert.equal(record.get('status'), 'revoked')", 'marker.managerRevokeRequestId']) assert(fixture.includes(guard), guard);
});
test('instrumented contact actions remain emulator-only with no direct call or fixture authority grant', () => {
  const native = read('android/app/src/androidTest/java/be/sportgreenmoove/app/ui/LocalEmergencyContactFlowTest.kt');
  for (const guard of ['BuildConfig.DEBUG && BuildConfig.SGM_USE_FIREBASE_EMULATOR', 'getprop ro.kernel.qemu',
    'activity.recreate()', 'assertEquals(0, directCall.hits)', 'assertEquals(1, dial.hits)', 'captureEmergencyDialer',
    'assertNull(removed.contact)', 'assertEquals(2L, removed.revision)']) assert(native.includes(guard), guard);
  assert(!native.includes('Intent(Intent.ACTION_CALL')); assert(!native.includes('CALL_PHONE'));
  const peer = read('android/app/src/androidTest/java/be/sportgreenmoove/app/ui/LocalEmergencyPeer.kt');
  assert(peer.includes('"action" to "revoke"')); assert(!peer.includes('"action" to "verify"'));
});
test('dialer waiting advances queued effects without changing the package predicate or deadline', () => {
  const native = read('android/app/src/androidTest/java/be/sportgreenmoove/app/ui/LocalEmergencyContactFlowTest.kt');
  assert(native.includes('awaitLocalExternalUi(compose, 60_000, { device.hasObject(By.pkg(dialerPackage)) })'));
  assert(!native.includes('device.wait(Until.hasObject'));
  const wait = read('android/app/src/androidTest/java/be/sportgreenmoove/app/ui/LocalExternalUiWait.kt');
  assert(wait.includes('compose.waitUntil(timeoutMillis)')); assert(wait.includes('check(appeared)'));
  assert(wait.includes('diagnostic.exceptionOrNull()?.let(failure::addSuppressed)')); assert(wait.includes('throw failure'));
  assert(wait.includes('diagnostic.getOrThrow()'));
  const diagnostic = read('android/app/src/androidTest/java/be/sportgreenmoove/app/ui/LocalEmergencyDialerDiagnostic.kt');
  for (const field of ['read-only-local-dialer-attempt-diagnostic-not-flow-verification', 'resolvedComponent', 'observedPackage',
    'dialIntentCount', 'directCallIntentCount', 'device.takeScreenshot', 'knownAppFeedback']) assert(diagnostic.includes(field), field);
  assert(!diagnostic.includes('session.getString("password")')); assert(!diagnostic.includes('dumpWindowHierarchy'));
});
test('the actual failed contact replay preserves observations without inventing a passing contact or full replay', () => {
  const base = 'docs/release/evidence/local-contact-dialer-failure-2026-10-18/';
  const hashes = JSON.parse(read(base + 'artifact-sha256.json')); assert.equal(Object.keys(hashes).length, 9);
  for (const [file, hash] of Object.entries(hashes)) {
    const raw = readFileSync(new URL('../' + base + file, import.meta.url));
    assert.equal(createHash('sha256').update(raw).digest('hex'), hash, file);
    if (!file.endsWith('.png')) assert.doesNotMatch(raw.toString('utf8'), /AIza[\w-]{20,}|Bearer\s+[\w.-]+|"password"\s*:/);
  }
  const transcript = read(base + 'LocalEmergencyContactFlowTest-instrumentation.txt');
  assert(transcript.includes('FAILURES!!!')); assert(transcript.includes('LocalEmergencyContactFlowTest.kt:58'));
  const receipt = JSON.parse(read(base + 'adb-pull-failure-cleanup.json'));
  assert.equal(receipt.runId, 'c070f1f81b73b785a68dc9584a383c52'); assert.equal(receipt.phase, 'failure-cleanup');
  assert.equal(receipt.completed, true); assert.notEqual(receipt.phase, 'emergency-contact');
  const suite = new XMLParser({ ignoreAttributes: false }).parse(read(base + 'ordinary-tests.xml')).testsuite;
  assert.equal(Number(suite['@_tests']), 136); assert.equal(Number(suite['@_skipped']), 33);
  assert.equal(Number(suite['@_failures']), 0); assert.equal(Number(suite['@_errors']), 0);
  assert.deepEqual(JSON.parse(read(base + 'native-suite-status.json')), {
    scope: 'native-suite-exit-status-not-flow-verification', ordinaryTests: 0, componentEvidence: 0, localReplay: 1 });
  const flow = content.flows.find((item) => item.id === 'emergency-contact'); assert.equal(flow.status, 'partial');
  assert.equal(flow.ui.checkedAt, '2026-10-19');
  assert.equal(flow.phone.source, 'docs/release/evidence/emergency-phone-2026-10-21/results.json');
  assert.match(flow.remaining, /reste à vérifier, sans appeler/);
  assert.equal(flow.images.filter((image) => image.file.startsWith('emergency-current-')).length, 7);
  assert.equal(flow.ui.source, 'docs/release/evidence/local-contact-identity-pass-2026-10-19/emergency-contact-results.json');
  assert(content.updates.some((item) => item.title === 'Les 34 parcours locaux vont jusqu’au bout'));
});
