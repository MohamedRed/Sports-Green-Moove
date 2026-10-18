import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { recoveryKinds, assertPreparedRecovery, assertRecoveryRecords, assertRecoveryRestart } from '../scripts/qa/trip-consent-recovery-evidence.mjs';
import { stopDisposableAppProcess } from '../scripts/qa/local-disposable-process-stop.mjs';

const bytes = (path) => readFileSync(new URL('../' + path.split('/').map(encodeURIComponent).join('/'), import.meta.url));
const read = (path) => bytes(path).toString('utf8');
const runId = 'a'.repeat(32), proposalId = 'c'.repeat(64), appId = 'be.sportgreenmoove.app.local';
function saved(kind) {
  const before = { title: 'Recovery QA', status: 'published', priceCents: 250, seatsAvailable: 2, seatsTotal: 4,
    origin: { lat: 50.7, lng: 4.6 }, destination: { lat: 50.8, lng: 4.3 }, departureAt: '2030-01-01T12:00:00Z' };
  const fixture = { tripId: 'trip-' + kind, before, bookingIds: ['first-' + kind, 'second-' + kind],
    bookingsBefore: [{ status: 'approved', seats: 1, priceCents: 250 }, { status: 'approved', seats: 1, priceCents: 250 }],
    driverUid: 'driver', parentUids: ['parent', 'parent-two'] };
  const terms = { origin: before.origin, destination: before.destination, departureAt: before.departureAt, arrivalBy: null, priceCents: 250 };
  const decision = kind === 'partial' ? 'accept' : kind === 'declined' ? 'decline' : null;
  const recipients = ['declined', 'withdrawn'].includes(kind) ? ['parent', 'parent-two', 'parent', 'parent-two', 'driver'] : ['parent', 'parent-two'];
  const records = { trip: { ...before, ...(['pending', 'partial'].includes(kind) ? { pendingChangeId: proposalId } : {}) },
    bookings: structuredClone(fixture.bookingsBefore), proposalId,
    change: { tripId: fixture.tripId, driverUserId: 'driver', status: kind === 'partial' ? 'pending' : kind,
      originalTerms: terms, terms: { ...terms, priceCents: 400 }, parentUserIds: ['parent', 'parent-two'], bookingIds: fixture.bookingIds,
      decisions: decision ? { parent: { decision } } : {} },
    notifications: recipients.map((userId, i) => ({ id: 'note-' + i, userId, proposalId, sourceId: fixture.tripId, type: 'tripChange' })),
    quotes: [], balances: [] };
  return { fixture, records };
}

test('four recovery states require unchanged original terms, two reservations, exact decisions and notices', () => {
  for (const kind of recoveryKinds) {
    const { records, fixture } = saved(kind);
    const result = assertRecoveryRecords(records, fixture, kind);
    assert.equal(result.kind, kind); assert.equal(result.status, kind === 'partial' ? 'pending' : kind);
    assert.equal(result.decisionCount, ['partial', 'declined'].includes(kind) ? 1 : 0);
    const mutations = [
      (r) => { r.trip.priceCents = 400; }, (r) => { r.trip.seatsAvailable = 4; },
      (r) => { r.bookings[0].status = 'cancelled'; }, (r) => { r.bookings.pop(); },
      (r) => { r.change.status = 'confirmed'; }, (r) => { r.change.application = {}; },
      (r) => { r.change.driverUserId = 'other'; }, (r) => { r.change.tripId = 'other'; },
      (r) => { r.change.parentUserIds = ['other', 'parent']; }, (r) => { r.change.bookingIds = []; },
      (r) => { r.change.terms.origin.lat = 0; }, (r) => { r.change.terms.priceCents = 500; },
      (r) => { r.change.originalTerms.priceCents = 0; }, (r) => { r.change.terms.departureAt = '2031-01-01T12:00:00Z'; },
      (r) => { r.change.terms.arrivalBy = '2030-01-01T13:00:00Z'; },
      (r) => { r.trip.pendingChangeId = ['pending', 'partial'].includes(kind) ? undefined : proposalId; },
      (r) => { r.change.decisions = { other: { decision: 'accept' } }; },
      (r) => { r.quotes.push({}); }, (r) => { r.balances.push({}); },
      (r) => { r.notifications.pop(); }, (r) => { r.notifications[0].userId = 'outsider'; },
      (r) => { r.notifications[0].id = r.notifications[1].id; }, (r) => { r.notifications[0].proposalId = 'other'; },
      (r) => { r.notifications[0].sourceId = 'other'; }, (r) => { r.notifications[0].type = 'other'; },
    ];
    if (['partial', 'declined'].includes(kind)) mutations.push((r) => { r.change.decisions.parent.decision = 'other'; });
    for (const mutate of mutations) {
      const changed = structuredClone(records); mutate(changed);
      assert.throws(() => assertRecoveryRecords(changed, fixture, kind), `${kind}: ${mutate}`);
    }
  }
});

