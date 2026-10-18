import assert from 'node:assert/strict';

const common = ['projectId', 'runId', 'scope', 'stage', 'completed', 'actorUserId', 'processId',
  'tripId', 'otherTripId', 'draftHash', 'departureDate', 'departureTime', 'arrivalDate', 'arrivalTime',
  'hasArrival', 'originalPlacesRetained', 'otherTripIsolated', 'proposeEnabled'];
const keys = (record, expected) => assert.deepEqual(Object.keys(record).sort(), [...expected].sort(), 'Only typed schedule-draft observations may be archived');

export function scheduleDraftFields(departureAt, arrivalBy) {
  const formatter = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Brussels', hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  const parts = (instant) => {
    const date = new Date(instant); assert(Number.isFinite(date.getTime()));
    return Object.fromEntries(formatter.formatToParts(date).map((p) => [p.type, p.value]));
  };
  const departure = parts(departureAt), arrival = parts(arrivalBy);
  assert(Date.parse(arrivalBy) > Date.parse(departureAt));
  return { departureDate: `${departure.year}-${departure.month}-${departure.day}`, departureTime: `${departure.hour}:${departure.minute}`,
    arrivalDate: `${arrival.year}-${arrival.month}-${arrival.day}`, arrivalTime: `${arrival.hour}:${arrival.minute}`, hasArrival: true };
}

export function assertPreparedScheduleDraft(before, runId) {
  keys(before, [...common, 'scheduleSaved']); assert.match(runId, /^[a-f0-9]{32}$/);
  assert.equal(before.projectId, 'demo-sgm-local-qa'); assert.equal(before.runId, runId);
  assert.equal(before.scope, 'native-ui-private-schedule-draft-restart'); assert.equal(before.stage, 'before');
  assert.equal(before.completed, true); assert.equal(before.actorUserId, 'sgm-qa-driver');
  assert(Number.isSafeInteger(before.processId) && before.processId > 0);
  for (const field of ['tripId', 'otherTripId']) assert(typeof before[field] === 'string' && before[field].length > 0);
  assert.notEqual(before.tripId, before.otherTripId); assert.match(before.draftHash, /^[a-f0-9]{64}$/);
  for (const field of ['departureDate', 'arrivalDate']) {
    assert.match(before[field], /^\d{4}-\d{2}-\d{2}$/);
    const date = new Date(`${before[field]}T00:00:00Z`);
    assert(Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === before[field]);
  }
  for (const field of ['departureTime', 'arrivalTime']) assert.match(before[field], /^(?:[01]\d|2[0-3]):[0-5]\d$/);
  for (const field of ['hasArrival', 'originalPlacesRetained', 'otherTripIsolated', 'proposeEnabled', 'scheduleSaved']) assert.equal(before[field], true);
}

export function assertScheduleDraftRestart(before, stopped, after, fixture, runId) {
  assertPreparedScheduleDraft(before, runId);
  keys(after, [...common, 'scheduleRestored', 'sessionRestoredWithoutLogin']);
  keys(stopped, ['projectId', 'runId', 'scope', 'appId', 'preparedProcessId', 'observedBeforePid', 'forceStopIssued', 'noProcessAfterStop']);
  assert.equal(before.tripId, fixture.tripId); assert.equal(before.otherTripId, fixture.otherTripId);
  const expected = scheduleDraftFields(fixture.draftDepartureAt, fixture.draftArrivalBy);
  const original = scheduleDraftFields(fixture.originalDepartureAt, fixture.draftArrivalBy);
  assert.notEqual(expected.departureDate, original.departureDate);
  assert.notEqual(expected.departureTime, original.departureTime);
  for (const [field, value] of Object.entries(expected)) { assert.equal(before[field], value); assert.equal(after[field], value); }
  for (const field of common.filter((key) => !['stage', 'processId'].includes(key))) assert.equal(after[field], before[field]);
  assert.equal(after.stage, 'after'); assert.equal(after.scheduleRestored, true); assert.equal(after.sessionRestoredWithoutLogin, true);
  assert(Number.isSafeInteger(after.processId) && after.processId > 0); assert.notEqual(after.processId, before.processId);
  assert.equal(stopped.projectId, before.projectId); assert.equal(stopped.runId, runId);
  assert.equal(stopped.scope, 'disposable-local-app-force-stop'); assert.equal(stopped.appId, 'be.sportgreenmoove.app.local');
  assert.equal(stopped.preparedProcessId, before.processId);
  assert(stopped.observedBeforePid === null || stopped.observedBeforePid === before.processId);
  assert.equal(stopped.forceStopIssued, true); assert.equal(stopped.noProcessAfterStop, true);
}
