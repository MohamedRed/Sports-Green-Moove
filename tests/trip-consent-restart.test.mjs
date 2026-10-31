import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { assertPreparedTripConsent, assertTripConsentRestart } from '../scripts/qa/trip-consent-restart-evidence.mjs';
import { stopDisposableAppProcess } from '../scripts/qa/local-disposable-process-stop.mjs';

const read = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const runId = 'a'.repeat(32), appId = 'be.sportgreenmoove.app.local';
const fixture = { tripId: 'trip-consent-restart', bookingId: 'booking-consent-restart' };
function receipt() {
  const before = { projectId: 'demo-sgm-local-qa', runId, scope: 'native-ui-confirmed-trip-consent-restart-stage',
    stage: 'before', completed: true, actorUserId: 'sgm-qa-parent', processId: 101, ...fixture,
    proposalId: 'c'.repeat(64), parentConfirmed: true, notApplied: true };
  const stopped = { projectId: before.projectId, runId, scope: 'disposable-local-app-force-stop', appId,
    preparedProcessId: 101, observedBeforePid: 101, forceStopIssued: true, noProcessAfterStop: true };
  const after = { ...before, stage: 'after', processId: 202, sessionRestoredWithoutLogin: true,
    originalProposalRestored: true, parentDecisionRestored: true, duplicateDecisionActionsAbsent: true,
    explicitRefreshRestored: true, driverSawSameConsent: true, endedAsUserId: 'sgm-qa-driver' };
  return [before, stopped, after];
}

test('confirmed consent requires the same fixture and proposal across an independently stopped new app process', () => {
  assertTripConsentRestart(...receipt(), fixture, runId);
  const exited = receipt(); exited[1].observedBeforePid = null; assertTripConsentRestart(...exited, fixture, runId);
  for (const [index, record] of receipt().entries()) {
    for (const [key, value] of Object.entries(record)) {
      // The after-stage need not repeat the preparation-only parentConfirmed marker.
      if (index === 2 && key === 'parentConfirmed') continue;
      const changed = receipt(); changed[index][key] = typeof value === 'boolean' ? false : typeof value === 'number' ? -1 : 'other';
      assert.throws(() => assertTripConsentRestart(...changed, fixture, runId), `${index}.${key}`);
      const missing = receipt(); delete missing[index][key];
      assert.throws(() => assertTripConsentRestart(...missing, fixture, runId), `missing ${index}.${key}`);
    }
  }
  const same = receipt(); same[2].processId = 101; assert.throws(() => assertTripConsentRestart(...same, fixture, runId));
  assert.throws(() => assertTripConsentRestart(...receipt(), { ...fixture, bookingId: 'other' }, runId));
  assert.throws(() => assertPreparedTripConsent({ ...receipt()[0], password: 'never-archive' }, runId));
});

function device(overrides = {}) {
  const calls = [], writes = [], pids = [{ status: 0, stdout: '101\n', stderr: '' }, { status: 1, stdout: '', stderr: '' }];
  return { calls, writes, execute: (adb, args, options) => {
    assert.equal(options.timeout, 30_000); calls.push(args);
    if (args.includes('get-state')) return 'device';
    if (args.includes('getprop')) return overrides.qemu ?? '1';
    if (args.includes('run-as')) return overrides.session ?? JSON.stringify({ projectId: 'demo-sgm-local-qa', runId,
      disposableEmulator: true, password: 'never-archive' });
    if (args.includes('cat')) return JSON.stringify(overrides.before ?? receipt()[0]);
    return '';
  }, spawn: (adb, args) => {
    assert.deepEqual(args, ['-s', 'emulator-5554', 'shell', 'pidof', appId]);
    return overrides.pid ?? pids.shift();
  }, write: (...args) => writes.push(args) };
}

test('the shared stop helper protects both workflows and only records sanitized prepared evidence', () => {
  const prior = process.env.SGM_LOCAL_DISPOSABLE_EMULATOR;
  const input = { adb: '/sdk/adb', serial: 'emulator-5554', runId, outputDir: '/tmp/evidence',
    beforeName: 'local-trip-consent-restart-before.json', validateBefore: assertPreparedTripConsent };
  const run = (mock, patch = {}) => stopDisposableAppProcess({ ...input, ...patch }, mock);
  try {
    delete process.env.SGM_LOCAL_DISPOSABLE_EMULATOR;
    const unapproved = device(); assert.throws(() => run(unapproved)); assert.equal(unapproved.calls.length, 0);
    process.env.SGM_LOCAL_DISPOSABLE_EMULATOR = 'true';
    const valid = device(); assert.equal(run(valid).noProcessAfterStop, true);
    assert.deepEqual(valid.calls.filter((args) => args.includes('force-stop')), [['-s', input.serial, 'shell', 'am', 'force-stop', appId]]);
    assert.equal(valid.writes.length, 2); assert(valid.writes.every(([, text, options]) => !text.includes('never-archive') && options.flag === 'wx'));
    for (const patch of [{ beforeName: '../../session.json' }, { beforeName: 'other.json' },
      { serial: 'physical-device' }, { runId: 'other' }, { outputDir: 'relative' }, { validateBefore: null }]) {
      const bad = device(); assert.throws(() => run(bad, patch)); assert.equal(bad.calls.length, 0);
    }
    for (const overrides of [{ qemu: '0' }, { session: '{"password":"never-archive",bad}' },
      { before: { ...receipt()[0], completed: false } }, { before: { ...receipt()[0], password: 'never-archive' } },
      { pid: { status: null, stdout: '', stderr: 'offline' } }]) {
      const bad = device(overrides); assert.throws(() => run(bad), (error) => !error.message.includes('never-archive'));
      assert(!bad.calls.some((args) => args.includes('force-stop'))); assert.equal(bad.writes.length, 0);
    }
    const alive = device({ pid: { status: 0, stdout: '101', stderr: '' } });
    assert.throws(() => run(alive), /fully stopped/); assert.equal(alive.writes.length, 0);
  } finally {
    if (prior === undefined) delete process.env.SGM_LOCAL_DISPOSABLE_EMULATOR;
    else process.env.SGM_LOCAL_DISPOSABLE_EMULATOR = prior;
  }
});

