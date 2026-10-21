import assert from 'node:assert/strict';
import { db, call, denied } from './local-flow-client.mjs';
import { guardianVerificationId, guardianOperationId } from '../../functions/lib/domain/guardianVerification.js';
import { verifyTeamChatProtectedBaseline } from './team-conversation-ui-fixture.mjs';
import { teamReadReceiptId } from '../../functions/lib/domain/teamConversationRead.js';

export async function verifyTeamChatNativeRecords(fixture, marker) {
  const root = db.collection('teamConversations').doc(fixture.target.expectedTeamInstanceId);
  for (const [uid, messageId] of [[fixture.parent.uid, fixture.initialMessageId],
    [fixture.parent.uid, marker.peerMessageId], [fixture.driver.uid, marker.parentMessageId]]) {
    const receipt = await root.collection('readReceipts').doc(teamReadReceiptId(uid, messageId)).get();
    const message = await root.collection('entries').doc(messageId).get();
    assert.equal(receipt.get('userId'), uid); assert.equal(receipt.get('messageId'), messageId);
    assert(receipt.get('messageCreatedAt').isEqual(message.get('createdAt')));
    assert(receipt.get('readAt').toMillis() >= message.get('createdAt').toMillis());
  }
  assert.equal((await root.collection('readReceipts').get()).size, 3);
  const entries = await db.collection('teamConversations').doc(fixture.target.expectedTeamInstanceId).collection('entries').orderBy('sequence').get();
  assert.equal(entries.size, 5);
  assert.deepEqual(entries.docs.map(row => [row.get('sequence'), row.get('senderUserId'), row.get('body')]), [
    [1, fixture.driver.uid, 'Message avant arrivée QA'], [2, fixture.driver.uid, 'Bonjour équipe QA'],
    [3, fixture.driver.uid, 'Réponse conducteur QA'], [4, fixture.parent.uid, 'Message parent QA'],
    [5, fixture.driver.uid, 'Message conducteur après changement QA'],
  ]);
  assert.equal(entries.docs[0].id, fixture.earlyMessageId); assert.equal(entries.docs[1].id, fixture.initialMessageId);
  assert.equal(entries.docs[2].id, marker.peerMessageId); assert.equal(entries.docs[3].id, marker.parentMessageId);
  assert.equal(new Set(entries.docs.map(row => row.get('clientMessageId'))).size, 5);
  for (const row of entries.docs) assert.match(row.get('clientMessageId'), /^[a-f0-9-]{36}$/);
  assert.equal((await db.collection('teamConversations').doc(fixture.target.expectedTeamInstanceId).get()).get('lastSequence'), 5);
  const operations = await db.collection('teamMessageOperations').where('teamInstanceId', '==', fixture.target.expectedTeamInstanceId).get();
  assert.equal(operations.size, 5); assert.deepEqual(operations.docs.map(row => row.id).sort(), entries.docs.map(row => row.id).sort());
  const verificationId = guardianVerificationId(fixture.clubId, fixture.childId, fixture.parent.uid);
  const verification = await db.collection('guardianVerifications').doc(verificationId).get();
  assert.equal(verification.get('status'), 'revoked'); assert.equal(verification.get('revision'), 3);
  assert.equal(verification.get('lastActorUserId'), fixture.manager.uid);
  const operation = await db.collection('guardianVerificationEvents').doc(guardianOperationId(fixture.manager.uid, marker.guardianRevokeRequestId)).get();
  assert.equal(operation.get('verificationId'), verificationId); assert.equal(operation.get('action'), 'revoke');
  assert.equal(operation.get('actorUserId'), fixture.manager.uid); assert.equal(operation.get('revision'), 3);
  await denied('getTeamChatMessages', fixture.parent, fixture.target, 'PERMISSION_DENIED');
  const other = await call('getTeamChatMessages', fixture.otherParent, fixture.target);
  assert.deepEqual(other.items.map(row => row.id).sort(), entries.docs.slice(1).map(row => row.id).sort());
  const enrollments = await db.collection('teamEnrollments').where('teamInstanceId', '==', fixture.target.expectedTeamInstanceId).get();
  assert.equal(enrollments.size, 2); assert(enrollments.docs.every(row => row.get('status') === 'approved' && row.get('revision') === 2));
  return { ...await verifyTeamChatProtectedBaseline(fixture), committedMessages: 5, messageOperations: 5,
    noDraftPersisted: true, parentRevocationPersisted: true, otherVerifiedParentRetainsAccess: true,
    driverAndChildEnrollmentUnchanged: true };
}
