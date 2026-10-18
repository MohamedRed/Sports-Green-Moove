import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { XMLParser } from 'fast-xml-parser';
import { content, captures } from '../partner-portal/content.mjs';
import { assertInstrumentationPassed } from '../scripts/qa/android-instrumentation-result.mjs';
import { assertPreparedTripDraft, assertTripDraftRestart } from '../scripts/qa/trip-draft-restart-evidence.mjs';
import { stopDisposableAppProcess } from '../scripts/qa/local-disposable-process-stop.mjs';
import { assertPreparedScheduleDraft, assertScheduleDraftRestart, scheduleDraftFields } from '../scripts/qa/trip-schedule-draft-evidence.mjs';

const read = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const runId = 'a'.repeat(32), appId = 'be.sportgreenmoove.app.local';
const fixture = { tripId: 'draft-trip', otherTripId: 'empty-trip' };
function receipt() {
  const common = { projectId: 'demo-sgm-local-qa', runId, scope: 'native-ui-private-trip-draft-restart',
    completed: true, actorUserId: 'sgm-qa-driver', ...fixture, draftHash: 'c'.repeat(64) };
  return [{ ...common, stage: 'before', processId: 101, unfinishedFieldsSaved: true, otherTripIsolated: true },
    { projectId: common.projectId, runId, scope: 'disposable-local-app-force-stop', appId,
      preparedProcessId: 101, observedBeforePid: 101, forceStopIssued: true, noProcessAfterStop: true },
    { ...common, stage: 'after', processId: 202, sessionRestoredWithoutLogin: true,
      unfinishedFieldsRestored: true, otherTripIsolated: true, submissionDisabled: true }];
}

test('draft restart requires every typed outcome, same fixtures/hash and an independently stopped new process', () => {
  assertTripDraftRestart(...receipt(), fixture, runId);
  const exited = receipt(); exited[1].observedBeforePid = null; assertTripDraftRestart(...exited, fixture, runId);
  for (const [index, record] of receipt().entries()) for (const [key, value] of Object.entries(record)) {
    const changed = receipt(); changed[index][key] = typeof value === 'boolean' ? false : typeof value === 'number' ? -1 : 'other';
    assert.throws(() => assertTripDraftRestart(...changed, fixture, runId), `${index}.${key}`);
    const missing = receipt(); delete missing[index][key];
    assert.throws(() => assertTripDraftRestart(...missing, fixture, runId), `missing ${index}.${key}`);
  }
  const same = receipt(); same[2].processId = 101; assert.throws(() => assertTripDraftRestart(...same, fixture, runId));
  assert.throws(() => assertPreparedTripDraft({ ...receipt()[0], password: 'never-archive' }, runId));
  assert.throws(() => assertTripDraftRestart(...receipt(), { ...fixture, otherTripId: 'foreign' }, runId));
});

test('guarded draft stop uses the same isolated session, serial and sanitized receipt without clearing data', () => {
  const old = process.env.SGM_LOCAL_DISPOSABLE_EMULATOR;
  const input = { adb: '/sdk/adb', serial: 'emulator-5554', runId, outputDir: '/tmp/draft-evidence',
    beforeName: 'local-trip-draft-before.json', validateBefore: assertPreparedTripDraft };
  function device(before = receipt()[0]) {
    const calls = [], writes = [], pids = [{ status: 0, stdout: '101', stderr: '' }, { status: 1, stdout: '', stderr: '' }];
    return { calls, writes, execute: (_adb, args) => {
      calls.push(args);
      if (args.includes('get-state')) return 'device';
      if (args.includes('getprop')) return '1';
      if (args.includes('run-as')) return JSON.stringify({ projectId: 'demo-sgm-local-qa', runId, disposableEmulator: true, password: 'never-archive' });
      if (args.includes('cat')) return JSON.stringify(before);
      return '';
    }, spawn: () => pids.shift(), write: (...args) => writes.push(args) };
  }
  try {
    delete process.env.SGM_LOCAL_DISPOSABLE_EMULATOR;
    const denied = device(); assert.throws(() => stopDisposableAppProcess(input, denied)); assert.equal(denied.calls.length, 0);
    process.env.SGM_LOCAL_DISPOSABLE_EMULATOR = 'true';
    const valid = device(); assert.equal(stopDisposableAppProcess(input, valid).noProcessAfterStop, true);
    assert.equal(valid.calls.filter((args) => args.includes('force-stop')).length, 1);
    assert(!valid.calls.some((args) => args.includes('clear')));
    assert(valid.writes.every(([, text]) => !text.includes('never-archive')));
    const schedule = device(scheduleReceipt()[0]);
    stopDisposableAppProcess({ ...input, beforeName: 'local-trip-schedule-draft-before.json', validateBefore: assertPreparedScheduleDraft }, schedule);
    assert.equal(schedule.calls.filter((args) => args.includes('force-stop')).length, 1);
    assert(schedule.writes.some(([path]) => path.endsWith('/local-trip-schedule-draft-stop.json')));
    for (const before of [{ ...receipt()[0], completed: false }, { ...receipt()[0], password: 'never-archive' }]) {
      const bad = device(before); assert.throws(() => stopDisposableAppProcess(input, bad));
      assert(!bad.calls.some((args) => args.includes('force-stop'))); assert.equal(bad.writes.length, 0);
    }
  } finally { if (old === undefined) delete process.env.SGM_LOCAL_DISPOSABLE_EMULATOR; else process.env.SGM_LOCAL_DISPOSABLE_EMULATOR = old; }
});

