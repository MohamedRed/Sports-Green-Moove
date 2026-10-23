import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { Timestamp } from 'firebase-admin/firestore';
import { assertPreparedNotificationRead, assertNotificationReadRestart, verifyNotificationReadRecords } from '../scripts/qa/notification-read-restart-evidence.mjs';

const runId = 'a'.repeat(32);
const fixture = {selectedNoticeId: 'selected', controlNoticeId: 'control', driverNoticeId: 'driver'};
const prepared = () => ({projectId: 'demo-sgm-local-qa', runId, scope: 'native-notification-read-process-stage',
  stage: 'before', completed: true, actorUserId: 'sgm-qa-parent', processId: 123, ...fixture,
  selectedReadConfirmed: true, controlRemainedUnread: true, driverAccountIsolated: true, parentReturnedRead: true});
const stopped = () => ({projectId: 'demo-sgm-local-qa', runId, scope: 'disposable-local-app-force-stop',
  appId: 'be.sportgreenmoove.app.local', preparedProcessId: 123, observedBeforePid: 123, forceStopIssued: true, noProcessAfterStop: true});
const reopened = () => ({projectId: 'demo-sgm-local-qa', runId, scope: 'native-notification-read-process-stage',
  stage: 'after', completed: true, actorUserId: 'sgm-qa-parent', processId: 456, ...fixture,
  sessionRestoredWithoutLogin: true, selectedReadRestored: true, controlRemainedUnread: true, readActionAbsent: true});
const initial = () => ({documents: {notifications: Object.values(fixture).map(id => ({id, data: {read: false, body: 'Synthetic QA'}})),
  bookings: [{id: 'booking', data: {status: 'approved'}}]}, claims: [{uid: 'parent', claims: {roleKeys: ['parent']}}], liveTrips: null});
const acknowledged = () => {
  const state = initial(); Object.assign(state.documents.notifications[0].data, {read: true, readAt: Timestamp.fromMillis(1792780000000)});
  return state;
};

test('requires two completed native stages and a real process boundary for the same notice', () => {
  assertPreparedNotificationRead(prepared(), runId);
  assertNotificationReadRestart(prepared(), stopped(), reopened(), fixture, runId);
});
for (const [part, patch] of [['before', {completed: false}], ['before', {selectedReadConfirmed: false}],
  ['before', {driverAccountIsolated: false}], ['before', {controlNoticeId: 'selected'}], ['before', {extra: true}],
  ['stop', {noProcessAfterStop: false}], ['stop', {preparedProcessId: 999}], ['stop', {appId: 'production.app'}],
  ['after', {processId: 123}], ['after', {sessionRestoredWithoutLogin: false}], ['after', {readActionAbsent: false}],
  ['after', {selectedNoticeId: 'different'}], ['after', {completed: false}]]) {
  test('rejects unproven notification restart ' + part + JSON.stringify(patch), () => {
    const rows = {before: prepared(), stop: stopped(), after: reopened()}; Object.assign(rows[part], patch);
    assert.throws(() => assertNotificationReadRestart(rows.before, rows.stop, rows.after, fixture, runId));
  });
}
test('protects every other notice, booking, claim and live trip', () => {
  const result = verifyNotificationReadRecords(initial(), acknowledged(), fixture.selectedNoticeId);
  assert.equal(result.protectedRecordCount, 4); assert.equal(result.selectedReadAtMillis, 1792780000000);
  for (const mutate of [state => state.documents.notifications[1].data.read = true,
    state => state.documents.bookings[0].data.status = 'cancelled', state => state.claims[0].claims.roleKeys.push('admin'),
    state => state.liveTrips = {forged: true}, state => state.documents.notifications[0].data.body = 'Changed',
    state => delete state.documents.notifications[0].data.readAt]) {
    const next = acknowledged(); mutate(next);
    assert.throws(() => verifyNotificationReadRecords(initial(), next, fixture.selectedNoticeId));
  }
});
test('executes the connected stages, independent checks and primary copy before recording the new group', () => {
  const runner = readFileSync('scripts/qa/local-android-session.mjs', 'utf8');
  assert.match(runner, /replayNotificationReadUi\(\{instrument, adb, serial/);
  assert.match(runner, /testCount: 37, nativeCaseCount: 40/);
  assert.match(runner, /notification-read-process-restart-ui/);
  const replay = readFileSync('scripts/qa/local-notification-read-ui.mjs', 'utf8');
  for (const action of ['readSelectedNotificationAndSwitchAccounts', 'stopDisposableAppProcess', 'reopenReadNotificationAfterProcessDeath',
    'verifyNotificationReadRecords', 'assertNotificationReadRestart', "denied('markNotificationRead'"])
    assert(replay.includes(action), action);
});
test('date-bearing native status assertions explicitly use suffix substring matching', () => {
  const ui = readFileSync('android/app/src/androidTest/java/be/sportgreenmoove/app/ui/LocalNotificationReadFlowTest.kt', 'utf8');
  assert.match(ui, /assertTextContains\(" · Lue", substring = true\)/);
  assert.match(ui, /assertTextContains\(" · \$status", substring = true\)/);
  assert(!/assertTextContains\(" · [^"\n]+"\)/.test(ui));
});
