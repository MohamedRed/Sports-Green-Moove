import { randomUUID } from 'node:crypto';
import { Timestamp } from 'firebase-admin/firestore';
import { db, call } from './local-flow-client.mjs';
import { prepareTeamChatUiFixture } from './team-conversation-ui-fixture.mjs';

export async function prepareTeamChatAccessUiFixture() {
  const f = await prepareTeamChatUiFixture(), secondChildId = 'sgm-qa-chat-second-child', otherTeamId = 'zy-sgm-qa-other-chat-team';
  await db.collection('children').doc(secondChildId).create({ displayName: 'Deuxième enfant QA', guardianUserIds: [f.parent.uid] });
  await db.collection('memberships').doc(`${secondChildId}_${f.clubId}`).create({ userId: secondChildId, clubId: f.clubId,
    status: 'active', updatedAt: Timestamp.now() });
  const reference = { clubId: f.clubId, childId: secondChildId, parentUserId: f.parent.uid };
  await call('transitionGuardianVerification', f.parent, { ...reference, action: 'request', expectedRevision: 0, requestId: randomUUID() });
  await call('transitionGuardianVerification', f.manager, { ...reference, action: 'verify', expectedRevision: 1, requestId: randomUUID() });
  async function request(actor, teamId, childId) {
    const view = await call('getTeamEnrollmentView', actor, { teamId, ...(childId ? { childId } : {}) });
    const pending = await call('requestTeamEnrollment', actor, { teamId, ...(childId ? { childId } : {}),
      expectedTeamInstanceId: view.teamInstanceId, expectedEnrollmentId: view.id, expectedRevision: view.revision, requestId: randomUUID() });
    return { view, pending };
  }
  const second = await request(f.parent, f.teamId, secondChildId);
  await db.collection('teams').doc(otherTeamId).create({ clubId: f.clubId, name: 'Autre équipe QA', status: 'active' });
  const driver = await request(f.driver, otherTeamId);
  await call('transitionTeamEnrollment', f.manager, { enrollmentId: driver.view.id, action: 'approve',
    expectedRevision: driver.pending.revision, requestId: randomUUID() });
  const otherTarget = { teamId: otherTeamId, expectedTeamInstanceId: driver.view.teamInstanceId };
  const early = await call('sendTeamChatMessage', f.driver, { ...otherTarget,
    body: 'Autre équipe avant accord QA', clientMessageId: randomUUID() });
  const other = await request(f.parent, otherTeamId, f.childId);
  return { ...f, secondChildId, otherTeamId, otherTarget, secondEnrollmentId: second.view.id,
    otherEnrollmentId: other.view.id, otherEarlyMessageId: early.messageId };
}
