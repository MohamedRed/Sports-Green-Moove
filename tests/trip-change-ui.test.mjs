import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { XMLParser } from 'fast-xml-parser';
import { assertTripChangeUiReceipt } from '../scripts/qa/trip-change-ui-evidence.mjs';

const read = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const nativePath = 'android/app/src/androidTest/java/be/sportgreenmoove/app/ui/LocalTripChangeFlowTest.kt';
const fixtures = Object.fromEntries(['confirmed', 'declined', 'withdrawn'].map((kind) => [kind, { tripId: 'test-' + kind }]));
const runId = 'a'.repeat(32);
const sample = () => ({ projectId: 'demo-sgm-local-qa', runId, scope: 'native-three-account-trip-consent-ui', completed: true,
  confirmedTripId: fixtures.confirmed.tripId, declinedTripId: fixtures.declined.tripId, withdrawnTripId: fixtures.withdrawn.tripId,
  firstParentPending: true, secondParentConfirmed: true, refusalVisible: true, withdrawalVisible: true, routeRequiredBeforeApplication: true });

test('trip consent evidence requires this run, exact fixture identities and every native outcome', () => {
  assertTripChangeUiReceipt(sample(), { fixtures, runId });
  for (const [key, value] of Object.entries(sample())) {
    assert.throws(() => assertTripChangeUiReceipt({ ...sample(), [key]: typeof value === 'boolean' ? false : 'other' }, { fixtures, runId }), key);
  }
});

test('the initial replay attempt remains unexecuted after a real PixelCopy failure', () => {
  const base = 'docs/release/evidence/local-trip-consent-native-2026-10-17/before-renderer/';
  const hashes = JSON.parse(read(base + 'artifact-sha256.json'));
  assert.equal(Object.keys(hashes).length, 2);
  for (const [name, hash] of Object.entries(hashes)) {
    assert.equal(createHash('sha256').update(readFileSync(new URL('../' + base + name, import.meta.url))).digest('hex'), hash);
  }
  const suite = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '', parseAttributeValue: true,
    isArray: (name) => name === 'testcase' }).parse(read(base + 'general-ui.xml')).testsuite;
  assert.equal(suite.tests, 102); assert.equal(suite.failures, 1); assert.equal(suite.skipped, 20);
  const failure = suite.testcase.filter((item) => Object.hasOwn(item, 'failure'));
  assert.equal(failure.length, 1); assert.match(failure[0].failure, /Failed waiting for PixelCopy/);
  const consent = suite.testcase.find((item) => item.classname.endsWith('.LocalTripChangeFlowTest'));
  assert(consent && Object.hasOwn(consent, 'skipped'));
  assert.match(read(base + 'trip-change-pixelcopy-logcat.txt'), /renderer version\(legacy\)/);
});

