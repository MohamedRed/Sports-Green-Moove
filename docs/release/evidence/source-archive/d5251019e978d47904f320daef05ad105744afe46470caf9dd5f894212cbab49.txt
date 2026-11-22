import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Timestamp } from 'firebase-admin/firestore';
import { deleteApp, getApp } from 'firebase-admin/app';
import { seedLocalUiFixtures } from './local-ui-fixtures.mjs';
import { auth, db, call, denied, signIn } from './local-flow-client.mjs';
import { fetchLocalQa } from './local-http-request.mjs';

const steps = [], passed = id => steps.push({ id, status: 'passed' });
const sha = value => createHash('sha256').update(value).digest('hex');
await seedLocalUiFixtures();
const parent = await signIn('p@example.test'), driver = await signIn('d@example.test'), manager = await signIn('c@example.test');
for (const actor of [parent, driver, manager]) await call('initializeUserProfile', actor);
const teamId = 'sgm-qa-team-chat-isolated', childId = 'sgm-qa-team-chat-child', clubId = 'sgm-qa-club-green-wavre';
// Seeded club members need post-creation approval times; legacy teamIds must grant no chat access.
for (const actor of [parent, driver, manager]) {
  const ref = db.collection('memberships').doc(`${actor.uid}_${clubId}`), record = await ref.get();
  await ref.update({ updatedAt: Timestamp.now(), teamIds: [...record.get('teamIds'), teamId] });
}
const baseline = new Map();
for (const collection of await db.listCollections()) for (const row of (await collection.get()).docs)
  baseline.set(row.ref.path, row.data());
