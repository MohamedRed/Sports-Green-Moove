import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { deleteApp, getApp } from 'firebase-admin/app';
import { Timestamp } from 'firebase-admin/firestore';
import { db, call, denied } from './local-flow-client.mjs';
import { seedLocalUiFixtures } from './local-ui-fixtures.mjs';
import { prepareTeamChatUiFixture, verifyTeamChatProtectedBaseline } from './team-conversation-ui-fixture.mjs';

const steps = [], observed = {}, sha = bytes => createHash('sha256').update(bytes).digest('hex');
let fixture, isolation, failure;
async function check(id, action) {
  try { await action(); steps.push({ id, status: 'passed' }); }
  catch (error) { steps.push({ id, status: 'failed' }); throw error; }
}
async function enrollment(actor, manager, teamId, childId) {
  const view = await call('getTeamEnrollmentView', actor, { teamId, ...(childId ? { childId } : {}) });
  const requested = await call('requestTeamEnrollment', actor, { teamId, ...(childId ? { childId } : {}),
    expectedTeamInstanceId: view.teamInstanceId, expectedEnrollmentId: view.id,
    expectedRevision: view.revision, requestId: randomUUID() });
  const approve = () => call('transitionTeamEnrollment', manager, { enrollmentId: view.id,
    action: 'approve', expectedRevision: requested.revision, requestId: randomUUID() });
  return { view, requested, approve };
}
async function page(actor, target) {
  const items = [], cursors = new Set(); let cursor;
  do {
    const result = await call('getTeamChatMessages', actor, { ...target, ...(cursor ? { cursor } : {}) });
    assert.equal(result.currentUserId, actor.uid); assert.equal(result.teamInstanceId, target.expectedTeamInstanceId);
    items.push(...result.items); cursor = result.nextCursor;
    if (cursor) { assert(!cursors.has(cursor)); cursors.add(cursor); assert(cursors.size < 10); }
  } while (cursor);
  assert.equal(new Set(items.map(item => item.id)).size, items.length); return items;
}
async function teams(actor, clubId) {
  const items = [], cursors = new Set(); let cursor;
  do {
    const result = await call('listTeamChatOptions', actor, { kind: 'teams', clubId, ...(cursor ? { cursor } : {}) });
    assert.equal(result.currentUserId, actor.uid); items.push(...result.items); cursor = result.nextCursor;
    if (cursor) { assert(!cursors.has(cursor)); cursors.add(cursor); assert(cursors.size < 10); }
  } while (cursor);
  return items.map(item => item.id).sort();
}
try {
  await seedLocalUiFixtures(); fixture = await prepareTeamChatUiFixture();
  const { parent, driver, manager, otherParent, childId, clubId, target, teamId } = fixture;
  const send = (actor, body, scope = target) => call('sendTeamChatMessage', actor, { ...scope, body, clientMessageId: randomUUID() });
  const guardian = (childId, action, expectedRevision, actor = manager) => call('transitionGuardianVerification', actor,
    { clubId, childId, parentUserId: parent.uid, action, expectedRevision, requestId: randomUUID() });
  for (let index = 0; index < 51; index++) await send(driver, `Accès multiple QA ${index}`);
  const originalRequest = { ...target, body: 'Message avant second accord QA', clientMessageId: randomUUID() };
  const originalReply = await call('sendTeamChatMessage', parent, originalRequest);
  const oldPage = await call('getTeamChatMessages', parent, target);
  assert(oldPage.nextCursor); const originalIds = (await page(parent, target)).map(item => item.id).sort();
  await check('current-single-child-grant-excludes-pre-admission-history-across-pages', async () => {
    assert.equal(originalIds.length, 53); assert(!originalIds.includes(fixture.earlyMessageId));
    assert(originalIds.includes(originalReply.messageId));
  });
  const secondChild = 'sgm-qa-chat-second-child';
  await db.collection('children').doc(secondChild).create({ displayName: 'Deuxième enfant QA', guardianUserIds: [parent.uid] });
  await db.collection('memberships').doc(`${secondChild}_${clubId}`).create({ userId: secondChild, clubId,
    status: 'active', updatedAt: Timestamp.now() });
  await guardian(secondChild, 'request', 0, parent); await guardian(secondChild, 'verify', 1);
  const second = await enrollment(parent, manager, teamId, secondChild); await second.approve();
  await check('second-approved-child-preserves-earlier-current-grant-but-invalidates-old-cursor', async () => {
    assert.deepEqual((await page(parent, target)).map(item => item.id).sort(), originalIds);
    await denied('getTeamChatMessages', parent, { ...target, cursor: oldPage.nextCursor }, 'PERMISSION_DENIED');
  });
  const afterSecond = await send(driver, 'Message après les deux accords QA');
  await guardian(childId, 'revoke', 2);
  await check('revoking-one-child-keeps-other-grant-with-its-own-history-boundary', async () => {
    assert.deepEqual((await page(parent, target)).map(item => item.id), [afterSecond.messageId]);
    assert.deepEqual(await teams(parent, clubId), [teamId]);
    await denied('sendTeamChatMessage', parent, originalRequest, 'PERMISSION_DENIED');
    assert.equal((await page(otherParent, target)).length, 54);
  });
  await call('transitionTeamEnrollment', manager, { enrollmentId: second.view.id, action: 'revoke',
    expectedRevision: 2, requestId: randomUUID() });
  await check('removing-last-current-grant-denies-read-send-replay-and-discovery', async () => {
    for (const [method, input] of [['getTeamChatMessages', target], ['getTeamChatMessages', { ...target, cursor: oldPage.nextCursor }],
      ['sendTeamChatMessage', originalRequest]]) await denied(method, parent, input, 'PERMISSION_DENIED');
    assert.deepEqual(await teams(parent, clubId), []);
    assert.equal((await page(otherParent, target)).length, 54);
    assert.equal((await page(driver, target)).length, 55);
  });
  const renewed = await enrollment(parent, manager, teamId, secondChild); await renewed.approve();
  const afterRenewal = await send(parent, 'Message après nouvelle inscription QA');
  await check('reapproved-second-child-starts-new-history-without-recovering-old-retry', async () => {
    assert.deepEqual((await page(parent, target)).map(item => item.id), [afterRenewal.messageId]);
    await denied('sendTeamChatMessage', parent, originalRequest, 'PERMISSION_DENIED');
  });
  await guardian(childId, 'request', 3, parent); await guardian(childId, 'verify', 4);
  await check('renewing-first-child-keeps-still-current-second-child-history', async () => {
    assert.deepEqual((await page(parent, target)).map(item => item.id), [afterRenewal.messageId]);
  });
  await guardian(secondChild, 'revoke', 2);
  const finalMessage = await send(parent, 'Message avec le premier enfant réautorisé QA');
  await check('revoking-second-child-retains-only-current-first-child-history', async () => {
    assert.deepEqual((await page(parent, target)).map(item => item.id), [finalMessage.messageId]);
    assert.deepEqual(await teams(parent, clubId), [teamId]);
  });
  const driverPage = await call('getTeamChatMessages', driver, target); assert(driverPage.nextCursor);
  const otherTeamId = 'zy-sgm-qa-other-chat-team';
  await db.collection('teams').doc(otherTeamId).create({ clubId, name: 'Autre équipe QA', status: 'active' });
  const otherMember = await enrollment(driver, manager, otherTeamId); await otherMember.approve();
  const otherTarget = { teamId: otherTeamId, expectedTeamInstanceId: otherMember.view.teamInstanceId };
  await send(driver, 'Message privé autre équipe QA', otherTarget);
  await check('same-club-parent-cannot-discover-read-or-send-to-another-team', async () => {
    assert.deepEqual(await teams(parent, clubId), [teamId]);
    await denied('getTeamChatMessages', parent, otherTarget, 'PERMISSION_DENIED');
    await denied('sendTeamChatMessage', parent, { ...otherTarget, body: 'Interdit QA', clientMessageId: randomUUID() }, 'PERMISSION_DENIED');
    await denied('getTeamChatMessages', parent, { ...otherTarget, expectedTeamInstanceId: target.expectedTeamInstanceId }, 'PERMISSION_DENIED');
    await denied('getTeamChatMessages', driver, { ...otherTarget, cursor: driverPage.nextCursor }, 'PERMISSION_DENIED');
  });
  const pending = await enrollment(parent, manager, otherTeamId, childId);
  await check('pending-child-team-request-does-not-open-another-conversation', async () => {
    await denied('getTeamChatMessages', parent, otherTarget, 'PERMISSION_DENIED');
    assert.deepEqual(await teams(parent, clubId), [teamId]);
  });
  await pending.approve();
  await check('separate-team-approval-uses-separate-history-and-keeps-original-messages', async () => {
    assert.deepEqual(await page(parent, otherTarget), []);
    assert.deepEqual(await teams(parent, clubId), [otherTeamId, teamId].sort());
    const incoming = await send(driver, 'Message après accord autre équipe QA', otherTarget);
    assert.deepEqual((await page(parent, otherTarget)).map(item => item.id), [incoming.messageId]);
    assert.deepEqual((await page(parent, target)).map(item => item.id), [finalMessage.messageId]);
  });
  observed.teams = [];
  for (const scope of [target, otherTarget]) {
    const root = db.collection('teamConversations').doc(scope.expectedTeamInstanceId);
    const entries = await root.collection('entries').orderBy('sequence').get();
    const operations = await db.collection('teamMessageOperations').where('teamInstanceId', '==', scope.expectedTeamInstanceId).get();
    assert.deepEqual(entries.docs.map(row => row.get('sequence')), Array.from({ length: entries.size }, (_, i) => i + 1));
    assert.equal(new Set(entries.docs.map(row => row.get('clientMessageId'))).size, entries.size);
    assert.deepEqual(entries.docs.map(row => row.id).sort(), operations.docs.map(row => row.id).sort());
    assert.equal((await root.get()).get('lastSequence'), entries.size);
    observed.teams.push({ teamId: scope.teamId, committedMessages: entries.size, operations: operations.size });
  }
  await check('both-team-ledgers-contain-exactly-once-ordered-message-operations', async () => {
    assert.deepEqual(observed.teams.map(row => row.committedMessages), [57, 2]);
  });
} catch (error) { failure = error; }
finally {
  try { if (fixture) isolation = await verifyTeamChatProtectedBaseline(fixture); }
  catch (error) { failure ??= error; }
  await deleteApp(getApp());
  const paths = ['scripts/qa/local-team-access-changes.mjs', 'scripts/qa/run-local-team-access-changes.mjs',
    'scripts/qa/team-conversation-ui-fixture.mjs', 'functions/src/services/teamConversationAuthority.ts',
    'functions/src/services/teamConversation.ts', 'functions/src/services/teamConversationOptions.ts',
    'functions/src/services/teamEnrollmentAuthority.ts', 'functions/src/services/teamEnrollment.ts',
    'functions/src/services/guardianVerification.ts', 'functions/src/domain/teamConversation.ts'];
  writeFileSync(process.env.SGM_LOCAL_FLOW_OUTPUT, JSON.stringify({ projectId: 'demo-sgm-local-qa', runId: process.env.SGM_LOCAL_RUN_ID,
    testedAt: new Date().toISOString(), scope: 'local-team-chat-multiple-grants-and-cross-team-services-not-native-ui',
    completed: !failure, steps, observed, isolation, adminClientClosed: true, nativeUiExecuted: false, physicalDevice: false,
    notificationsVerified: false, productionWrites: false, providerRequests: 0,
    ...(failure ? { failureCode: /^[A-Z_]+$/.test(failure.code) ? failure.code : 'ASSERTION_FAILED' } : {}),
    sourceFiles: Object.fromEntries(paths.map(file => [file, sha(readFileSync(resolve(import.meta.dirname, '../..', file)))]))
  }, null, 2) + '\n', { flag: 'wx' });
}
if (failure) throw failure;
console.log(`Passed ${steps.length} isolated team access-change service scenarios; no native or phone claim.`);
