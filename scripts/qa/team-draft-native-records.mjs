import assert from 'node:assert/strict';
import { db } from './local-flow-client.mjs';
import { verifyTeamChatProtectedBaseline } from './team-conversation-ui-fixture.mjs';

export async function verifyTeamDraftRecords(fixture, messageId = null) {
  const root = db.collection('teamConversations').doc(fixture.target.expectedTeamInstanceId);
  const entries = (await root.collection('entries').orderBy('sequence').get()).docs;
  const expected = [[fixture.driver.uid, 'Message avant arrivée QA'], [fixture.driver.uid, 'Bonjour équipe QA']];
  if (messageId) expected.push([fixture.parent.uid, 'Brouillon équipe après fermeture QA']);
  assert.deepEqual(entries.map(row => [row.get('senderUserId'), row.get('body')]), expected);
  assert.deepEqual(entries.map(row => row.get('sequence')), expected.map((_, index) => index + 1));
  assert.equal(entries[0].id, fixture.earlyMessageId); assert.equal(entries[1].id, fixture.initialMessageId);
  if (messageId) assert.equal(entries[2].id, messageId);
  assert.equal(new Set(entries.map(row => row.get('clientMessageId'))).size, expected.length);
  assert.equal((await root.get()).get('lastSequence'), expected.length);
  const operations = (await db.collection('teamMessageOperations').where('teamInstanceId', '==', fixture.target.expectedTeamInstanceId).get()).docs;
  assert.deepEqual(operations.map(row => row.id).sort(), entries.map(row => row.id).sort());
  return { ...await verifyTeamChatProtectedBaseline(fixture), messageCount: expected.length,
    messageOperationCount: operations.length, unsentDraftNotSubmitted: !messageId, exactlyOneExplicitParentSend: !!messageId };
}
