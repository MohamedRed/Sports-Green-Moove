import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { assertPreparedTripDraft, assertTripDraftRestart } from '../scripts/qa/trip-draft-restart-evidence.mjs';
import { stopDisposableAppProcess } from '../scripts/qa/local-disposable-process-stop.mjs';

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
    for (const before of [{ ...receipt()[0], completed: false }, { ...receipt()[0], password: 'never-archive' }]) {
      const bad = device(before); assert.throws(() => stopDisposableAppProcess(input, bad));
      assert(!bad.calls.some((args) => args.includes('force-stop'))); assert.equal(bad.writes.length, 0);
    }
  } finally { if (old === undefined) delete process.env.SGM_LOCAL_DISPOSABLE_EMULATOR; else process.env.SGM_LOCAL_DISPOSABLE_EMULATOR = old; }
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
