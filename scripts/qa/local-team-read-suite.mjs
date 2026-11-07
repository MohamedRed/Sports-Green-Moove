import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Timestamp } from 'firebase-admin/firestore';
import { deleteApp, getApp } from 'firebase-admin/app';
import { seedLocalUiFixtures } from './local-ui-fixtures.mjs';
import { db, call, denied, signIn } from './local-flow-client.mjs';
import { prepareTeamChatAccessUiFixture } from './team-chat-access-ui-fixture.mjs';
import { verifyTeamChatProtectedBaseline } from './team-conversation-ui-fixture.mjs';
import { fetchLocalQa } from './local-http-request.mjs';
import { teamReadReceiptId } from '../../functions/lib/domain/teamConversationRead.js';

const steps = [], passed = id => steps.push({ id, status: 'passed' });
await seedLocalUiFixtures(); let isolation;
try {
  const f = await prepareTeamChatAccessUiFixture(), root = db.collection('teamConversations').doc(f.target.expectedTeamInstanceId);
  const page = (actor, target = f.target) => call('getTeamChatMessages', actor, target);
  const send = (actor, body, target = f.target) => call('sendTeamChatMessage', actor, { ...target, body, clientMessageId: randomUUID() });
  const read = (view, messageIds) => ({ ...f.target, expectedAccessVersion: view.accessVersion, messageIds });
  async function count(actor, target = f.target) {
    let cursor;
    do {
      const next = await call('listTeamChatOptions', actor, { kind: 'teams', clubId: f.clubId, ...(cursor ? { cursor } : {}) });
      const team = next.items.find(item => item.id === target.teamId); if (team) return team.unreadCount;
      cursor = next.nextCursor;
    } while (cursor);
    return null;
  }
  const initial = await page(f.parent);
  assert.equal(initial.items.length, 1); assert.equal(initial.items[0].needsRead, true);
  assert.equal(await count(f.parent), 1); assert.equal(await count(f.driver), 0); assert.equal(await count(f.otherParent), 1);
  const clubs = await call('listTeamChatOptions', f.parent, { kind: 'clubs' });
  assert(clubs.items.every(item => item.unreadCount === null));
  passed('current-admission-count-excludes-old-history-and-own-sends');

  const input = read(initial, [f.initialMessageId]);
  await denied('markTeamChatMessagesRead', null, input, 'UNAUTHENTICATED');
  for (const actor of [f.unrelated, f.manager]) await denied('markTeamChatMessagesRead', actor, input, 'PERMISSION_DENIED');
  for (const patch of [{ messageIds: [] }, { messageIds: [f.initialMessageId, f.initialMessageId] },
    { expectedAccessVersion: 'legacy' }, { userId: f.otherParent.uid }])
    await denied('markTeamChatMessagesRead', f.parent, { ...input, ...patch }, 'INVALID_ARGUMENT');
  await denied('markTeamChatMessagesRead', f.otherParent, input, 'PERMISSION_DENIED');
  passed('read-endpoint-requires-auth-authority-account-bound-window-and-exact-input');

  const replies = await Promise.all([call('markTeamChatMessagesRead', f.parent, input), call('markTeamChatMessagesRead', f.parent, input)]);
  assert(replies.every(reply => reply.currentUserId === f.parent.uid && reply.accessVersion === initial.accessVersion &&
    reply.teamInstanceId === f.target.expectedTeamInstanceId && reply.readMessageIds[0] === f.initialMessageId));
  assert.equal((await root.collection('readReceipts').get()).size, 1);
  assert.equal(await count(f.parent), 0); assert.equal(await count(f.otherParent), 1);
  assert.equal((await page(f.parent)).items[0].needsRead, false); assert.equal((await page(f.otherParent)).items[0].needsRead, true);
  await call('markTeamChatMessagesRead', await signIn('p@example.test'), input);
  assert.equal((await root.collection('readReceipts').get()).size, 1);
  passed('concurrent-and-reconnected-replays-persist-one-private-receipt');

  const own = await send(f.parent, 'Réponse lue séparément QA');
  assert.equal(await count(f.parent), 0); assert.equal(await count(f.driver), 1); assert.equal(await count(f.otherParent), 2);
  const parentView = await page(f.parent); assert.equal(parentView.items.find(item => item.id === own.messageId).needsRead, false);
  await call('markTeamChatMessagesRead', f.parent, read(parentView, [own.messageId]));
  assert.equal((await root.collection('readReceipts').get()).size, 1);
  passed('outgoing-message-does-not-create-an-incoming-receipt-or-unread-count');

  const second = await send(f.driver, 'Deuxième message visible QA');
  const third = await send(f.driver, 'Troisième message hors sélection QA');
  const latest = await page(f.parent);
  await call('markTeamChatMessagesRead', f.parent, read(latest, [second.messageId]));
  assert.equal(await count(f.parent), 1);
  assert.equal((await page(f.parent)).items.find(item => item.id === third.messageId).needsRead, true);
  passed('acknowledging-selected-messages-keeps-unseen-messages-unread');

  const before = (await root.collection('readReceipts').get()).size;
  for (const messageIds of [[third.messageId, f.earlyMessageId], [third.messageId, 'f'.repeat(64)],
    [third.messageId, f.otherEarlyMessageId]]) await assert.rejects(() => call('markTeamChatMessagesRead', f.parent, read(latest, messageIds)));
  assert.equal((await root.collection('readReceipts').get()).size, before); assert.equal(await count(f.parent), 1);
  passed('pre-admission-missing-and-cross-team-identities-reject-the-whole-batch');

  const receipt = root.collection('readReceipts').doc(teamReadReceiptId(f.parent.uid, f.initialMessageId));
  const original = (await receipt.get()).data();
  try {
    await receipt.update({ userId: f.otherParent.uid });
    await denied('getTeamChatMessages', f.parent, f.target, 'FAILED_PRECONDITION');
  } finally { await receipt.set(original); }
  const corrupt = root.collection('readReceipts').doc('e'.repeat(64));
  try {
    await corrupt.create({ userId: f.parent.uid, messageId: 'e'.repeat(64), messageCreatedAt: Timestamp.now(), readAt: Timestamp.now() });
    await call('markTeamChatMessagesRead', f.parent, read(latest, [third.messageId]));
    await denied('listTeamChatOptions', f.parent, { kind: 'teams', clubId: f.clubId, cursor: (await call('listTeamChatOptions', f.parent,
      { kind: 'teams', clubId: f.clubId })).nextCursor }, 'FAILED_PRECONDITION');
  } finally { await corrupt.delete(); }
  assert.equal(await count(f.parent), 0);
  passed('contradictory-receipt-and-negative-unread-count-fail-explicitly');

  const url = `http://127.0.0.1:8080/v1/projects/demo-sgm-local-qa/databases/(default)/documents/${receipt.path}`;
  for (const actor of [f.parent, f.manager, await signIn('admin@example.test')]) {
    assert.equal((await fetchLocalQa(url, { headers: { authorization: `Bearer ${actor.token}` } })).status, 403);
    assert.equal((await fetchLocalQa(url, { method: 'PATCH', headers: { authorization: `Bearer ${actor.token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ fields: { userId: { stringValue: actor.uid } } }) })).status, 403);
  }
  passed('direct-receipt-read-and-write-denied-including-manager-and-admin');

  const reference = { childId: f.childId, clubId: f.clubId, parentUserId: f.parent.uid };
  await call('transitionGuardianVerification', f.manager, { ...reference, action: 'revoke', expectedRevision: 2, requestId: randomUUID() });
  await denied('markTeamChatMessagesRead', f.parent, read(latest, [third.messageId]), 'PERMISSION_DENIED');
  assert.equal(await count(f.parent), null); assert.equal(await count(f.otherParent), 4);
  await call('transitionGuardianVerification', f.parent, { ...reference, action: 'request', expectedRevision: 3, requestId: randomUUID() });
  await call('transitionGuardianVerification', f.manager, { ...reference, action: 'verify', expectedRevision: 4, requestId: randomUUID() });
  const renewed = await page(f.parent); assert.deepEqual(renewed.items, []); assert.equal(await count(f.parent), 0);
  assert.notEqual(renewed.accessVersion, latest.accessVersion);
  const afterRenewal = await send(f.driver, 'Nouveau droit, nouveau message QA');
  await denied('markTeamChatMessagesRead', f.parent, read(latest, [afterRenewal.messageId]), 'PERMISSION_DENIED');
  await denied('markTeamChatMessagesRead', f.parent, read(renewed, [third.messageId]), 'PERMISSION_DENIED');
  assert.equal(await count(f.parent), 1);
  await call('markTeamChatMessagesRead', f.parent, read(renewed, [afterRenewal.messageId])); assert.equal(await count(f.parent), 0);
  passed('revocation-and-renewal-recheck-authority-and-reset-only-the-visible-history');

  await call('transitionTeamEnrollment', f.manager, { enrollmentId: f.otherEnrollmentId, action: 'approve', expectedRevision: 1, requestId: randomUUID() });
  assert.equal(await count(f.parent, f.otherTarget), 0);
  const otherMessage = await send(f.driver, 'Message distinct autre équipe QA', f.otherTarget);
  assert.equal(await count(f.parent, f.otherTarget), 1); assert.equal(await count(f.parent), 0);
  await denied('markTeamChatMessagesRead', f.parent, read(await page(f.parent), [otherMessage.messageId]), 'NOT_FOUND');
  const otherView = await page(f.parent, f.otherTarget);
  await call('markTeamChatMessagesRead', f.parent, { ...f.otherTarget, expectedAccessVersion: otherView.accessVersion, messageIds: [otherMessage.messageId] });
  assert.equal(await count(f.parent, f.otherTarget), 0); assert.equal(await count(f.parent), 0);
  passed('separate-team-counts-and-receipts-remain-independent');

  const bulk = db.batch(), at = Timestamp.now(), lastSequence = (await root.get()).get('lastSequence');
  for (let index = 0; index < 55; index++) bulk.create(root.collection('entries').doc(createHash('sha256').update(`read-page-${index}`).digest('hex')), {
    senderUserId: f.driver.uid, body: `Message de pagination QA ${index}`, clientMessageId: randomUUID(), sequence: lastSequence + index + 1, createdAt: at,
  });
  bulk.update(root, { lastSequence: lastSequence + 55, updatedAt: at }); await bulk.commit();
  assert.equal(await count(f.parent), 55);
  const first = await page(f.parent); assert.equal(first.items.length, 50); assert(first.nextCursor);
  await denied('markTeamChatMessagesRead', f.parent, read(first, Array.from({ length: 51 }, (_, index) => index.toString(16).padStart(64, '0'))), 'INVALID_ARGUMENT');
  await call('markTeamChatMessagesRead', f.parent, read(first, first.items.map(item => item.id))); assert.equal(await count(f.parent), 5);
  const older = await call('getTeamChatMessages', f.parent, { ...f.target, cursor: first.nextCursor });
  assert.equal(older.items.filter(item => item.needsRead).length, 5);
  await call('markTeamChatMessagesRead', f.parent, read(older, older.items.filter(item => item.needsRead).map(item => item.id)));
  assert.equal(await count(f.parent), 0);
  passed('exact-counts-span-pages-with-equal-timestamps-without-marking-unseen-rows');

  const profile = db.collection('users').doc(f.parent.uid), roles = (await profile.get()).get('roles');
  try {
    await profile.update({ roles: { ...roles, child: true } });
    await denied('markTeamChatMessagesRead', f.parent, read(first, [afterRenewal.messageId]), 'PERMISSION_DENIED');
    await denied('listTeamChatOptions', f.parent, { kind: 'clubs' }, 'PERMISSION_DENIED');
  } finally { await profile.update({ roles }); }
  passed('current-child-role-cannot-read-or-acknowledge-with-a-stale-adult-token');
  isolation = await verifyTeamChatProtectedBaseline(f);
} finally { await deleteApp(getApp()); }
const paths = ['functions/src/domain/teamConversationRead.ts', 'functions/src/services/teamConversationRead.ts',
  'functions/src/services/teamConversation.ts', 'functions/src/services/teamConversationAuthority.ts',
  'functions/src/services/teamConversationOptions.ts', 'functions/src/callables/teamConversation.ts',
  'firestore.rules', 'firestore.indexes.json', ...['local-team-read-suite', 'run-local-team-conversation', 'team-chat-access-ui-fixture',
    'team-conversation-ui-fixture', 'local-ui-fixtures'].map(name => 'scripts/qa/' + name + '.mjs')];
writeFileSync(process.env.SGM_LOCAL_FLOW_OUTPUT, JSON.stringify({ projectId: 'demo-sgm-local-qa', runId: process.env.SGM_LOCAL_RUN_ID,
  testedAt: new Date().toISOString(), scope: 'local-team-read-services-not-native-or-push-proof', completed: true, steps, isolation,
  nativeUiExecuted: false, physicalDevice: false, productionWrites: false, notificationsVerified: false, adminClientClosed: true,
  sourceFiles: Object.fromEntries(paths.map(file => [file, createHash('sha256').update(readFileSync(resolve(import.meta.dirname, '../..', file))).digest('hex')]))
}, null, 2) + '\n', { flag: 'wx' });
console.log(`Passed ${steps.length} isolated team-read service scenarios; no native or push outcome accepted.`);