const scheduleFixture = { ...fixture, originalDepartureAt: '2099-12-01T09:00:00Z',
  draftDepartureAt: '2099-12-02T10:00:00Z', draftArrivalBy: '2099-12-02T11:00:00Z' };
function scheduleReceipt() {
  const common = { projectId: 'demo-sgm-local-qa', runId, scope: 'native-ui-private-schedule-draft-restart',
    completed: true, actorUserId: 'sgm-qa-driver', ...fixture, draftHash: 'c'.repeat(64),
    ...scheduleDraftFields(scheduleFixture.draftDepartureAt, scheduleFixture.draftArrivalBy),
    originalPlacesRetained: true, otherTripIsolated: true, proposeEnabled: true };
  return [{ ...common, stage: 'before', processId: 101, scheduleSaved: true }, receipt()[1],
    { ...common, stage: 'after', processId: 202, scheduleRestored: true, sessionRestoredWithoutLogin: true }];
}

test('schedule draft recovery requires exact Belgian fields, a private hash and a separate stopped process', () => {
  assertScheduleDraftRestart(...scheduleReceipt(), scheduleFixture, runId);
  const exited = scheduleReceipt(); exited[1].observedBeforePid = null;
  assertScheduleDraftRestart(...exited, scheduleFixture, runId);
  for (const [index, record] of scheduleReceipt().entries()) for (const [key, value] of Object.entries(record)) {
    const changed = scheduleReceipt(); changed[index][key] = typeof value === 'boolean' ? false : typeof value === 'number' ? -1 : 'other';
    assert.throws(() => assertScheduleDraftRestart(...changed, scheduleFixture, runId), `${index}.${key}`);
    const missing = scheduleReceipt(); delete missing[index][key];
    assert.throws(() => assertScheduleDraftRestart(...missing, scheduleFixture, runId), `missing ${index}.${key}`);
  }
  const same = scheduleReceipt(); same[2].processId = 101;
  assert.throws(() => assertScheduleDraftRestart(...same, scheduleFixture, runId));
  assert.throws(() => assertPreparedScheduleDraft({ ...scheduleReceipt()[0], password: 'never-archive' }, runId));
  assert.throws(() => assertPreparedScheduleDraft({ ...scheduleReceipt()[0], departureDate: '2099-02-30' }, runId));
  assert.throws(() => assertScheduleDraftRestart(...scheduleReceipt(), { ...scheduleFixture, draftDepartureAt: '2099-12-02T10:01:00Z' }, runId));
  assert.throws(() => assertScheduleDraftRestart(...scheduleReceipt(), { ...scheduleFixture, originalDepartureAt: scheduleFixture.draftDepartureAt }, runId));
});

test('schedule expectations are independently converted in Brussels across month and DST boundaries', () => {
  assert.deepEqual(scheduleDraftFields('2026-10-31T23:15:00Z', '2026-11-01T00:30:00Z'), {
    departureDate: '2026-11-01', departureTime: '00:15', arrivalDate: '2026-11-01', arrivalTime: '01:30', hasArrival: true });
  assert.equal(scheduleDraftFields('2026-07-01T10:00:00Z', '2026-07-01T11:00:00Z').departureTime, '12:00');
  assert.equal(scheduleDraftFields('2026-12-01T10:00:00Z', '2026-12-01T11:00:00Z').departureTime, '11:00');
  assert.throws(() => scheduleDraftFields('bad', 'bad'));
  assert.throws(() => scheduleDraftFields('2026-07-01T10:00:00Z', '2026-07-01T09:00:00Z'));
});