test('the new native case uses the real app and three isolated actors, not simulated gateways or a provider substitute', () => {
  const native = read(nativePath);
  for (const marker of ['BuildConfig.DEBUG && BuildConfig.SGM_USE_FIREBASE_EMULATOR', 'demo-sgm-local-qa',
    'ActivityScenario.launch(MainActivity::class.java)', 'AuthTestInteractions(compose, activity)',
    'tripChangeSecondParentEmail', 'tripChangeSecondBooking', 'Accords reçus : 1 / 2', 'Accords reçus : 2 / 2',
    'Votre refus est enregistré.', 'Proposition retirée, trajet initial conservé',
    'compose.onNodeWithTag("trip.change.apply").assertDoesNotExist()',
    'compose.onNodeWithTag("trip.change.calculate").performScrollTo().assertIsDisplayed().assertIsEnabled()',
    'File(directory, "local-trip-change-ui.json")']) assert(native.includes(marker), marker);
  for (const name of ['first-parent', 'both-parents', 'parent-refused', 'withdrawn']) {
    assert(native.includes(`capture("local-trip-change-${name}.png")`));
  }
  assert(!/setSgmUiTestContent|UiFlow.*Gateway|performSemanticsAction|quoteTripChange\(|applyTripChange\(/.test(native));
  assert.equal((native.match(/@Test fun /g) ?? []).length, 1);
  const open = native.slice(native.indexOf('private fun openReservation'), native.indexOf('private fun openDriverReview'));
  assert.match(open, /compose.waitUntil\(60_000\)\s*\{\s*runCatching \{ compose.onNodeWithTag\("reservation.change.\$id"\).assertIsEnabled\(\) \}.isSuccess\s*\}/);
  assert(open.indexOf('.assertIsEnabled() }.isSuccess') < open.indexOf('.performClick()'));
  assert(open.includes('compose.onNodeWithTag("bookings.error").assertDoesNotExist()'));
  const capture = native.slice(native.indexOf('private fun capture'), native.indexOf('private fun logout'));
  assert(capture.indexOf('"trip.change.busy"') < capture.indexOf('captureLocalUi(compose'));
  assert(capture.includes('compose.waitUntil(60_000)'));
  const runner = read('scripts/qa/local-android-session.mjs');
  assert(runner.includes("instrument(['LocalTripChangeFlowTest'], 1"));
  assert(runner.indexOf("collectEvidence('trip-change-parent-confirmation')") < runner.indexOf('await verifyTripChangeUi'));
  assert(runner.indexOf('await verifyTripChangeUi') < runner.indexOf('replayWithNetworkCleanup(adb'));
  assert(runner.includes('testCount: 36')); assert(runner.includes("'trip-change-parent-confirmation-ui'"));
});

test('passing ordinary screens cannot hide a process-stopped replay or accept an unexecuted consent stage', () => {
  const base = 'docs/release/evidence/local-trip-consent-native-2026-10-17/process-stopped/';
  const hashes = JSON.parse(read(base + 'artifact-sha256.json')); assert.equal(Object.keys(hashes).length, 4);
  for (const [name, hash] of Object.entries(hashes)) {
    assert.equal(createHash('sha256').update(readFileSync(new URL('../' + base + name, import.meta.url))).digest('hex'), hash);
  }
  const suite = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '', parseAttributeValue: true,
    isArray: (name) => name === 'testcase' }).parse(read(base + 'general-ui.xml')).testsuite;
  assert.equal(suite.tests, 102); assert.equal(suite.failures, 0); assert.equal(suite.errors, 0); assert.equal(suite.skipped, 20);
  assert(Object.hasOwn(suite.testcase.find((item) => item.classname.endsWith('.LocalTripChangeFlowTest')), 'skipped'));
  const statuses = JSON.parse(read(base + 'native-suite-status.json'));
  assert.equal(statuses.scope, 'native-suite-exit-status-not-flow-verification');
  assert.equal(statuses.ordinaryTests, 0); assert.equal(statuses.componentEvidence, 0); assert.equal(statuses.localReplay, 1);
  assert.match(read(base + 'LocalTripCancellationFlowTest-instrumentation.txt'), /shortMsg=Process crashed/);
  assert.equal(read(base + 'LocalTripCancellationFlowTest-crash.txt'), '');
});

test('eligible renderer prerequisites cannot promote an interrupted suite into a consent pass', () => {
  const base = 'docs/release/evidence/local-trip-consent-native-2026-10-17/eligible-runtime/';
  const hashes = JSON.parse(read(base + 'artifact-sha256.json')); assert.equal(Object.keys(hashes).length, 3);
  for (const [name, hash] of Object.entries(hashes)) {
    assert.equal(createHash('sha256').update(readFileSync(new URL('../' + base + name, import.meta.url))).digest('hex'), hash);
  }
  const metadata = JSON.parse(read(base + 'maps-runtime.json'));
  assert.equal(metadata.recordType, 'derived-field-summary-from-native-ci-log');
  assert.equal(metadata.sourceCommit, 'ff7d244edff67d360a4ec97f420f1387911a10b6');
  assert.deepEqual(metadata.mapsRuntime, { playStoreEnabled: true, playServicesEnabled: true, playServicesVersion: '24.23.35' });
  const suite = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '', parseAttributeValue: true,
    isArray: (name) => name === 'testcase' }).parse(read(base + 'general-ui.xml')).testsuite;
  assert.equal(suite.tests, 102); assert.equal(suite.failures, 1); assert.equal(suite.skipped, 20);
  assert.match(suite.testcase.find((item) => item.failure).failure, /Failed waiting for PixelCopy/);
  assert(Object.hasOwn(suite.testcase.find((item) => item.classname.endsWith('.LocalTripChangeFlowTest')), 'skipped'));
  assert.match(read(base + 'trip-change-pixelcopy-logcat.txt'), /renderer version\(legacy\)/);
});

test('the first executed consent attempt stays failed at the disabled parent control', () => {
  const base = 'docs/release/evidence/local-trip-consent-native-2026-10-17/first-consent-attempt/';
  const hashes = JSON.parse(read(base + 'artifact-sha256.json')); assert.equal(Object.keys(hashes).length, 7);
  for (const [name, hash] of Object.entries(hashes)) {
    assert.equal(createHash('sha256').update(readFileSync(new URL('../' + base + name, import.meta.url))).digest('hex'), hash);
  }
  assert.match(read(base + 'LocalTripChangeFlowTest-instrumentation.txt'), /Failed to assert the following: \(is enabled\)/);
  assert.match(read(base + 'LocalTripChangeFlowTest-instrumentation.txt'), /\[Disabled\]/);
  assert.match(read(base + 'LocalTripChangeFlowTest-instrumentation.txt'), /LocalTripChangeFlowTest.openReservation/);
  assert.match(read(base + 'LocalTripCancellationFlowTest-instrumentation.txt'), /OK \(1 test\)/);
  assert.equal(JSON.parse(read(base + 'native-suite-status.json')).localReplay, 1);
  const diagnostics = JSON.parse(read(base + 'LocalTripChangeFlowTest-diagnostics.json'));
  assert.equal(diagnostics.runId, '435f5ded82dc9ae293252c1c5b3749a3');
  assert.equal(diagnostics.scope, 'read-only-native-process-failure-diagnostic-not-flow-verification');
  assert.equal(diagnostics.records.length, 4); assert(diagnostics.records.every((item) => item.status === 'collected'));
  assert.equal(read(base + 'LocalTripChangeFlowTest-crash.txt'), '');
});

