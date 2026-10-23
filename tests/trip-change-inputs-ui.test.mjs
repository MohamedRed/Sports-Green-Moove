import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { XMLParser } from 'fast-xml-parser';
import { assertInstrumentationPassed } from '../scripts/qa/android-instrumentation-result.mjs';
import { content, captures } from '../partner-portal/content.mjs';
import { assertTripChangeInputsReceipt, assertTripChangeInputsRecords } from '../scripts/qa/trip-change-inputs-evidence.mjs';

const bytes = (path) => readFileSync(new URL('../' + path.split('/').map(encodeURIComponent).join('/'), import.meta.url));
const read = (path) => bytes(path).toString('utf8');
const fixture = { tripId: 'trip-inputs', bookingId: 'booking-inputs',
  originalDepartureAt: '2026-10-18T09:00:00.000Z', proposedDepartureAt: '2026-10-18T10:00:00.000Z',
  before: { departureAt: '2026-10-18T09:00:00.000Z', priceCents: 250, seatsAvailable: 3,
    origin: { lat: 50.7167, lng: 4.6167 }, destination: { lat: 50.8503, lng: 4.3517 } },
  bookingBefore: { status: 'approved', seats: 1, parentUserId: 'parent', paymentStatus: 'unpaid' } };
const runId = 'a'.repeat(32);
const receipt = () => ({ projectId: 'demo-sgm-local-qa', runId, completed: true,
  scope: 'native-trip-change-time-and-address-safety-ui', tripId: fixture.tripId, bookingId: fixture.bookingId,
  originalDepartureAt: fixture.originalDepartureAt, proposedDepartureAt: fixture.proposedDepartureAt,
  nativeTimePickerUsed: true, unconfirmedOriginBlocked: true, unconfirmedDestinationBlocked: true,
  originalPlacesExplicitlyKept: true, parentSawBothTimes: true, parentConfirmed: true, missingRouteBlockedApplication: true });
function records() {
  const originalTerms = { departureAt: fixture.originalDepartureAt, arrivalBy: null, priceCents: 250,
    origin: structuredClone(fixture.before.origin), destination: structuredClone(fixture.before.destination) };
  return { trip: { ...structuredClone(fixture.before), pendingChangeId: 'proposal', updatedAt: 'now' },
    booking: structuredClone(fixture.bookingBefore), proposalId: 'proposal', parentUid: 'parent', driverUid: 'driver',
    change: { tripId: fixture.tripId, driverUserId: 'driver', status: 'confirmed', originalTerms,
      terms: { ...structuredClone(originalTerms), departureAt: '2026-10-18T10:00:00Z', priceCents: 400 },
      parentUserIds: ['parent'], bookingIds: [fixture.bookingId], decisions: { parent: { decision: 'accept' } } } };
}

test('every input-stage identity and actual native outcome is mandatory and run-bound', () => {
  assertTripChangeInputsReceipt(receipt(), fixture, runId);
  for (const [key, value] of Object.entries(receipt())) {
    assert.throws(() => assertTripChangeInputsReceipt({ ...receipt(), [key]: typeof value === 'boolean' ? false : 'stale' }, fixture, runId), key);
    const missing = receipt(); delete missing[key];
    assert.throws(() => assertTripChangeInputsReceipt(missing, fixture, runId), 'missing ' + key);
  }
});

