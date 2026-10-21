import assert from 'node:assert/strict';
import { db, call } from './local-flow-client.mjs';
import { guardianVerificationId, guardianOperationId } from '../../functions/lib/domain/guardianVerification.js';
import { teamEnrollmentOperationId } from '../../functions/lib/domain/teamEnrollment.js';
import { verifyTeamChatProtectedBaseline } from './team-conversation-ui-fixture.mjs';

export async function verifyTeamAccessNativeRecords(f, marker) {
  const expected = [[f.target, [
    [f.driver.uid, 'Message avant arrivée QA'], [f.driver.uid, 'Bonjour équipe QA'],
    [f.driver.uid, 'Message après second enfant QA'], [f.driver.uid, 'Message après nouvel accord QA'],
  ]], [f.otherTarget, [[f.driver.uid, 'Autre équipe avant accord QA'],
    [f.driver.uid, 'Message nouvelle équipe QA'], [f.parent.uid, 'Réponse seconde équipe QA']]]];
  const records = [];
  for (const [target, values] of expected) {
    const root = db.collection('teamConversations').doc(target.expectedTeamInstanceId);
    const entries = await root.collection('entries').orderBy('sequence').get();
    assert.deepEqual(entries.docs.map(row => [row.get('senderUserId'), row.get('body')]), values);
    assert.deepEqual(entries.docs.map(row => row.get('sequence')), values.map((_, index) => index + 1));
    assert.equal(new Set(entries.docs.map(row => row.get('clientMessageId'))).size, values.length);
    for (const row of entries.docs) assert.match(row.get('clientMessageId'), /^[a-f0-9-]{36}$/);
    const operations = await db.collection('teamMessageOperations').where('teamInstanceId', '==', target.expectedTeamInstanceId).get();
    assert.deepEqual(operations.docs.map(row => row.id).sort(), entries.docs.map(row => row.id).sort());
    assert.equal((await root.get()).get('lastSequence'), values.length); records.push(entries.docs);
  }
  assert.equal(records[0][0].id, f.earlyMessageId); assert.equal(records[0][1].id, f.initialMessageId);
  assert.equal(records[0][2].id, marker.messages.afterSecond); assert.equal(records[0][3].id, marker.messages.afterRenewal);
  assert.equal(records[1][0].id, f.otherEarlyMessageId); assert.equal(records[1][1].id, marker.messages.otherIncoming);
  assert.equal(records[1][2].id, marker.messages.otherReply);
  for (const [childId, status, revision] of [[f.childId, 'verified', 5], [f.secondChildId, 'revoked', 3]]) {
    const row = await db.collection('guardianVerifications').doc(guardianVerificationId(f.clubId, childId, f.parent.uid)).get();
    assert.equal(row.get('status'), status); assert.equal(row.get('revision'), revision); assert.equal(row.get('lastActorUserId'), f.manager.uid);
  }
  for (const [event, childId, action, revision] of [['firstRevocation', f.childId, 'revoke', 3],
    ['secondRevocation', f.secondChildId, 'revoke', 3], ['renewal', f.childId, 'verify', 5]]) {
    const row = await db.collection('guardianVerificationEvents').doc(guardianOperationId(f.manager.uid, marker.events[event])).get();
    assert.equal(row.get('verificationId'), guardianVerificationId(f.clubId, childId, f.parent.uid));
    assert.equal(row.get('action'), action); assert.equal(row.get('revision'), revision);
  }
  for (const [id, event] of [[f.secondEnrollmentId, 'secondChildApproval'], [f.otherEnrollmentId, 'otherTeamApproval']]) {
    const row = await db.collection('teamEnrollments').doc(id).get();
    assert.equal(row.get('status'), 'approved'); assert.equal(row.get('revision'), 2);
    const operation = await db.collection('teamEnrollmentEvents').doc(teamEnrollmentOperationId(f.manager.uid, marker.events[event])).get();
    assert.equal(operation.get('enrollmentId'), id); assert.equal(operation.get('actorUserId'), f.manager.uid);
    assert.equal(operation.get('action'), 'approve'); assert.equal(operation.get('revision'), 2);
  }
  assert.deepEqual((await call('getTeamChatMessages', f.parent, f.target)).items.map(row => row.id), [marker.messages.afterRenewal]);
  assert.deepEqual((await call('getTeamChatMessages', f.parent, f.otherTarget)).items.map(row => row.id).sort(),
    [marker.messages.otherIncoming, marker.messages.otherReply].sort());
  assert.equal((await call('getTeamChatMessages', f.otherParent, f.target)).items.length, 3);
  return { ...await verifyTeamChatProtectedBaseline(f), committedMessages: 7, messageOperations: 7,
    originalTeamMessages: 4, otherTeamMessages: 3, originalGuardianRenewed: true, secondGuardianRevoked: true,
    approvalsPersisted: true, parentHistoryBoundariesVerified: true, otherVerifiedParentRetainsAccess: true };
}