test('the complete draft group also requires actual schedule pickers and a second independently verified restart', () => {
  const native = read('android/app/src/androidTest/java/be/sportgreenmoove/app/ui/LocalTripScheduleDraftRestartTest.kt');
  assert.equal((native.match(/@Test fun /g) ?? []).length, 2);
  for (const required of ['enterNativePickerDate(from, target)', 'enterNativePickerTime(target.toLocalTime())',
    'assertEquals(departure.toLocalDate(), record.input.departureDate)', 'assertEquals(arrival.toLocalTime(), record.input.arrivalTime)',
    'assertNull(record.pendingProposal)', 'assertNull(SharedPreferencesTripChangeDrafts(context).read(uid, otherTripId))',
    'trip.change.propose").performScrollTo().assertIsEnabled()', 'assertNotEquals(before.getInt("processId"), Process.myPid())']) assert(native.includes(required), required);
  const resumed = native.slice(native.indexOf('@Test fun recoverScheduleDraft'), native.indexOf('private fun open'));
  assert(!/signIn\(|login\(/.test(resumed));
  assert(!/setSgmUiTestContent|FakeGateway|proposeTripChange\(|applyTripChange\(|resolvePlace\(|\.write\(/.test(native));
  const host = read('scripts/qa/local-trip-schedule-draft-restart.mjs');
  assert(host.includes('seedPrivateDraftTrips({ departureAt: times.originalDepartureAt })'));
  assert(host.indexOf('const baseline = await snapshotPrivateDraftTrips(fixture)') < host.indexOf("instrument(['LocalTripScheduleDraftRestartTest#prepare"));
  assert(host.indexOf('stopDisposableAppProcess({') < host.indexOf("instrument(['LocalTripScheduleDraftRestartTest#recover"));
  assert(host.includes('assert.deepEqual(checkpoint, baseline')); assert(host.includes('assert.deepEqual(persisted, baseline'));
  assert(host.includes('assertScheduleDraftRestart(before, stopped, after, fixture, runId)'));
  const runner = read('scripts/qa/local-android-session.mjs');
  assert(runner.indexOf('await replayScheduleDraftRestart') < runner.indexOf('const steps ='));
  assert(runner.includes('tripDraftRestart, tripScheduleDraftRestart')); assert(runner.includes('testCount: 33, nativeCaseCount: 35'));
  assert(read('scripts/qa/collect-local-ui-evidence.mjs').includes("'trip-schedule-draft-restart'"));
  for (const path of ['scripts/qa/local-trip-schedule-draft-restart.mjs', 'scripts/qa/trip-schedule-draft-evidence.mjs',
    'android/app/src/androidTest/java/be/sportgreenmoove/app/ui/LocalTripScheduleDraftRestartTest.kt']) assert(read(path).split('\n').length < 300);
});

test('draft replay drives actual app fields, checks private storage and unchanged shared records without creating proposals', () => {
  const native = read('android/app/src/androidTest/java/be/sportgreenmoove/app/ui/LocalTripDraftRestartTest.kt');
  assert.equal((native.match(/@Test fun /g) ?? []).length, 2);
  for (const marker of ['BuildConfig.DEBUG && BuildConfig.SGM_USE_FIREBASE_EMULATOR', 'ActivityScenario.launch(MainActivity::class.java)',
    'SharedPreferencesTripChangeDrafts(context).read(uid, tripId)', 'assertNull(record.pendingProposal)',
    'assertNull(record.input.origin.point)', 'assertNull(record.input.destination.point)',
    'assertNotEquals(before.getInt("processId"), Process.myPid())', 'sessionRestoredWithoutLogin',
    'trip.change.propose").performScrollTo().assertIsNotEnabled()', 'open(otherTripId)', 'assertEmptyEditor()']) assert(native.includes(marker), marker);
  const resumed = native.slice(native.indexOf('@Test fun recoverUnfinished'), native.indexOf('private fun open'));
  assert(!/signIn\(|login\(/.test(resumed));
  assert(!/setSgmUiTestContent|FakeGateway|proposeTripChange\(|applyTripChange\(|resolvePlace\(|\.write\(/.test(native));
  const host = read('scripts/qa/local-trip-draft-restart.mjs');
  assert(host.indexOf('const fixture = await seed(), baseline = await snapshot(fixture)') < host.indexOf("instrument(['LocalTripDraftRestartTest#prepare"));
  assert(host.indexOf('stopDisposableAppProcess({') < host.indexOf("instrument(['LocalTripDraftRestartTest#recover"));
  assert(host.includes('assertTripDraftRestart(before, stopped, after'));
  assert(host.includes('assert.deepEqual(persisted, baseline'));
  for (const collection of ['tripChanges', 'tripChangeQuotes', 'tripChangeBalances', 'rideSessions']) assert(host.includes(`'${collection}'`));
  assert(!/proposeTripChanges|respondToTripChanges|applyTripChanges/.test(host));
  for (const path of ['scripts/qa/local-trip-draft-restart.mjs', 'scripts/qa/trip-draft-restart-evidence.mjs',
    'android/app/src/androidTest/java/be/sportgreenmoove/app/ui/LocalTripDraftRestartTest.kt']) assert(read(path).split('\n').length < 300);
});

test('new draft group is required in the full replay and both CI guard entry points', () => {
  const runner = read('scripts/qa/local-android-session.mjs'); assert(runner.includes('testCount: 33'));
  assert(runner.includes("'trip-draft-process-restart-ui'")); assert(runner.includes('await replayTripDraftRestart'));
  for (const name of ['native-ci.yml', 'web-integration-smoke.yml'])
    assert.equal(read('.github/workflows/' + name).split('"tests/trip-draft-restart.test.mjs"').length - 1, 2);
  assert(JSON.parse(read('package.json')).scripts['test:local-flow-isolation'].includes('tests/trip-draft-restart.test.mjs'));
  assert(read('scripts/qa/collect-local-ui-evidence.mjs').includes("'trip-draft-restart'"));
});

test('actual draft component passes remain separate from failed broader attempts and old store-only receipts', () => {
  const base = 'docs/release/evidence/local-trip-drafts-2026-10-18/';
  const json = (name) => JSON.parse(read(base + name));
  for (const [group, count] of [['force-stop-attempt', 5], ['component-native', 9]]) {
    const hashes = json(group + '/artifact-sha256.json'); assert.equal(Object.keys(hashes).length, count);
    for (const [name, hash] of Object.entries(hashes)) {
      const raw = readFileSync(new URL('../' + base + group + '/' + name, import.meta.url));
      assert.equal(createHash('sha256').update(raw).digest('hex'), hash, name);
      if (!name.endsWith('.png')) assert.doesNotMatch(raw.toString(), /AIza[\w-]{20,}|Bearer\s+[\w.-]+|"password"\s*:/);
    }
    assert.equal(read(base + group + '/disposable-store-restore.json'), '');
    assert.equal(json(group + '/disposable-device-setup.json').storePause.method, 'force-stop-store-only');
  }
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '', parseAttributeValue: true, isArray: (name) => name === 'testcase' });
  for (const [group, failures] of [['force-stop-attempt', 1], ['component-native', 0]]) {
    const suite = parser.parse(read(base + group + '/general-ui.xml')).testsuite;
    assert.equal(suite.tests, 114); assert.equal(suite.skipped, 26); assert.equal(suite.errors, 0); assert.equal(suite.failures, failures);
    const drafts = suite.testcase.filter((c) => c.classname.endsWith('.TripDraftPersistenceFlowTest'));
    assert.equal(drafts.length, 3); assert(drafts.every((c) => !c.failure && !c.error && !Object.hasOwn(c, 'skipped')));
  }
  assert.deepEqual(json('force-stop-attempt/native-suite-status.json'), { scope: 'native-suite-exit-status-not-flow-verification', ordinaryTests: 1, componentEvidence: 0, localReplay: 0 });
  assert.equal(json('force-stop-attempt/results.json').runId, '40f6e595214c75390a4ffca1133791e1');
  assert(json('force-stop-attempt/results.json').steps.every((s) => s.status === 'passed'));
  assert.deepEqual(json('component-native/native-suite-status.json'), { scope: 'native-suite-exit-status-not-flow-verification', ordinaryTests: 0, componentEvidence: 0, localReplay: 1 });
  const partial = json('component-native/local-chat-network-ui.json'); assert.equal(partial.completed, false);
  assert.equal(partial.failedPhase, 'network-preparation'); assert.equal(partial.preparationFailure.backendReachable, true);
  assert.equal(partial.preparationFailure.hasDefaultDataSubscription, false);
  for (const [name, count] of [['TripChangePersistenceTest', 11], ['TripChangeStateTest', 19]]) {
    const suite = parser.parse(read(base + `unit/TEST-be.sportgreenmoove.app.ui.${name}.xml`)).testsuite;
    assert.equal(suite.tests, count); assert.equal(suite.failures, 0); assert.equal(suite.errors, 0);
  }
});

test('completed real draft restart is accepted only as its own stage inside a failed broader run', () => {
  const base = 'docs/release/evidence/local-trip-drafts-2026-10-18/restart-native/';
  const json = (name) => JSON.parse(read(base + name));
  const hashes = json('artifact-sha256.json'); assert.equal(Object.keys(hashes).length, 16);
  for (const [name, hash] of Object.entries(hashes)) {
    const raw = readFileSync(new URL('../' + base + encodeURIComponent(name), import.meta.url));
    assert.equal(createHash('sha256').update(raw).digest('hex'), hash, name);
    if (!name.endsWith('.png')) assert.doesNotMatch(raw.toString(), /AIza[\w-]{20,}|Bearer\s+[\w.-]+|"password"\s*:/);
  }
  const stage = json('trip-draft-restart-ui-stage.json');
  assert.equal(stage.runId, '57ce0d4a32a18cb523c1e4ee7fe98ab0'); assert.equal(stage.testedAt, '2026-10-18T01:40:40.012Z');
  assert.equal(stage.recordType, 'native-private-trip-draft-stage-not-full-run-result');
  assert.equal(stage.testCount, 1); assert.equal(stage.nativeCaseCount, 2); assert.equal(stage.fullAppReplay, false);
  assert.deepEqual(stage.steps, [{ id: 'trip-draft-process-restart-ui', status: 'passed' }]);
  assertTripDraftRestart(stage.native.before, stage.native.stopped, stage.native.after, stage, stage.runId);
  assert.equal(stage.native.before.processId, 11481); assert.equal(stage.native.after.processId, 11614);
  assert.deepEqual(stage.baseline, stage.checkpoint); assert.deepEqual(stage.persisted, stage.baseline);
  for (const hash of Object.values(stage.baseline.hashes)) assert.match(hash, /^[a-f0-9]{64}$/);
  assert.deepEqual(stage.baseline.emptyCollections, { tripChanges: true, tripChangeQuotes: true, tripChangeBalances: true, rideSessions: true });
  assert.equal(stage.recordsUnchanged, true); assert.equal(stage.automaticProposalCreated, false);
  assert.equal(stage.unresolvedAddressesRestoredAsConfirmed, false);
  for (const part of ['before', 'after', 'stop']) assert.deepEqual(json(`local-trip-draft-${part}.json`), stage.native[part === 'stop' ? 'stopped' : part]);
  for (const method of ['prepareUnfinishedTripDraft', 'recoverUnfinishedTripDraftInNewProcess'])
    assertInstrumentationPassed(read(base + `LocalTripDraftRestartTest%23${method}-instrumentation.txt`), 1);
  assert.equal(json('adb-pull-trip-draft-restart.json').completed, true);
  assert.deepEqual(json('native-suite-status.json'), { scope: 'native-suite-exit-status-not-flow-verification', ordinaryTests: 1, componentEvidence: 0, localReplay: 1 });
  assert.equal(json('local-chat-network-ui.json').completed, false);
  assert.throws(() => assertInstrumentationPassed(read(base + 'LocalChatNetworkFlowTest-instrumentation.txt'), 1));
  const suite = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '', parseAttributeValue: true,
    isArray: (name) => name === 'testcase' }).parse(read(base + 'general-ui.xml')).testsuite;
  assert.equal(suite.tests, 116); assert.equal(suite.failures, 1); assert.equal(suite.skipped, 28);
  const failure = suite.testcase.find((c) => c.failure);
  assert.equal(failure.name, 'agreementStillRequiresRouteAndApplicationAndDoesNotClaimSettlement'); assert.match(failure.failure, /PixelCopy/);
  const flow = content.flows.find((f) => f.id === 'publication'); assert.equal(flow.status, 'partial');
  assert.equal(flow.images[0].file, 'trip-draft-restored'); assert.match(flow.images[0].alt, /essai local du 18 octobre/);
  assert.equal(captures['trip-draft-restored'], base + 'local-trip-draft-restored.png');
  assert(!Object.values(captures).some((p) => p.endsWith('/local-trip-draft-before.png')));
  assert.match(flow.remaining, /brouillons après fermeture sur téléphone/);
});