test('saved proposal requires exact changed time, retained coordinates, one affected parent and unchanged original records', () => {
  assertTripChangeInputsRecords(records(), fixture);
  const mutations = [
    (r) => { r.trip.departureAt = fixture.proposedDepartureAt; },
    (r) => { r.trip.priceCents = 400; }, (r) => { r.trip.seatsAvailable = 2; },
    (r) => { r.trip.pendingChangeId = 'other'; }, (r) => { r.booking.paymentStatus = 'paid'; },
    (r) => { r.booking.status = 'cancelled'; }, (r) => { r.change.status = 'pending'; },
    (r) => { r.change.tripId = 'other'; }, (r) => { r.change.driverUserId = 'other'; },
    (r) => { r.change.parentUserIds = ['other']; }, (r) => { r.change.bookingIds = ['other']; },
    (r) => { r.change.decisions.parent.decision = 'decline'; },
    (r) => { r.change.decisions.outsider = { decision: 'accept' }; },
    (r) => { r.change.application = {}; },
    (r) => { r.change.originalTerms.departureAt = fixture.proposedDepartureAt; },
    (r) => { r.change.terms.departureAt = fixture.originalDepartureAt; },
    (r) => { r.change.terms.departureAt = 'not-a-time'; },
    (r) => { r.change.terms.priceCents = 250; }, (r) => { r.change.originalTerms.priceCents = 400; },
    (r) => { r.change.terms.origin.lat = 0; }, (r) => { r.change.terms.destination.lng = 0; },
    (r) => { r.change.originalTerms.origin.lat = 0; }, (r) => { r.change.originalTerms.destination.lng = 0; },
    (r) => { r.change.terms.arrivalBy = fixture.proposedDepartureAt; },
    (r) => { r.change.originalTerms.arrivalBy = fixture.proposedDepartureAt; },
  ];
  for (const mutate of mutations) { const input = records(); mutate(input); assert.throws(() => assertTripChangeInputsRecords(input, fixture)); }
});