function receipts() {
  const fixtures = Object.fromEntries(recoveryKinds.map((kind) => [kind, saved(kind).fixture]));
  const records = recoveryKinds.map((kind) => ({ kind, tripId: fixtures[kind].tripId, bookingId: fixtures[kind].bookingIds[0], proposalId, prepared: true }));
  const before = { projectId: 'demo-sgm-local-qa', runId, scope: 'native-ui-trip-consent-recovery-matrix',
    stage: 'before', completed: true, actorUserId: 'sgm-qa-parent', processId: 101, records };
  const stopped = { projectId: before.projectId, runId, scope: 'disposable-local-app-force-stop', appId,
    preparedProcessId: 101, observedBeforePid: null, forceStopIssued: true, noProcessAfterStop: true };
  const after = { ...before, stage: 'after', processId: 202, sessionRestoredWithoutLogin: true, endedAsUserId: 'sgm-qa-driver',
    records: records.map(({ prepared, ...record }) => ({ ...record, parentStateRestored: true, refreshUnchanged: true,
      secondParentScoped: true, driverStateRestored: true,
      ...(['pending', 'partial'].includes(record.kind) ? { originalProposalRestored: true } : { closedActionsAbsent: true }) })) };
  return { before, stopped, after, fixtures };
}

test('all four states must cross the same guarded process boundary with scoped account checks', () => {
  const run = (r) => assertRecoveryRestart(r.before, r.stopped, r.after, r.fixtures, runId);
  run(receipts());
  for (const section of ['before', 'stopped', 'after']) {
    for (const [key, value] of Object.entries(receipts()[section])) {
      if (key === 'records') continue;
      const missing = receipts(); delete missing[section][key]; assert.throws(() => run(missing), `${section}.${key}`);
      const changed = receipts(); changed[section][key] = typeof value === 'boolean' ? false : typeof value === 'number' ? -1 : 'other';
      assert.throws(() => run(changed), `${section}.${key}`);
    }
  }
  for (const section of ['before', 'after']) for (let index = 0; index < 4; index++) {
    for (const key of Object.keys(receipts()[section].records[index])) {
      const missing = receipts(); delete missing[section].records[index][key]; assert.throws(() => run(missing), `${section}.${index}.${key}`);
    }
    const missing = receipts(); missing[section].records.splice(index, 1); assert.throws(() => run(missing));
  }
  const same = receipts(); same.after.processId = 101; assert.throws(() => run(same));
  const secret = { ...receipts().before, password: 'not-evidence' }; assert.throws(() => assertPreparedRecovery(secret, runId));
});

test('the new stop name uses the existing disposable-only guard and sanitized receipt path', () => {
  const prior = process.env.SGM_LOCAL_DISPOSABLE_EMULATOR, writes = [], calls = [];
  const input = { adb: '/sdk/adb', serial: 'emulator-5554', runId, outputDir: '/tmp/evidence',
    beforeName: 'local-trip-consent-recovery-before.json', validateBefore: assertPreparedRecovery };
  try {
    process.env.SGM_LOCAL_DISPOSABLE_EMULATOR = 'true';
    stopDisposableAppProcess(input, {
      execute: (_, args) => {
        calls.push(args);
        if (args.includes('get-state')) return 'device';
        if (args.includes('getprop')) return '1';
        if (args.includes('run-as')) return JSON.stringify({ projectId: 'demo-sgm-local-qa', runId, disposableEmulator: true, password: 'not-evidence' });
        if (args.includes('cat')) return JSON.stringify(receipts().before);
        return '';
      }, spawn: () => ({ status: 1, stdout: '', stderr: '' }), write: (...args) => writes.push(args),
    });
    assert.equal(calls.filter((args) => args.includes('force-stop')).length, 1);
    assert.equal(writes.length, 2); assert(writes.every(([, content, options]) => !content.includes('not-evidence') && options.flag === 'wx'));
  } finally {
    if (prior === undefined) delete process.env.SGM_LOCAL_DISPOSABLE_EMULATOR;
    else process.env.SGM_LOCAL_DISPOSABLE_EMULATOR = prior;
  }
});

test('the first native matrix failure stays incomplete despite a narrower repeated confirmed-consent pass', () => {
  const base = 'docs/release/evidence/local-consent-restart-interruption-2026-10-17/recovery-action-readiness/';
  const json = (name) => JSON.parse(read(base + name));
  const hashes = json('artifact-sha256.json'); assert.equal(Object.keys(hashes).length, 13);
  for (const [name, hash] of Object.entries(hashes)) {
    const raw = bytes(base + name); assert.equal(createHash('sha256').update(raw).digest('hex'), hash, name);
    assert.doesNotMatch(raw.toString(), /AIza[\w-]{20,}|Bearer\s+[\w.-]+|"password"\s*:/);
  }
  const failed = json('local-trip-consent-recovery-before.json');
  assert.equal(failed.runId, 'aa828e143677a3827a4ce37de85a7cc7'); assert.equal(failed.completed, false);
  assert.equal(failed.processId, 10790); assert.equal(failed.stage, 'before'); assert.equal(failed.records, undefined);
  assert.throws(() => assertPreparedRecovery(failed, failed.runId));
  assert.match(read(base + 'LocalTripConsentRecoveryTest#prepareRecoveryStates-instrumentation.txt'), /could not find any node[\s\S]*trip.change.withdraw/);
  assert.equal(json('adb-pull-failure-cleanup.json').completed, true);
  assert.equal(json('native-suite-status.json').localReplay, 1);
  const narrower = json('trip-consent-restart-ui-stage.json'); assert.equal(narrower.runId, failed.runId);
  assert.equal(narrower.fullAppReplay, false); assert.equal(narrower.testCount, 1);
  assert.equal(narrower.native.before.processId, 10498); assert.equal(narrower.native.after.processId, 10654);
  assert.deepEqual(narrower.checkpoint.hashes, narrower.persisted.hashes);
  assert.match(read(base + '../README.md'), /test readiness defect/);
});