const baselineClaims = await Promise.all([parent, driver, manager].map(async actor => (await auth.getUser(actor.uid)).customClaims));
const team = db.collection('teams').doc(teamId), child = db.collection('children').doc(childId);
await team.create({ clubId, name: 'Conversation equipe QA', status: 'active' });
await child.create({ displayName: 'Enfant conversation QA', guardianUserIds: [parent.uid] });
await db.collection('memberships').doc(`${childId}_${clubId}`).create({ userId: childId, clubId, status: 'active', updatedAt: Timestamp.now() });
async function enroll(actor, childId) {
  const view = await call('getTeamEnrollmentView', actor, { teamId, ...(childId ? { childId } : {}) });
  const requested = await call('requestTeamEnrollment', actor, { teamId, ...(childId ? { childId } : {}),
    expectedTeamInstanceId: view.teamInstanceId, expectedEnrollmentId: view.id, expectedRevision: view.revision, requestId: randomUUID() });
  const approved = await call('transitionTeamEnrollment', manager, { enrollmentId: view.id, action: 'approve',
    expectedRevision: requested.revision, requestId: randomUUID() });
  return { view, approved };
}
async function guardian(action, actor, expectedRevision, parentUserId = parent.uid) {
  return call('transitionGuardianVerification', actor, { childId, clubId, parentUserId,
    action, expectedRevision, requestId: randomUUID() });
}
let protectedBaselinePreserved = false;
try {
  const view = await call('getTeamEnrollmentView', driver, { teamId });
  const target = { teamId, expectedTeamInstanceId: view.teamInstanceId };
  const send = (body, clientMessageId = randomUUID()) => ({ ...target, body, clientMessageId });
  await denied('getTeamChatMessages', null, target, 'UNAUTHENTICATED');
  await denied('getTeamChatMessages', driver, target, 'PERMISSION_DENIED');
  await denied('getTeamChatMessages', manager, target, 'PERMISSION_DENIED');
  passed('active-club-member-without-team-approval-denied');
  const member = await enroll(driver);
  const early = await call('sendTeamChatMessage', driver, send('Avant arrivee parent QA'));
  await denied('getTeamChatMessages', parent, target, 'PERMISSION_DENIED');
  await guardian('request', parent, 0); await guardian('verify', manager, 1);
  const childEnrollment = await enroll(parent, childId);
  const initial = await call('getTeamChatMessages', parent, target);
  assert.deepEqual(initial.items, []); assert.equal(initial.historyPolicy, 'after-current-admission');
  passed('verified-parent-joins-approved-child-team-without-earlier-history');
  await call('sendTeamChatMessage', driver, send('Apres arrivee parent QA'));
  const incoming = await call('getTeamChatMessages', parent, target);
  assert.equal(incoming.items.length, 1); assert.equal(incoming.items[0].body, 'Apres arrivee parent QA');
  assert(!incoming.items.some(item => item.id === early.messageId));
  passed('current-parent-sees-new-team-message-only');
  const request = send('Reponse parent QA');
  const duplicate = await Promise.all([call('sendTeamChatMessage', parent, request), call('sendTeamChatMessage', parent, request)]);
  assert.equal(duplicate[0].messageId, duplicate[1].messageId);
  assert.deepEqual(duplicate.map(item => item.reused).sort(), [false, true]);
  assert.equal((await db.collection('teamConversations').doc(target.expectedTeamInstanceId).get()).get('lastSequence'), 3);
  await denied('sendTeamChatMessage', parent, { ...request, body: 'Autre contenu QA' }, 'ALREADY_EXISTS');
  passed('concurrent-retry-commits-once-and-different-content-is-rejected');
  const messageUrl = `http://127.0.0.1:8080/v1/projects/demo-sgm-local-qa/databases/(default)/documents/teamConversations/${target.expectedTeamInstanceId}/entries/${duplicate[0].messageId}`;
  const direct = await fetchLocalQa(messageUrl, { headers: { authorization: `Bearer ${parent.token}` } });
  assert.equal(direct.status, 403);
  const directWrite = await fetchLocalQa(messageUrl, { method: 'PATCH', headers: { authorization: `Bearer ${parent.token}`,
    'content-type': 'application/json' }, body: JSON.stringify({ fields: { body: { stringValue: 'Interdit QA' } } }) });
  assert.equal(directWrite.status, 403);
  passed('direct-client-document-read-cannot-bypass-admission-filter');
  const entries = db.collection('teamConversations').doc(target.expectedTeamInstanceId).collection('entries');
  const batch = db.batch(), at = Timestamp.now();
  for (let i = 0; i < 55; i++) batch.create(entries.doc(sha(`pagination-qa-${i}`)), {
    senderUserId: driver.uid, clientMessageId: randomUUID(), body: `Page QA ${i}`, sequence: 4 + i, createdAt: at,
  });
  batch.update(entries.parent, { lastSequence: 58 }); await batch.commit();
  const first = await call('getTeamChatMessages', parent, target);
  assert.equal(first.items.length, 50); assert(first.nextCursor);
  const second = await call('getTeamChatMessages', parent, { ...target, cursor: first.nextCursor });
  assert.equal(second.items.length, 7); assert.equal(second.nextCursor, null);
  assert.equal(new Set([...first.items, ...second.items].map(item => item.id)).size, 57);
  passed('equal-timestamp-pages-have-no-duplicates-or-pre-arrival-messages');
  await guardian('revoke', manager, 2);
  for (const [name, input] of [['getTeamChatMessages', target], ['getTeamChatMessages', { ...target, cursor: first.nextCursor }],
    ['sendTeamChatMessage', request]]) await denied(name, parent, input, 'PERMISSION_DENIED');
  passed('guardian-revocation-denies-read-pagination-send-and-replay');
  await guardian('request', parent, 3); await guardian('verify', manager, 4);
  assert.deepEqual((await call('getTeamChatMessages', parent, target)).items, []);
  await denied('getTeamChatMessages', parent, { ...target, cursor: first.nextCursor }, 'PERMISSION_DENIED');
  await denied('sendTeamChatMessage', parent, request, 'PERMISSION_DENIED');
  await call('sendTeamChatMessage', parent, send('Retour apres nouvel accord QA'));
  passed('new-parent-verification-starts-new-history-and-invalidates-old-cursor');
  const childMember = db.collection('memberships').doc(`${childId}_${clubId}`);
  await childMember.update({ status: 'inactive' });
  await denied('getTeamChatMessages', parent, target, 'PERMISSION_DENIED');
  await childMember.update({ status: 'active', updatedAt: Timestamp.now() });
  assert.deepEqual((await call('getTeamChatMessages', parent, target)).items, []);
  passed('child-club-rejoining-resets-parent-history');
  const profile = db.collection('users').doc(driver.uid), oldRoles = (await profile.get()).get('roles');
  await profile.update({ roles: { ...oldRoles, child: true } });
  await denied('getTeamChatMessages', driver, target, 'PERMISSION_DENIED');
  await denied('sendTeamChatMessage', driver, send('Compte enfant QA'), 'PERMISSION_DENIED');
  await profile.update({ roles: oldRoles });
  passed('current-child-profile-denied-despite-stale-adult-token');
  await auth.setCustomUserClaims(driver.uid, { ...baselineClaims[1], roleKeys: ['driver', 'parent', 'child'] });
  const mixedChild = await signIn('d@example.test');
  await denied('getTeamChatMessages', mixedChild, target, 'PERMISSION_DENIED');
  await denied('sendTeamChatMessage', mixedChild, send('Enfant avec roles mixtes QA'), 'PERMISSION_DENIED');
  await auth.setCustomUserClaims(driver.uid, baselineClaims[1]);
  passed('child-token-cannot-be-bypassed-with-mixed-adult-roles');
  const linked = db.collection('childAccountLinks').doc(driver.uid);
  await linked.create({ accountUserId: driver.uid, childId, status: 'verified' });
  await denied('getTeamChatMessages', driver, target, 'PERMISSION_DENIED');
  await linked.delete();
  passed('child-login-link-cannot-be-bypassed-with-adult-roles');
  const otherUid = 'sgm-qa-team-chat-other-parent';
  await auth.createUser({ uid: otherUid, email: 'team-parent@example.test', password: process.env.SGM_QA_PASSWORD });
  await auth.setCustomUserClaims(otherUid, { roleKeys: ['parent'] });
  const otherParent = await signIn('team-parent@example.test');
  await call('initializeUserProfile', otherParent);
  await db.collection('memberships').doc(`${otherUid}_${clubId}`).create({ userId: otherUid, clubId,
    status: 'active', updatedAt: Timestamp.now() });
  await child.update({ guardianUserIds: [parent.uid, otherUid] });
  await denied('getTeamChatMessages', otherParent, target, 'PERMISSION_DENIED');
  await guardian('request', otherParent, 0, otherUid); await guardian('verify', manager, 1, otherUid);
  assert.deepEqual((await call('getTeamChatMessages', otherParent, target)).items, []);
  await call('sendTeamChatMessage', driver, send('Message pour les deux parents QA'));
  assert.equal((await call('getTeamChatMessages', otherParent, target)).items.length, 1);
  passed('second-independently-verified-parent-is-included-with-its-own-history-boundary');
  await call('transitionTeamEnrollment', manager, { enrollmentId: childEnrollment.view.id, action: 'revoke',
    expectedRevision: childEnrollment.approved.revision, requestId: randomUUID() });
  await denied('getTeamChatMessages', parent, target, 'PERMISSION_DENIED');
  await call('transitionTeamEnrollment', manager, { enrollmentId: member.view.id, action: 'revoke',
    expectedRevision: member.approved.revision, requestId: randomUUID() });
  await denied('getTeamChatMessages', driver, target, 'PERMISSION_DENIED');
  passed('manager-team-revocation-removes-parent-and-adult-access');
  await enroll(driver);
  assert.deepEqual((await call('getTeamChatMessages', driver, target)).items, []);
  passed('adult-team-reapproval-does-not-recover-prior-history');
  const limitRecords = Array.from({ length: 200 }, (_, index) => db.collection('teamEnrollments').doc(sha(`limit-qa-${index}`)));
  const limitBatch = db.batch();
  for (const ref of limitRecords) limitBatch.create(ref, { teamInstanceId: target.expectedTeamInstanceId, status: 'approved' });
  await limitBatch.commit();
  await denied('getTeamChatMessages', driver, target, 'RESOURCE_EXHAUSTED');
  await denied('sendTeamChatMessage', driver, send('Equipe trop grande QA'), 'RESOURCE_EXHAUSTED');
  const removeLimit = db.batch(); for (const ref of limitRecords) removeLimit.delete(ref); await removeLimit.commit();
  assert.deepEqual((await call('getTeamChatMessages', driver, target)).items, []);
  passed('oversized-team-is-rejected-without-partial-audience-or-new-message');
  await enroll(parent, childId);
  await child.delete(); await child.create({ displayName: 'Nouvel enfant QA', guardianUserIds: [parent.uid, otherUid] });
  await denied('getTeamChatMessages', parent, target, 'PERMISSION_DENIED');
  await denied('getTeamChatMessages', otherParent, target, 'PERMISSION_DENIED');
  passed('recreated-child-does-not-inherit-team-parent-authorization');
  await team.delete(); await team.create({ clubId, name: 'Nouvelle equipe QA', status: 'active' });
  await denied('getTeamChatMessages', driver, target, 'PERMISSION_DENIED');
  const recreated = await call('getTeamEnrollmentView', driver, { teamId });
  assert.notEqual(recreated.teamInstanceId, target.expectedTeamInstanceId);
  await denied('getTeamChatMessages', driver, { teamId, expectedTeamInstanceId: recreated.teamInstanceId }, 'PERMISSION_DENIED');
  passed('recreated-team-cannot-inherit-old-enrollment-or-message-history');
  for (const [path, data] of baseline) assert.deepEqual((await db.doc(path).get()).data(), data, path);
  assert.deepEqual(await Promise.all([parent, driver, manager].map(async actor => (await auth.getUser(actor.uid)).customClaims)), baselineClaims);
  protectedBaselinePreserved = true;
} finally { await deleteApp(getApp()); }
const paths = ['functions/src/domain/teamConversation.ts', 'functions/src/services/teamConversationAuthority.ts',
  'functions/src/services/teamConversation.ts', 'functions/src/callables/teamConversation.ts', 'firestore.rules',
  'scripts/qa/local-team-conversation-suite.mjs', 'scripts/qa/run-local-team-conversation.mjs'];
writeFileSync(process.env.SGM_LOCAL_FLOW_OUTPUT, JSON.stringify({ projectId: 'demo-sgm-local-qa', runId: process.env.SGM_LOCAL_RUN_ID,
  testedAt: new Date().toISOString(), scope: 'local-team-conversation-services-not-native-or-phone-ui', steps,
  physicalDevice: false, nativeUiExecuted: false, productionWrites: false, providerRequests: 0,
  notificationsVerified: false, protectedBaselinePreserved, adminClientClosed: true,
  sourceFiles: Object.fromEntries(paths.map(file => [file, sha(readFileSync(resolve(import.meta.dirname, '../..', file)))]))
}, null, 2) + '\n', { flag: 'wx' });
console.log(`Passed ${steps.length} isolated team conversation service scenarios; no app-screen or notification claim.`);
