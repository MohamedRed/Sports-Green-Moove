import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { auth, db, call, signIn } from './local-flow-client.mjs';

export const teamChatFixtureIds = { clubId: 'sgm-qa-chat-club', teamId: 'zz-sgm-qa-chat-team', childId: 'sgm-qa-chat-child' };
export async function prepareTeamChatUiFixture() {
  const parent = await signIn('p@example.test'), driver = await signIn('d@example.test'), manager = await signIn('c@example.test');
  for (const actor of [parent, driver, manager]) await call('initializeUserProfile', actor);
  const baseline = new Map();
  for (const collection of await db.listCollections()) for (const row of (await collection.get()).docs) baseline.set(row.ref.path, row.data());
  const claims = await Promise.all([parent, driver, manager].map(async actor => (await auth.getUser(actor.uid)).customClaims));
  const { clubId, teamId, childId } = teamChatFixtureIds;
  const club = db.collection('clubs').doc(clubId); await club.create({ name: 'Club conversations QA', status: 'private', memberCount: 5 });
  const stamp = (await club.get()).createTime;
  const otherParent = await createParent('sgm-qa-chat-other-parent', 'chat-other-parent@example.test');
  const unrelated = await createParent('sgm-qa-chat-unrelated', 'chat-unrelated@example.test');
  for (const actor of [parent, driver, manager, otherParent, unrelated]) await db.collection('memberships').doc(`${actor.uid}_${clubId}`).create({
    userId: actor.uid, clubId, role: actor.uid === manager.uid ? 'clubManager' : 'member', status: 'active', active: true, updatedAt: stamp });
  for (let index = 0; index < 6; index++) await db.collection('teams').doc(`a${index}-sgm-qa-no-chat`).create({
    clubId, name: `Équipe sans inscription QA ${index}`, status: 'active' });
  await db.collection('teams').doc(teamId).create({ clubId, name: 'Équipe conversations QA', status: 'active' });
  await db.collection('children').doc(childId).create({ displayName: 'Enfant conversation QA', guardianUserIds: [parent.uid, otherParent.uid] });
  await db.collection('memberships').doc(`${childId}_${clubId}`).create({ userId: childId, clubId, status: 'active', updatedAt: stamp });
  const enrollment = async (actor, childId) => {
    const view = await call('getTeamEnrollmentView', actor, { teamId, ...(childId ? { childId } : {}) });
    const requested = await call('requestTeamEnrollment', actor, { teamId, ...(childId ? { childId } : {}),
      expectedTeamInstanceId: view.teamInstanceId, expectedEnrollmentId: view.id, expectedRevision: view.revision, requestId: randomUUID() });
    await call('transitionTeamEnrollment', manager, { enrollmentId: view.id, action: 'approve', expectedRevision: requested.revision, requestId: randomUUID() });
    return view;
  };
  const member = await enrollment(driver), target = { teamId, expectedTeamInstanceId: member.teamInstanceId };
  const early = await call('sendTeamChatMessage', driver, { ...target, body: 'Message avant arrivée QA', clientMessageId: randomUUID() });
  for (const actor of [parent, otherParent]) {
    const reference = { clubId, childId, parentUserId: actor.uid };
    await call('transitionGuardianVerification', actor, { ...reference, action: 'request', expectedRevision: 0, requestId: randomUUID() });
    await call('transitionGuardianVerification', manager, { ...reference, action: 'verify', expectedRevision: 1, requestId: randomUUID() });
  }
  await enrollment(parent, childId);
  const shared = await call('sendTeamChatMessage', driver, { ...target, body: 'Bonjour équipe QA', clientMessageId: randomUUID() });
  return { ...teamChatFixtureIds, target, parent, driver, manager, otherParent, unrelated,
    baseline, claims, earlyMessageId: early.messageId, initialMessageId: shared.messageId };
}
async function createParent(uid, email) {
  await auth.createUser({ uid, email, password: process.env.SGM_QA_PASSWORD });
  await auth.setCustomUserClaims(uid, { roleKeys: ['parent'] });
  const actor = await signIn(email); await call('initializeUserProfile', actor, { displayName: 'Parent conversation QA' }); return actor;
}
export async function verifyTeamChatProtectedBaseline(fixture) {
  for (const [path, original] of fixture.baseline) {
    const current = (await db.doc(path).get()).data();
    if ([`users/${fixture.parent.uid}`, `users/${fixture.driver.uid}`].includes(path)) {
      const { updatedAt: before, ...oldFields } = original;
      const { updatedAt: after, ...newFields } = current;
      assert(after.toMillis() >= before.toMillis()); assert.deepEqual(newFields, oldFields, path);
    } else assert.deepEqual(current, original, path);
  }
  assert.deepEqual(await Promise.all([fixture.parent, fixture.driver, fixture.manager].map(async actor =>
    (await auth.getUser(actor.uid)).customClaims)), fixture.claims);
  return { protectedBaselinePreserved: true, originalClaimsUnchanged: true,
    expectedProfileTimestampUpdatesOnly: true, protectedRecordCount: fixture.baseline.size };
}