test('native matrix uses real actions and same-session reopen while host compares every complete saved record', () => {
  const native = read('android/app/src/androidTest/java/be/sportgreenmoove/app/ui/LocalTripConsentRecoveryTest.kt');
  assert.equal((native.match(/@Test fun /g) ?? []).length, 2);
  for (const marker of ['SGM_USE_FIREBASE_EMULATOR', 'disposableEmulator', 'ro.kernel.qemu', 'FirebaseApp.getInstance().options.projectId',
    'Base64.URL_SAFE', 'assertNotEquals("A new app process is required"', 'repeat(2)', 'secondParentScoped', 'driverStateRestored',
    '"trip.change.$decision"', '"trip.change.withdraw"', '"reservation.change.$booking").assertDoesNotExist()', '"2,50"']) assert(native.includes(marker), marker);
  const reopened = native.slice(native.indexOf('@Test fun reopenRecoveryStates'), native.indexOf('private fun verifyParent'));
  assert(!reopened.slice(0, reopened.indexOf('logout()')).includes('login('));
  assert(!/setSgmUiTestContent|UiFlow.*Gateway|performSemanticsAction|proposeTripChange\(|respondTripChange\(|withdrawTripChange\(/.test(native));
  const statusWait = native.slice(native.indexOf('private fun expectStatus'), native.indexOf('private fun closeDialog'));
  assert(statusWait.indexOf('idleReview()') > statusWait.indexOf('assertTextEquals(label)'));
  assert(statusWait.includes('"trip.change.error").assertDoesNotExist()'));
  assert(read('android/app/src/test/java/be/sportgreenmoove/app/ui/TripChangeStateTest.kt')
    .includes('proposalStatusCanArriveBeforeRefreshReleasesTheWithdrawalAction'));
  const host = read('scripts/qa/local-trip-consent-recovery.mjs');
  for (const marker of ['assertRecoveryRestart(before, stopped, after', 'assert.deepEqual(persisted, checkpoint',
    'assert.equal(changes.size, 1)', "toString('base64url')", 'tripChangeHash(trip)', 'tripChangeHash(bookings)',
    'tripChangeHash(change)', 'tripChangeHash([...notifications]', "denied('getTripChangeReview', outsider", 'review.canRespond',
    'routeProviderExercised: false', 'paymentExercised: false', 'fullAppReplay: false']) assert(host.includes(marker), marker);
  const prepared = host.indexOf("instrument(['LocalTripConsentRecoveryTest#prepareRecoveryStates']");
  const stopped = host.indexOf('stopDisposableAppProcess({');
  const reopenedHost = host.indexOf("instrument(['LocalTripConsentRecoveryTest#reopenRecoveryStates']");
  assert(prepared >= 0 && stopped > prepared && reopenedHost > stopped && host.indexOf('collect();') > reopenedHost);
  assert(!/call\('(propose|respond|withdraw|apply)TripChange/.test(host));
  const runner = read('scripts/qa/local-android-session.mjs');
  for (const kind of recoveryKinds) assert(runner.includes(`'trip-consent-${kind}-restart-ui'`));
  assert(runner.includes('testCount: 33')); assert(runner.includes('await replayTripConsentRecovery'));
  assert(runner.indexOf('await replayTripConsentRecovery') < runner.indexOf('replayWithNetworkCleanup(adb'));
  for (const workflow of ['native-ci.yml', 'web-integration-smoke.yml'])
    assert.equal(read('.github/workflows/' + workflow).split('"tests/trip-consent-recovery.test.mjs"').length - 1, 2);
  assert(JSON.parse(read('package.json')).scripts['test:local-flow-isolation'].includes('tests/trip-consent-recovery.test.mjs'));
  assert(read('scripts/qa/collect-local-ui-evidence.mjs').includes("'trip-consent-recovery'"));
  for (const source of ['scripts/qa/local-trip-consent-recovery.mjs', 'scripts/qa/trip-consent-recovery-evidence.mjs',
    'android/app/src/androidTest/java/be/sportgreenmoove/app/ui/LocalTripConsentRecoveryTest.kt']) assert(read(source).split('\n').length < 300);
});
