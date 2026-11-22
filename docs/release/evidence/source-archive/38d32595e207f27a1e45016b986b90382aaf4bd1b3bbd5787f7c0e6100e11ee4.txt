import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { viewedBooking, call, db, signIn, tripInput } from './local-flow-client.mjs';
import { assertChatNetworkReceipt, assertTransportRequestSetup } from './chat-network-evidence.mjs';
import { assertNetworkStartReceipt } from './network-start-evidence.mjs';

export async function seedChatNetworkUiFixture() {
  const driver = await signIn('d@example.test');
  const parent = await signIn('p@example.test');
  const { tripId } = await call('createTrip', driver, { ...tripInput(), title: 'Trajet reprise réseau QA' });
  const { bookingId } = await call('requestBooking', parent, await viewedBooking(parent, { tripId, childId: 'sgm-qa-child-lina', seats: 1 }));
  await call('approveBooking', driver, { bookingId });
  assert.equal((await db.collection('messages').where('sourceId', '==', bookingId).get()).size, 0);
  const options = await call('listChatBookingOptions', parent);
  assert(options.items.some((item) => item.sourceId === bookingId));
  const bookingStatuses = [...new Set(options.items.map((item) => item.bookingStatus))].sort();
  assert(bookingStatuses.includes('declined') && bookingStatuses.includes('cancelled'),
    'The actual picker response must retain the earlier refused and cancelled reservations');
  return { tripId, bookingId, bookingStatuses };
}

export async function verifyChatNetworkUi(fixture, evidenceDir) {
  const ui = JSON.parse(readFileSync(resolve(evidenceDir, 'local-chat-network-ui.json'), 'utf8'));
  assertChatNetworkReceipt(ui);
  assertTransportRequestSetup(ui);
  assertNetworkStartReceipt(ui);
  assert.equal(ui.runId, process.env.SGM_LOCAL_RUN_ID);
  const expected = new Map([
    ['Connexion rétablie, rendez-vous confirmé.', 'sgm-qa-parent'],
    ['Bien reçu après la coupure.', 'sgm-qa-driver'],
  ]);
  const messages = await db.collection('messages').where('sourceId', '==', fixture.bookingId).get();
  assert.equal(messages.size, 2, 'One stored message per confirmed intent after recovery');
  const ids = new Set();
  for (const doc of messages.docs) {
    const data = doc.data();
    assert.equal(data.sourceType, 'booking');
    assert.equal(data.senderUserId, expected.get(data.body));
    assert.deepEqual(new Set(data.participantUserIds), new Set(['sgm-qa-parent', 'sgm-qa-driver']));
    assert.deepEqual(new Set(data.readByUserIds), new Set(['sgm-qa-parent', 'sgm-qa-driver']));
    assert.match(data.clientMessageId, /^[0-9a-f-]{36}$/);
    assert(!ids.has(data.clientMessageId)); ids.add(data.clientMessageId);
    expected.delete(data.body);
    const notes = await db.collection('notifications').where('messageId', '==', doc.id).get();
    assert.equal(notes.size, 1);
    const note = notes.docs[0].data();
    assert.equal(note.sourceId, fixture.bookingId); assert.equal(note.type, 'chatMessage');
    assert.equal(note.userId, data.senderUserId === 'sgm-qa-parent' ? 'sgm-qa-driver' : 'sgm-qa-parent');
    assert.equal(note.read, true); assert(note.readAt.toMillis() >= data.createdAt.toMillis());
  }
  assert.equal(expected.size, 0);
  for (const email of ['p@example.test', 'd@example.test']) {
    const inbox = await call('getInbox', await signIn(email));
    assert.equal(inbox.inbox.chats.find((item) => item.sourceId === fixture.bookingId)?.unreadCount, 0);
  }
  return { method: ui.scope, sourceId: fixture.bookingId, messageCount: messages.size, notificationCount: 2,
    duplicateMessages: 0, bookingStatuses: fixture.bookingStatuses,
    offlineDraftRetained: true, accountDraftCleared: true, networkRestored: true,
    limits: ['Network disabled before the first attempt, not after a server commit.',
      'No process restart, token expiry, physical device or push delivery tested.'] };
}
