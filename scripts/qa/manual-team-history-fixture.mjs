import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { call, db, signIn } from './local-flow-client.mjs';
import { seedTeamNativeFixture, cleanupTeamNativeFixture, teamUi } from './local-team-native-fixture.mjs';
import { teamContext } from '../../functions/lib/services/teamEnrollmentAuthority.js';

export async function seedHistoryPhoneFixture() {
  const base = await seedTeamNativeFixture(), extras = [];
  const fixture = { base, extras };
  try {
    const parent = await signIn('p@example.test'), manager = await signIn('c@example.test');
    async function request(teamId, childId) {
      const view = await call('getTeamEnrollmentView', parent, { teamId, ...(childId ? { childId } : {}) });
      return call('requestTeamEnrollment', parent, { teamId, ...(childId ? { childId } : {}),
        expectedTeamInstanceId: view.teamInstanceId, expectedEnrollmentId: view.id,
        expectedRevision: view.revision, requestId: randomUUID() });
    }
    for (const childId of [undefined, teamUi.childId]) {
      const row = await request(teamUi.teamId, childId);
      await call('transitionTeamEnrollment', manager, { enrollmentId: row.enrollmentId,
        expectedRevision: row.revision, action: 'approve', requestId: randomUUID() });
    }
    for (let index = 1; index <= 24; index++) {
      const teamId = `sgm-qa-history-phone-${String(index).padStart(2, '0')}`;
      const ref = db.collection('teams').doc(teamId);
      assert(!(await ref.get()).exists, 'History fixture must not replace an existing team');
      await ref.create({ clubId: teamUi.clubId, name: `Equipe historique ${index} QA`, status: 'active' });
      const context = teamContext(await ref.get()); extras.push({ teamId, teamInstanceId: context.teamInstanceId });
      await request(teamId);
    }
    await call('transitionGuardianVerification', manager, { clubId: teamUi.clubId,
      childId: teamUi.childId, parentUserId: teamUi.parentId, action: 'revoke',
      expectedRevision: 2, requestId: randomUUID() });
    await db.collection('memberships').doc(`${teamUi.parentId}_${teamUi.clubId}`).update({ active: false, status: 'inactive' });
    fixture.identity = { ...teamUi, teamInstanceId: base.teamInstanceId,
      selfEnrollmentId: base.selfEnrollmentId, childEnrollmentId: base.childEnrollmentId };
    return fixture;
  } catch (failure) {
    try { await cleanupHistoryPhoneFixture(fixture); }
    catch (cleanup) { throw new AggregateError([failure, cleanup], 'History preparation and cleanup failed'); }
    throw failure;
  }
}

export async function historyPhoneState(fixture) {
  const rows = async (name, field, value) => (await db.collection(name).where(field, '==', value).get()).docs
    .map((doc) => ({ id: doc.id, ...doc.data() }));
  const parent = await signIn('p@example.test');
  const first = await call('listOwnedTeamEnrollments', parent, {});
  const second = await call('listOwnedTeamEnrollments', parent, { cursor: first.nextCursor });
  return { enrollments: await rows('teamEnrollments', 'clubId', teamUi.clubId),
    events: await rows('teamEnrollmentEvents', 'clubId', teamUi.clubId),
    guardian: (await db.collection('guardianVerifications').doc(fixture.base.verificationId).get()).data(),
    membership: (await db.collection('memberships').doc(`${teamUi.parentId}_${teamUi.clubId}`).get()).data(),
    first, second,
    self: await call('getOwnedTeamEnrollmentView', parent, { enrollmentId: fixture.base.selfEnrollmentId }),
    child: await call('getOwnedTeamEnrollmentView', parent, { enrollmentId: fixture.base.childEnrollmentId }) };
}

export async function cleanupHistoryPhoneFixture(fixture) {
  for (const { teamId, teamInstanceId } of fixture.extras) {
    const ref = db.collection('teams').doc(teamId), current = await ref.get();
    assert.equal(teamContext(current).teamInstanceId, teamInstanceId, 'Do not delete a replaced team');
    const batch = db.batch(); batch.delete(ref);
    for (const name of ['teamEnrollments', 'teamEnrollmentEvents'])
      for (const doc of (await db.collection(name).where('teamId', '==', teamId).get()).docs) {
        assert.equal(doc.get('clubId'), teamUi.clubId); assert.equal(doc.get('teamInstanceId'), teamInstanceId);
        if (name === 'teamEnrollments') assert.equal(doc.get('requesterUserId'), teamUi.parentId);
        else assert.equal(doc.get('actorUserId'), teamUi.parentId);
        batch.delete(doc.ref);
      }
    await batch.commit();
  }
  await cleanupTeamNativeFixture(fixture.base);
}