test('the real app uses the native picker and existing address actions without bypasses or provider substitutes', () => {
  const native = read('android/app/src/androidTest/java/be/sportgreenmoove/app/ui/LocalTripChangeInputsFlowTest.kt');
  for (const marker of ['BuildConfig.DEBUG && BuildConfig.SGM_USE_FIREBASE_EMULATOR', 'demo-sgm-local-qa',
    'ActivityScenario.launch(MainActivity::class.java)', 'AuthTestInteractions(compose, activity)', 'enterNativePickerTime(proposedTime)',
    'trip.change.validation', '.assertIsNotEnabled()', 'trip.change.$place.keep', 'assertTerms("original", original',
    'assertTerms("proposed", proposed', 'Accords reçus : 1 / 1', 'Itinéraire non confirmé. Actualisez avant de réessayer.',
    '"trip.change.quote").assertDoesNotExist()', '"trip.change.apply").assertDoesNotExist()', 'local-trip-change-inputs-ui.json']) {
    assert(native.includes(marker), marker);
  }
  assert(!/setSgmUiTestContent|UiFlow.*Gateway|performSemanticsAction|runOnUiThread|quoteTripChange\(|applyTripChange\(/.test(native));
  const picker = read('android/app/src/androidTest/java/be/sportgreenmoove/app/ui/NativeTimePickerInput.kt');
  for (const id of ['toggle_mode', 'input_hour', 'input_minute', 'button1']) assert(picker.includes(`"${id}"`));
  assert(!/catch|retry|Thread.sleep|tap\(/.test(picker));
  const verifier = read('scripts/qa/local-trip-change-inputs-ui.mjs');
  for (const marker of ['assertTripChangeInputsReceipt(native, fixture, runId)', 'assertTripChangeInputsRecords(',
    'assert.equal(changes.size, 1)', 'assert.equal(quotes.size, 0', 'assert.equal(notes.size, 3)',
    "denied('getTripChangeReview', outsider", 'successfulRouteChangeExercised: false', 'applicationExercised: false',
    'routeProviderExercised: false', 'paymentExercised: false', 'datePickerExercised: false', 'fullAppReplay: false',
    "{ flag: 'wx' }"]) assert(verifier.includes(marker), marker);
  assert(!/proposeTripChange|respondToTripChange|quoteTripChange|applyTripChange/.test(verifier));
  const runner = read('scripts/qa/local-android-session.mjs');
  assert(runner.includes("instrument(['LocalTripChangeInputsFlowTest'], 1"));
  assert(runner.indexOf("collectEvidence('trip-change-inputs')") < runner.indexOf('await verifyTripChangeInputsUi'));
  assert(runner.indexOf('await verifyTripChangeInputsUi') < runner.indexOf('replayWithNetworkCleanup(adb'));
  assert(runner.includes('testCount: 37')); assert(runner.includes("'trip-change-inputs-ui'"));
  assert(read('scripts/qa/collect-local-ui-evidence.mjs').includes("'trip-change-inputs'"));
  for (const workflow of ['native-ci.yml', 'web-integration-smoke.yml']) {
    assert.equal(read('.github/workflows/' + workflow).split('"tests/trip-change-inputs-ui.test.mjs"').length - 1, 2);
  }
  assert(JSON.parse(read('package.json')).scripts['test:local-flow-isolation'].includes('tests/trip-change-inputs-ui.test.mjs'));
  for (const path of ['scripts/qa/local-trip-change-inputs-ui.mjs', 'scripts/qa/trip-change-inputs-evidence.mjs',
    'android/app/src/androidTest/java/be/sportgreenmoove/app/ui/LocalTripChangeInputsFlowTest.kt',
    'android/app/src/androidTest/java/be/sportgreenmoove/app/ui/NativeTimePickerInput.kt']) assert(read(path).split('\n').length < 300);
});

test('a later passed consent interaction cannot promote a failed primary evidence copy or an unexecuted input stage', () => {
  const base = 'docs/release/evidence/local-trip-consent-native-2026-10-17/copy-interrupted/';
  const hashes = JSON.parse(read(base + 'artifact-sha256.json')); assert.equal(Object.keys(hashes).length, 6);
  for (const [name, hash] of Object.entries(hashes)) {
    assert.equal(createHash('sha256').update(readFileSync(new URL('../' + base + name, import.meta.url))).digest('hex'), hash);
  }
  const suite = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '', parseAttributeValue: true,
    isArray: (name) => name === 'testcase' }).parse(read(base + 'general-ui.xml')).testsuite;
  assert.equal(suite.tests, 102); assert.equal(suite.failures, 0); assert.equal(suite.errors, 0); assert.equal(suite.skipped, 20);
  assert(!suite.testcase.some((item) => item.classname.endsWith('.LocalTripChangeInputsFlowTest')));
  assert.match(read(base + 'LocalTripChangeFlowTest-instrumentation.txt'), /OK \(1 test\)/);
  const receipt = JSON.parse(read(base + 'local-trip-change-ui.json'));
  assert.equal(receipt.completed, true); assert.equal(receipt.runId, '4b698d4d8dc0639a941c0d426dd48a5c');
  const primary = JSON.parse(read(base + 'adb-pull-trip-change-parent-confirmation.json'));
  const cleanup = JSON.parse(read(base + 'adb-pull-failure-cleanup.json'));
  assert.equal(primary.runId, receipt.runId); assert.equal(cleanup.runId, receipt.runId);
  assert.equal(primary.status, 1); assert.equal(primary.completed, false); assert.equal(primary.signal, null); assert.equal(primary.errorCode, null);
  assert.match(primary.version, /37.0.1-15733141/); assert.match(primary.stderr, /local-parent-home.png: 16%/);
  assert.equal(cleanup.status, 0); assert.equal(cleanup.completed, true); assert.match(cleanup.stderr, /52 files pulled, 0 skipped/);
  const statuses = JSON.parse(read(base + 'native-suite-status.json'));
  assert.equal(statuses.ordinaryTests, 0); assert.equal(statuses.componentEvidence, 0); assert.equal(statuses.localReplay, 1);
});

const completedBase = 'docs/release/evidence/local-trip-change-inputs-native-2026-10-17/completed/';
const completed = (name) => JSON.parse(read(completedBase + name));

test('completed input proof preserves all 26 groups, 18 transcripts, seven acknowledged copies and byte-exact raw records', () => {
  for (const extension of ['xml', 'txt']) assert(read('.gitattributes').includes(
    `docs/release/evidence/local-trip-change-inputs-native-2026-10-17/**/*.${extension} -text -whitespace`));
  const hashes = completed('artifact-sha256.json'); assert.equal(Object.keys(hashes).length, 56);
  for (const [name, hash] of Object.entries(hashes)) assert.equal(createHash('sha256').update(bytes(completedBase + name)).digest('hex'), hash, name);
  const run = completed('results.json'); assert.equal(run.projectId, 'demo-sgm-local-qa');
  assert.equal(run.runId, '2dae75bc30e1a74213d7aa90cd652ee8'); assert.equal(run.testedAt, '2026-10-17T16:16:10.935Z');
  assert.equal(run.scope, 'local-ui-not-physical-device'); assert.equal(run.testCount, 26); assert.equal(run.steps.length, 26);
  const old = JSON.parse(read('docs/release/evidence/local-trip-consent-native-2026-10-17/completed/results.json'));
  assert.deepEqual(run.steps.map((s) => s.id).sort(), [...old.steps.map((s) => s.id), 'trip-change-inputs-ui'].sort());
  assert(run.steps.every((s) => s.status === 'passed')); assert.equal(new Set(run.steps.map((s) => s.id)).size, 26);
  const transcripts = Object.keys(hashes).filter((name) => name.endsWith('-instrumentation.txt'));
  assert.equal(transcripts.length, 18);
  for (const name of transcripts) assertInstrumentationPassed(read(completedBase + name), name.startsWith('LocalAppFlowTest-') ? 9 : 1);
  const copies = Object.keys(hashes).filter((name) => name.startsWith('adb-pull-'));
  assert.equal(copies.length, 7);
  for (const name of copies) {
    const receipt = completed(name); assert.equal(receipt.runId, run.runId);
    assert.equal(receipt.completed, true); assert.equal(receipt.status, 0); assert.equal(receipt.signal, null); assert.equal(receipt.errorCode, null);
  }
  assert.deepEqual(completed('trip-change-ui-stage.json'), run.tripChanges);
  assert.deepEqual(completed('trip-change-inputs-ui-stage.json'), run.tripChangeInputs);
  const statuses = completed('native-suite-status.json');
  assert.equal(statuses.ordinaryTests, 0); assert.equal(statuses.componentEvidence, 0); assert.equal(statuses.localReplay, 0);
  const suite = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '', parseAttributeValue: true,
    isArray: (name) => name === 'testcase' }).parse(read(completedBase + 'general-ui.xml')).testsuite;
  assert.equal(suite.tests, 103); assert.equal(suite.failures, 0); assert.equal(suite.errors, 0); assert.equal(suite.skipped, 21);
});