test('native actions restore confirmed consent without a login, injected UI or repeated decision write', () => {
  const native = read('android/app/src/androidTest/java/be/sportgreenmoove/app/ui/LocalTripConsentRestartTest.kt');
  assert.equal((native.match(/@Test fun /g) ?? []).length, 2);
  for (const marker of ['BuildConfig.DEBUG && BuildConfig.SGM_USE_FIREBASE_EMULATOR', 'demo-sgm-local-qa',
    'ActivityScenario.launch(MainActivity::class.java)', 'AuthTestInteractions(compose, activity)', 'Process.myPid()',
    'assertNotEquals("A new app process is required"', 'assertParentConsent()', 'refreshReview()',
    'originalProposalRestored', 'duplicateDecisionActionsAbsent', 'driverSawSameConsent', 'assertPrices()']) assert(native.includes(marker), marker);
  const reopened = native.slice(native.indexOf('@Test fun reopenConfirmedConsent'), native.indexOf('private fun stage'));
  assert(reopened.indexOf('FirebaseAuth.getInstance().currentUser?.uid') < reopened.indexOf('logout()'));
  assert(!reopened.slice(0, reopened.indexOf('logout()')).includes('login('));
  assert(native.includes('openDriverTrip(expectedProposalId = null)'));
  assert(reopened.includes('openDriverTrip(expectedProposalId = proposalId)'));
  assert(native.includes('expectedProposalId, trip.pendingChangeId'));
  assert(native.includes('if (expectedProposalId == null) "edit" else "review"'));
  assert(native.includes('"trip.$unavailableAction.$tripId").assertDoesNotExist()'));
  assert(!/setSgmUiTestContent|UiFlow.*Gateway|performSemanticsAction|runOnUiThread|respondTripChange\(|proposeTripChange\(|applyTripChange\(/.test(native));
  const host = read('scripts/qa/local-trip-consent-restart.mjs');
  for (const marker of ['assertTripConsentRestart(before, stopped, after', 'assert.deepEqual(persisted',
    'tripChangeHash(trip)', 'tripChangeHash(booking)', 'tripChangeHash(change)', 'tripChangeHash(notifications)',
    'assert.equal(changes.size, 1)', 'assert.equal(notes.size, 3)', 'assert.equal(quotes.size, 0)', 'assert.equal(balances.size, 0)',
    "denied('getTripChangeReview', outsider", 'applicationExercised: false', 'routeProviderExercised: false',
    'paymentExercised: false', 'fullAppReplay: false']) assert(host.includes(marker), marker);
  const prepared = host.indexOf("instrument(['LocalTripConsentRestartTest#prepareConfirmedConsent']");
  const stopped = host.indexOf('stopDisposableAppProcess({');
  const resumed = host.indexOf("instrument(['LocalTripConsentRestartTest#reopenConfirmedConsent']");
  assert(prepared >= 0 && stopped > prepared && resumed > stopped && host.indexOf('collect();') > resumed);
  assert(!/proposeTripChanges|respondToTripChanges|applyTripChanges/.test(host));
  const runner = read('scripts/qa/local-android-session.mjs');
  assert(runner.indexOf('await replayTripConsentRestart') < runner.indexOf('replayWithNetworkCleanup(adb'));
  assert(runner.includes('testCount: 37')); assert(runner.includes("'trip-consent-process-restart-ui'"));
  for (const workflow of ['native-ci.yml', 'web-integration-smoke.yml']) {
    assert.equal(read('.github/workflows/' + workflow).split('"tests/trip-consent-restart.test.mjs"').length - 1, 2);
  }
  assert(JSON.parse(read('package.json')).scripts['test:local-flow-isolation'].includes('tests/trip-consent-restart.test.mjs'));
  assert(read('scripts/qa/collect-local-ui-evidence.mjs').includes("'trip-consent-restart'"));
  for (const path of ['scripts/qa/local-disposable-process-stop.mjs', 'scripts/qa/local-chat-process-stop.mjs',
    'scripts/qa/local-trip-consent-restart.mjs', 'scripts/qa/trip-consent-restart-evidence.mjs',
    'android/app/src/androidTest/java/be/sportgreenmoove/app/ui/LocalTripConsentRestartTest.kt']) assert(read(path).split('\n').length < 300);
});
