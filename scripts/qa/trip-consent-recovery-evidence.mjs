import assert from 'node:assert/strict';
import { unchangedTripDetails } from './trip-change-inputs-evidence.mjs';

export const recoveryKinds = ['pending', 'partial', 'declined', 'withdrawn'];
const statusFor = (kind) => kind === 'partial' ? 'pending' : kind;

export function assertRecoveryRecords({ trip, bookings, proposalId, change, notifications, quotes, balances }, fixture, kind) {
  assert(recoveryKinds.includes(kind));
  assert.deepEqual(unchangedTripDetails(trip), fixture.before);
  assert.deepEqual(bookings, fixture.bookingsBefore);
  assert.equal(change.tripId, fixture.tripId); assert.equal(change.driverUserId, fixture.driverUid);
  assert.equal(change.status, statusFor(kind)); assert.equal(change.application, undefined);
  assert.deepEqual([...change.parentUserIds].sort(), [...fixture.parentUids].sort());
  assert.deepEqual([...change.bookingIds].sort(), [...fixture.bookingIds].sort());
  assert.equal(change.originalTerms.priceCents, 250); assert.equal(change.terms.priceCents, 400);
  for (const terms of [change.originalTerms, change.terms]) {
    for (const key of ['origin', 'destination']) assert.deepEqual(terms[key], fixture.before[key]);
    assert.equal(Date.parse(terms.departureAt), Date.parse(fixture.before.departureAt));
    assert.equal(terms.arrivalBy, null);
  }
  const decision = kind === 'partial' ? 'accept' : kind === 'declined' ? 'decline' : null;
  assert.deepEqual(Object.keys(change.decisions), decision ? [fixture.parentUids[0]] : []);
  if (decision) assert.equal(change.decisions[fixture.parentUids[0]].decision, decision);
  assert.equal(trip.pendingChangeId, ['pending', 'partial'].includes(kind) ? proposalId : undefined);
  assert.equal(quotes.length, 0); assert.equal(balances.length, 0);
  const recipients = ['declined', 'withdrawn'].includes(kind) ? [...fixture.parentUids, ...fixture.parentUids, fixture.driverUid] : fixture.parentUids;
  assert.equal(notifications.length, recipients.length);
  assert.deepEqual(notifications.map((note) => note.userId).sort(), [...recipients].sort());
  assert.equal(new Set(notifications.map((note) => note.id)).size, notifications.length);
  for (const note of notifications) {
    assert.equal(note.proposalId, proposalId); assert.equal(note.sourceId, fixture.tripId); assert.equal(note.type, 'tripChange');
  }
  return { tripId: fixture.tripId, proposalId, kind, status: statusFor(kind), bookingIds: fixture.bookingIds,
    decisionCount: decision ? 1 : 0, notificationCount: notifications.length };
}

export function assertPreparedRecovery(before, runId) {
  assert.deepEqual(Object.keys(before).sort(), ['projectId', 'runId', 'scope', 'stage', 'completed', 'actorUserId', 'processId', 'records'].sort());
  assert.match(runId, /^[a-f0-9]{32}$/); assert.equal(before.runId, runId); assert.equal(before.projectId, 'demo-sgm-local-qa');
  assert.equal(before.scope, 'native-ui-trip-consent-recovery-matrix');
  assert.equal(before.stage, 'before'); assert.equal(before.completed, true); assert.equal(before.actorUserId, 'sgm-qa-parent');
  assert(Number.isInteger(before.processId) && before.processId > 0);
  assert.equal(before.records.length, recoveryKinds.length);
  assert.deepEqual(before.records.map((item) => item.kind), recoveryKinds);
  for (const item of before.records) {
    assert.deepEqual(Object.keys(item).sort(), ['kind', 'tripId', 'bookingId', 'proposalId', 'prepared'].sort());
    for (const key of ['tripId', 'bookingId']) assert.match(item[key], /^[A-Za-z0-9_-]{1,128}$/);
    assert.match(item.proposalId, /^[a-f0-9]{64}$/); assert.equal(item.prepared, true);
  }
}

export function assertRecoveryRestart(before, stopped, after, fixtures, runId) {
  assertPreparedRecovery(before, runId);
  for (const key of ['projectId', 'runId', 'scope', 'actorUserId']) assert.equal(after[key], before[key]);
  assert.equal(after.stage, 'after'); assert.equal(after.completed, true);
  assert(Number.isInteger(after.processId) && after.processId > 0); assert.notEqual(after.processId, before.processId);
  assert.equal(stopped.projectId, before.projectId); assert.equal(stopped.runId, runId);
  assert.equal(stopped.scope, 'disposable-local-app-force-stop'); assert.equal(stopped.appId, 'be.sportgreenmoove.app.local');
  assert.equal(stopped.preparedProcessId, before.processId);
  assert(stopped.observedBeforePid === null || stopped.observedBeforePid === before.processId);
  assert.equal(stopped.forceStopIssued, true); assert.equal(stopped.noProcessAfterStop, true);
  assert.equal(after.sessionRestoredWithoutLogin, true); assert.equal(after.endedAsUserId, 'sgm-qa-driver');
  assert.equal(after.records.length, recoveryKinds.length);
  for (const [index, kind] of recoveryKinds.entries()) {
    const original = before.records[index], restored = after.records[index], fixture = fixtures[kind];
    assert.equal(original.tripId, fixture.tripId); assert.equal(original.bookingId, fixture.bookingIds[0]);
    for (const key of ['kind', 'tripId', 'bookingId', 'proposalId']) assert.equal(restored[key], original[key]);
    for (const key of ['parentStateRestored', 'refreshUnchanged', 'secondParentScoped', 'driverStateRestored']) assert.equal(restored[key], true, `${kind}.${key}`);
    if (['pending', 'partial'].includes(kind)) assert.equal(restored.originalProposalRestored, true);
    else assert.equal(restored.closedActionsAbsent, true);
  }
}