test('reviewed time and unavailable-route captures require the independently verified stage without expanding its scope', () => {
  const stage = completed('trip-change-inputs-ui-stage.json');
  assert.equal(stage.recordType, 'native-trip-change-inputs-stage-not-full-run-result');
  assert.equal(stage.testedAt, '2026-10-17T16:14:42.628Z'); assert.equal(stage.testCount, 1);
  assertTripChangeInputsReceipt(completed('local-trip-change-inputs-ui.json'), stage, stage.runId);
  for (const key of ['tripAndBookingUnchanged', 'parentViewScoped', 'outsiderDenied']) assert.equal(stage[key], true);
  for (const key of ['applicationExercised', 'successfulRouteChangeExercised', 'routeProviderExercised',
    'paymentExercised', 'datePickerExercised', 'fullAppReplay']) assert.equal(stage[key], false);
  assert.equal(stage.notificationCount, 3);
  const flow = content.flows.find((item) => item.id === 'publication'); assert.equal(flow.status, 'partial');
  assert.equal(flow.ui.source, 'docs/release/evidence/local-trip-history-2026-10-18/completed-native/results.json');
  assert(flow.ui.groups.includes('trip-change-inputs-ui'));
  assert.match(flow.remaining, /sur téléphone/); assert.match(flow.remaining, /paiements et remboursements réels/);
  for (const [id, name] of [['trip-time-confirmed', 'local-trip-change-time-confirmed.png'], ['trip-route-unavailable', 'local-trip-change-route-unavailable.png']]) {
    assert.equal(captures[id], completedBase + name); assert(stage.captureFiles.includes(name));
    assert(flow.images.some((item) => item.file === id && item.alt.includes('17 octobre')));
    const png = bytes(completedBase + name); assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
    assert.equal(png.readUInt32BE(16), 1080); assert.equal(png.readUInt32BE(20), 2140);
  }
  assert.equal(content.flows.find((item) => item.id === 'tracking').status, 'untested');
  assert(content.updates.some((item) => item.title === 'Le parent confirme le nouvel horaire' && item.date === '2026-10-17'));
});
