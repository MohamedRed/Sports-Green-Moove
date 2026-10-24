import assert from 'node:assert/strict';

const keys = ['projectId', 'runId', 'scope', 'stage', 'completed', 'actorUserId', 'processId',
  'selectedNoticeId', 'controlNoticeId', 'driverNoticeId'];

export function assertPreparedNotificationRead(before, runId) {
  assert.match(runId, /^[a-f0-9]{32}$/);
  assert.equal(before.projectId, 'demo-sgm-local-qa'); assert.equal(before.runId, runId);
  assert.equal(before.scope, 'native-notification-read-process-stage'); assert.equal(before.stage, 'before');
  assert.equal(before.completed, true); assert.equal(before.actorUserId, 'sgm-qa-parent');
  assert(Number.isInteger(before.processId) && before.processId > 0);
  for (const key of ['selectedNoticeId', 'controlNoticeId', 'driverNoticeId']) assert.match(before[key], /^[A-Za-z0-9_-]{1,256}$/);
  assert.equal(new Set([before.selectedNoticeId, before.controlNoticeId, before.driverNoticeId]).size, 3);
  for (const key of ['selectedReadConfirmed', 'controlRemainedUnread', 'driverAccountIsolated', 'parentReturnedRead']) assert.equal(before[key], true);
  assert.deepEqual(Object.keys(before).sort(), [...keys, 'selectedReadConfirmed', 'controlRemainedUnread', 'driverAccountIsolated', 'parentReturnedRead'].sort());
}

export function assertNotificationReadRestart(before, stopped, after, fixture, runId) {
  assertPreparedNotificationRead(before, runId);
  for (const key of ['selectedNoticeId', 'controlNoticeId', 'driverNoticeId']) assert.equal(before[key], fixture[key]);
  assert.equal(stopped.projectId, before.projectId); assert.equal(stopped.runId, runId);
  assert.equal(stopped.scope, 'disposable-local-app-force-stop'); assert.equal(stopped.appId, 'be.sportgreenmoove.app.local');
  assert.equal(stopped.preparedProcessId, before.processId);
  assert(stopped.observedBeforePid === null || stopped.observedBeforePid === before.processId);
  assert.equal(stopped.forceStopIssued, true); assert.equal(stopped.noProcessAfterStop, true);
  for (const key of keys.filter(key => !['stage', 'processId'].includes(key))) assert.equal(after[key], before[key]);
  assert.equal(after.stage, 'after'); assert(Number.isInteger(after.processId) && after.processId > 0);
  assert.notEqual(after.processId, before.processId);
  for (const key of ['sessionRestoredWithoutLogin', 'selectedReadRestored', 'controlRemainedUnread', 'readActionAbsent']) assert.equal(after[key], true);
  assert.deepEqual(Object.keys(after).sort(), [...keys, 'sessionRestoredWithoutLogin', 'selectedReadRestored', 'controlRemainedUnread', 'readActionAbsent'].sort());
}

export function verifyNotificationReadRecords(before, after, selectedNoticeId) {
  const find = state => state.documents.notifications.find(row => row.id === selectedNoticeId)?.data;
  const original = find(before), current = find(after);
  assert(original && current); assert.equal(original.read, false); assert(!Object.hasOwn(original, 'readAt'));
  assert.equal(current.read, true); assert.equal(typeof current.readAt?.toMillis, 'function');
  assert(Number.isSafeInteger(current.readAt.toMillis()) && current.readAt.toMillis() > 0);
  const stripRead = state => ({...state, documents: {...state.documents,
    notifications: state.documents.notifications.map(row => {
      if (row.id !== selectedNoticeId) return row;
      const {read, readAt, ...content} = row.data;
      return {...row, data: content};
    })}});
  assert.deepEqual(stripRead(after), stripRead(before), 'Only the selected notice read fields and allowed account timestamps may change');
  return {protectedRecordCount: Object.values(before.documents).reduce((n, rows) => n + rows.length, 0),
    selectedReadAtMillis: current.readAt.toMillis(), allOtherRecordsUnchanged: true, allClaimsUnchanged: true, liveTripsUnchanged: true};
}