test('independent saved records, scoped parent reads and denials gate a non-full-run receipt', () => {
  const verifier = read('scripts/qa/local-trip-change-ui.mjs');
  for (const marker of ['auth.createUser', "roleKeys: ['parent']", "for (const kind of ['confirmed', 'declined', 'withdrawn'])",
    "await call('requestBooking'", "await call('approveBooking'", 'assertTripChangeUiReceipt(native, { fixtures, runId })',
    'assert.deepEqual(cleanTrip(trip), fixture.before', 'fixture.bookingsBefore[index]', 'assert.equal(changes.size, 1)',
    'assert.deepEqual(review.bookingIds, [fixture.bookingIds[index]])', "await denied('getTripChangeReview', outsider",
    "call('startRide', driver", 'A proposed change must be resolved before starting the ride.', 'assert.equal(notes.size, 5)',
    "recordType: 'native-trip-change-stage-not-full-run-result'", 'applicationExercised: false',
    'routeProviderExercised: false', 'paymentExercised: false', 'fullAppReplay: false', "{ flag: 'wx' }"]) assert(verifier.includes(marker), marker);
  assert(read('scripts/qa/collect-local-ui-evidence.mjs').includes("'trip-change-parent-confirmation'"));
  assert(!verifier.includes('quoteTripChangeApplication'));
  for (const path of ['scripts/qa/local-trip-change-ui.mjs', 'scripts/qa/trip-change-ui-evidence.mjs', nativePath]) {
    assert(read(path).split('\n').length < 300);
  }
  for (const workflow of ['native-ci.yml', 'web-integration-smoke.yml']) {
    assert.equal(read('.github/workflows/' + workflow).split('"tests/trip-change-ui.test.mjs"').length - 1, 2);
  }
  assert(JSON.parse(read('package.json')).scripts['test:local-flow-isolation'].includes('tests/trip-change-ui.test.mjs'));
});

test('passed native interaction and copied receipts do not accept interrupted independent verification', () => {
  const base = 'docs/release/evidence/local-trip-consent-native-2026-10-17/ui-passed-verification-interrupted/';
  const hashes = JSON.parse(read(base + 'artifact-sha256.json')); assert.equal(Object.keys(hashes).length, 12);
  for (const [name, hash] of Object.entries(hashes)) {
    assert.equal(createHash('sha256').update(readFileSync(new URL('../' + base + name, import.meta.url))).digest('hex'), hash);
  }
  assert.match(read(base + 'LocalTripChangeFlowTest-instrumentation.txt'), /OK \(1 test\)/);
  const native = JSON.parse(read(base + 'local-trip-change-ui.json'));
  assert.equal(native.runId, 'c54adf365a442d73d9ada2ff431ec247'); assert.equal(native.completed, true);
  const copy = JSON.parse(read(base + 'adb-pull-trip-change-parent-confirmation.json'));
  assert.equal(copy.runId, native.runId); assert.equal(copy.status, 0); assert.equal(copy.completed, true);
  assert.equal(copy.scope, 'local-adb-file-sync-command-not-flow-verification');
  assert.match(read(base + 'host-verification-error.txt'), /UND_ERR_SOCKET/);
  assert.match(read(base + 'host-verification-error.txt'), /verifyTripChangeUi/);
  assert.equal(JSON.parse(read(base + 'native-suite-status.json')).localReplay, 1);
  assert.match(read(base + 'local-http-unit.xml'), /<!-- pass 2 -->/);
  assert.match(read(base + 'local-http-unit.xml'), /<!-- fail 0 -->/);
  const service = JSON.parse(read(base + 'http-service-recheck.json'));
  assert.equal(service.runId, '19f3301bcb5bfc84c313eca2a600aa1e'); assert.notEqual(service.runId, native.runId);
  assert.equal(service.scope, 'local-emulated-services-not-phone-ui');
  assert.equal(service.steps.length, 24); assert(service.steps.every((item) => item.status === 'passed'));
});
