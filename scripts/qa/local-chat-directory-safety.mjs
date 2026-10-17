import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { FieldPath } from 'firebase-admin/firestore';
import { viewedBooking, call, db, denied, tripInput } from './local-flow-client.mjs';
import { seedChatDirectoryFixtures } from './local-chat-directory-fixtures.mjs';

export async function checkChatDirectorySafety() {
  const { prepareChatInbox } = await import('../../functions/lib/lib/prepareChatInbox.js');
  const { chatInboxId } = await import('../../functions/lib/domain/chatInbox.js');
  const { parent, driver, outsider, sourceIds } = await seedChatDirectoryFixtures();
  const source = (id) => ({ sourceType: 'booking', sourceId: id });
  const send = (actor, id, body) => call('sendChatMessage', actor, { bookingId: id, body, clientMessageId: randomUUID() });
  const ref = source(sourceIds[0]);
  await denied('sendChatMessage', parent, { bookingId: ref.sourceId, body: 'Do not index implicitly' }, 'FAILED_PRECONDITION');
  assert.equal((await db.doc(`chatInboxes/${chatInboxId(parent.uid, ref)}`).get()).exists, false);
  const dry = await prepareChatInbox(parent.uid, ref, false);
  assert.equal(dry.status, 'would-index');
  assert.equal(dry.messageCount, 1);
  assert.equal((await db.doc(`chatInboxes/${chatInboxId(parent.uid, ref)}`).get()).exists, false);
  for (const id of sourceIds.slice(0, 25)) {
    for (const actor of [parent, driver]) await prepareChatInbox(actor.uid, source(id), true);
  }
  assert.equal((await prepareChatInbox(parent.uid, ref, true)).status, 'already-indexed');

  const emptyId = sourceIds[25];
  const before = (await db.collection('messages').where('sourceId', '==', emptyId).get()).size;
  const options = await call('listChatBookingOptions', parent);
  assert.equal(options.items.length, 20);
  const moreOptions = await call('listChatBookingOptions', parent, { cursor: options.nextCursor });
  assert.equal(moreOptions.items.length, 6);
  assert.equal(new Set([...options.items, ...moreOptions.items].map((item) => item.sourceId)).size, 26);
  assert([...options.items, ...moreOptions.items].some((item) => item.sourceId === emptyId));
  await call('getChatConversation', parent, source(emptyId));
  assert.equal((await db.collection('messages').where('sourceId', '==', emptyId).get()).size, before,
    'Choosing an empty reservation must not fabricate a message');
  await send(parent, emptyId, 'Premier message depuis la réservation.');
  assert.equal((await db.collection('messages').where('sourceId', '==', emptyId).get()).size, 1);

  const incoming = [];
  for (let index = 0; index < 120; index += 1) incoming.push((await send(driver, ref.sourceId, `Message entrant ${index}`)).messageId);
  const legacyInbox = (await call('getInbox', parent)).inbox;
  assert.equal(legacyInbox.chats.length, 1, 'Fixture must reproduce the old recent-message discovery gap');
  const first = await call('listChatConversations', parent);
  assert.equal(first.items.length, 20);
  const originalOrder = await db.collection('chatInboxes').where('userId', '==', parent.uid)
    .orderBy('lastMessageAt', 'desc').orderBy(FieldPath.documentId(), 'desc').get();
  const boundary = first.items.at(-1);
  await send(driver, boundary.sourceId, 'Une ancienne conversation remonte dans la liste.');
  const second = await call('listChatConversations', parent, { cursor: first.nextCursor });
  assert.deepEqual(second.items.map((item) => item.id), originalOrder.docs.slice(20).map((doc) => doc.id),
    'An updated boundary document must not move the saved page cursor');
  assert.equal(second.items.length, 6);
  assert.equal(second.nextCursor, null);
  const all = [...first.items, ...second.items];
  assert.deepEqual(new Set(all.map((item) => item.sourceId)), new Set(sourceIds));
  assert.equal(new Set(all.map((item) => item.id)).size, 26);
  assert(all.every((item) => item.title === 'Trajet des conversations QA' && item.peerLabel === 'Directory driver QA'));

  const indexed = () => db.doc(`chatInboxes/${chatInboxId(parent.uid, ref)}`).get();
  assert.equal((await indexed()).data().unreadCount, 120);
  const latestIds = incoming.slice(-50);
  await call('markChatMessagesRead', parent, { ...ref, messageIds: latestIds });
  const revision = (await indexed()).data().revision;
  await call('markChatMessagesRead', parent, { ...ref, messageIds: latestIds });
  assert.equal((await indexed()).data().unreadCount, 70, 'Older unseen messages remain counted');
  assert.equal((await indexed()).data().revision, revision, 'Repeated reads do not change the index');
  await send(parent, ref.sourceId, 'Réponse sans effacer les anciens non lus.');
  assert.equal((await indexed()).data().unreadCount, 70);
  assert.equal((await db.doc(`chatInboxes/${chatInboxId(driver.uid, ref)}`).get()).data().unreadCount, 2);

  const indexRef = db.doc(`chatInboxes/${chatInboxId(parent.uid, ref)}`);
  const originalEntry = (await indexRef.get()).data();
  const unseenRef = db.doc(`messages/${incoming[0]}`);
  const unseen = (await unseenRef.get()).data();
  await indexRef.update({ unreadCount: 0 });
  await denied('markChatMessagesRead', parent, { ...ref, messageIds: [incoming[0]] }, 'FAILED_PRECONDITION');
  assert.deepEqual((await unseenRef.get()).data(), unseen, 'Counter underflow must not partially acknowledge a message');
  await indexRef.set({ ...originalEntry, lastMessageBody: 'Inconsistent history' });
  await assert.rejects(() => prepareChatInbox(parent.uid, ref, true),
    (error) => error.code === 'failed-precondition', 'Preparation must not silently replace a mismatched existing index');
  await indexRef.set({ ...originalEntry, schemaVersion: 99 });
  await denied('sendChatMessage', parent, { bookingId: ref.sourceId, body: 'Corrupt index', clientMessageId: randomUUID() },
    'FAILED_PRECONDITION');
  await indexRef.set(originalEntry);
  const malformedId = 'sgm-qa-directory-malformed-history';
  await db.doc(`bookings/${malformedId}`).set((await db.doc(`bookings/${ref.sourceId}`).get()).data());
  await db.doc(`messages/${malformedId}`).set({ sourceType: 'booking', sourceId: malformedId, senderUserId: driver.uid,
    body: 'Missing historical timestamp', participantUserIds: [parent.uid, driver.uid] });
  await assert.rejects(() => prepareChatInbox(parent.uid, source(malformedId), true), (error) => error.code === 'aborted');
  await denied('sendChatMessage', parent, { bookingId: malformedId, body: 'Do not skip malformed history' }, 'FAILED_PRECONDITION');
  assert.equal((await db.doc(`chatInboxes/${chatInboxId(parent.uid, source(malformedId))}`).get()).exists, false);
  await db.doc(`messages/${malformedId}`).delete();
  await db.doc(`bookings/${malformedId}`).delete();

  await denied('listChatConversations', null, {}, 'UNAUTHENTICATED');
  await denied('listChatBookingOptions', null, {}, 'UNAUTHENTICATED');
  await denied('listChatConversations', outsider, { cursor: first.nextCursor }, 'PERMISSION_DENIED');
  await denied('listChatBookingOptions', parent, { cursor: first.nextCursor }, 'INVALID_ARGUMENT');
  for (const cursor of ['!', 'a'.repeat(2049)]) await denied('listChatConversations', parent, { cursor }, 'INVALID_ARGUMENT');
  assert.deepEqual((await call('listChatConversations', outsider)).items, []);
  assert.deepEqual((await call('listChatBookingOptions', outsider)).items, []);
  const requestedByOther = await db.doc(`bookings/${emptyId}`).get();
  await requestedByOther.ref.update({ parentUserId: driver.uid, requesterUserId: parent.uid });
  const eligible = await call('listChatBookingOptions', parent);
  assert(!eligible.items.some((item) => item.sourceId === emptyId), 'Legacy requester cannot override a different canonical parent');
  await denied('getChatConversation', parent, source(emptyId), 'PERMISSION_DENIED');

  await db.doc(`users/${driver.uid}`).update({ driverVerified: true });
  const title = 'Trajet publié pour une nouvelle discussion QA';
  const { tripId } = await call('createTrip', driver, { ...tripInput(), title });
  assert.equal(typeof (await db.doc(`trips/${tripId}`).get()).get('departureAt'), 'string');
  const { bookingId } = await call('requestBooking', parent, await viewedBooking(parent, { tripId, seats: 1 }));
  await call('approveBooking', driver, { bookingId });
  const publishedOptions = await call('listChatBookingOptions', parent);
  const published = publishedOptions.items.find((item) => item.sourceId === bookingId);
  assert.equal(published.title, title);
  assert(published.departureLabel);
  await send(parent, bookingId, 'Premier échange pour un trajet publié.');
  const publishedChat = (await call('listChatConversations', parent)).items.find((item) => item.sourceId === bookingId);
  assert.equal(publishedChat.title, title);
  assert.equal(publishedChat.departureLabel, published.departureLabel);
}
