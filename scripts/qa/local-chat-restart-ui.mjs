import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { viewedBooking, call, db, signIn, tripInput } from './local-flow-client.mjs';
import { assertChatRestartInteractionReceipt } from './chat-restart-evidence.mjs';

const bodies = ['Message confirmé avant relancement.', 'Nouvel envoi après relancement.', 'Réponse reçue après relancement.'];
const actors = ['sgm-qa-parent', 'sgm-qa-parent', 'sgm-qa-driver'];
const save = (directory, name, value) => writeFileSync(resolve(directory, name), `${JSON.stringify(value, null, 2)}\n`);

export async function seedChatRestartUiFixture() {
  const driver = await signIn('d@example.test'), parent = await signIn('p@example.test');
  const { tripId } = await call('createTrip', driver, { ...tripInput(), title: 'Trajet relancement QA' });
  const { bookingId } = await call('requestBooking', parent, await viewedBooking(parent, { tripId, childId: 'sgm-qa-child-lina', seats: 1 }));
  await call('approveBooking', driver, { bookingId });
  assert.equal((await db.collection('messages').where('sourceId', '==', bookingId).get()).size, 0);
  return { tripId, bookingId };
}

export async function checkpointChatRestart(fixture, directory) {
  const messages = await db.collection('messages').where('sourceId', '==', fixture.bookingId).get();
  assert.equal(messages.size, 1);
  const first = messages.docs[0], data = first.data();
  assert.equal(data.sourceType, 'booking'); assert.equal(data.senderUserId, actors[0]);
  assert.equal(data.body, bodies[0]); assert.match(data.clientMessageId, /^[0-9a-f-]{36}$/);
  const notes = await db.collection('notifications').where('messageId', '==', first.id).get();
  assert.equal(notes.size, 1); assert.equal(notes.docs[0].get('userId'), 'sgm-qa-driver');
  const checkpoint = { projectId: 'demo-sgm-local-qa', runId: process.env.SGM_LOCAL_RUN_ID,
    sourceId: fixture.bookingId, messageId: first.id, clientMessageId: data.clientMessageId,
    createdAtMillis: data.createdAt.toMillis(), messageCount: 1, notificationCount: 1 };
  save(directory, 'local-chat-restart-checkpoint.json', checkpoint);
  return checkpoint;
}

export async function verifyChatRestartUi(fixture, checkpoint, directory) {
  const load = (name) => JSON.parse(readFileSync(resolve(directory, name), 'utf8'));
  const before = load('local-chat-restart-before.json'), after = load('local-chat-restart-after.json');
  const stopped = load('local-chat-restart-stop.json');
  assertChatRestartInteractionReceipt(before, stopped, after, process.env.SGM_LOCAL_RUN_ID);
  assert.equal(checkpoint.runId, before.runId); assert.equal(checkpoint.sourceId, fixture.bookingId);
  const messages = await db.collection('messages').where('sourceId', '==', fixture.bookingId).get();
  assert.equal(messages.size, 3, 'Exactly one record per intended UI send across the process boundary');
  const expected = new Map(bodies.map((body, index) => [body, actors[index]])), requests = new Set(), stored = [];
  for (const doc of messages.docs) {
    const data = doc.data();
    assert.equal(data.sourceType, 'booking'); assert.equal(data.senderUserId, expected.get(data.body));
    expected.delete(data.body);
    assert.deepEqual(new Set(data.participantUserIds), new Set(['sgm-qa-parent', 'sgm-qa-driver']));
    assert.deepEqual(new Set(data.readByUserIds), new Set(['sgm-qa-parent', 'sgm-qa-driver']));
    assert.match(data.clientMessageId, /^[0-9a-f-]{36}$/); assert(!requests.has(data.clientMessageId));
    requests.add(data.clientMessageId);
    if (doc.id === checkpoint.messageId) {
      assert.equal(data.clientMessageId, checkpoint.clientMessageId);
      assert.equal(data.createdAt.toMillis(), checkpoint.createdAtMillis);
    }
    const notes = await db.collection('notifications').where('messageId', '==', doc.id).get();
    assert.equal(notes.size, 1);
    const note = notes.docs[0].data();
    assert.equal(note.type, 'chatMessage'); assert.equal(note.sourceId, fixture.bookingId);
    assert.equal(note.sourceType, 'booking'); assert.equal(note.read, true);
    assert.equal(note.userId, data.senderUserId === 'sgm-qa-parent' ? 'sgm-qa-driver' : 'sgm-qa-parent');
    assert(note.readAt.toMillis() >= data.createdAt.toMillis());
    stored.push({ messageId: doc.id, body: data.body, senderUserId: data.senderUserId,
      clientMessageId: data.clientMessageId, createdAtMillis: data.createdAt.toMillis(), notificationId: notes.docs[0].id,
      recipientUserId: note.userId, read: note.read });
  }
  assert.equal(expected.size, 0); assert(stored.some((message) => message.messageId === checkpoint.messageId));
  for (const email of ['p@example.test', 'd@example.test']) {
    const inbox = await call('getInbox', await signIn(email));
    assert.equal(inbox.inbox.chats.find((item) => item.sourceId === fixture.bookingId)?.unreadCount, 0);
  }
  save(directory, 'local-chat-restart-persisted.json', { projectId: before.projectId, runId: before.runId,
    sourceId: fixture.bookingId, scope: 'local-persisted-confirmed-conversation-restart', messages: stored });
  return { method: 'native-ui-confirmed-conversation-force-stop', sourceId: fixture.bookingId,
    preparedProcessId: before.processId, resumedProcessId: after.processId, messageCount: 3,
    notificationCount: 3, duplicateMessages: 0, originalMessageUnchanged: true, sessionRestoredWithoutLogin: true,
    limits: ['Confirmed messages only; pending or unsent draft recovery is not tested.',
      'No physical device, token expiry, post-commit acknowledgement loss or push delivery tested.'] };
}
