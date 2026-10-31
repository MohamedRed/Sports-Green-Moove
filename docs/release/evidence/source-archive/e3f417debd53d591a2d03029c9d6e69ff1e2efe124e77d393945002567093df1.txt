import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { auth, call, db, signIn } from './local-flow-client.mjs';
import { guardianOperationId, guardianVerificationId } from '../../functions/lib/domain/guardianVerification.js';
import { teamContext } from '../../functions/lib/services/teamEnrollmentAuthority.js';
import { teamEnrollmentId } from '../../functions/lib/domain/teamEnrollment.js';

export const teamUi = { clubId: 'sgm-qa-team-ui-club', teamId: 'sgm-qa-team-ui-team', childId: 'sgm-qa-team-ui-child',
  parentId: 'sgm-qa-parent', managerId: 'sgm-qa-club-manager' };
const verificationId = guardianVerificationId(teamUi.clubId, teamUi.childId, teamUi.parentId);
const protectedCollections = ['users', 'children', 'clubs', 'memberships', 'teams', 'bookings', 'notifications',
  'guardianVerifications', 'guardianVerificationEvents', 'teamEnrollments', 'teamEnrollmentEvents'];
const rows = async (name) => (await db.collection(name).orderBy('__name__').get()).docs.map((doc) => ({ id: doc.id, ...doc.data() }));
async function protectedState() {
  const state = {};
  for (const name of protectedCollections) state[name] = await rows(name);
  state.roles = await Promise.all([teamUi.parentId, teamUi.managerId, 'sgm-qa-driver'].map(async (uid) =>
    ({ uid, claims: (await auth.getUser(uid)).customClaims })));
  return state;
}
function assertProtectedState(actual, expected, excluded = []) {
  const loginIds = [teamUi.parentId, 'sgm-qa-driver'];
  const stableProfiles = (profiles) => profiles.map((row) => {
    if (!loginIds.includes(row.id)) return row;
    const { updatedAt, ...fields } = row; return fields;
  });
  for (const key of Object.keys(expected).filter((key) => !excluded.includes(key)))
    assert.deepEqual(key === 'users' ? stableProfiles(actual[key]) : actual[key],
      key === 'users' ? stableProfiles(expected[key]) : expected[key], key);
  for (const uid of loginIds) {
    const previous = expected.users.find((row) => row.id === uid)?.updatedAt?.toMillis();
    const current = actual.users.find((row) => row.id === uid)?.updatedAt?.toMillis();
    assert(Number.isFinite(previous) && Number.isFinite(current) && current >= previous, 'Only monotonic QA sign-in timestamps may change');
  }
}
function baseRefs() {
  return [['clubs', teamUi.clubId], ['teams', teamUi.teamId], ['children', teamUi.childId],
    ...[teamUi.parentId, teamUi.managerId, teamUi.childId].map((uid) => ['memberships', `${uid}_${teamUi.clubId}`])]
    .map(([collection, id]) => db.collection(collection).doc(id));
}
export async function seedTeamNativeFixture() {
  const before = await protectedState();
  for (const ref of [...baseRefs(), db.collection('guardianVerifications').doc(verificationId)]) assert(!(await ref.get()).exists, ref.path);
  assert.equal((await db.collection('teamEnrollmentEvents').where('teamId', '==', teamUi.teamId).get()).size, 0);
  const fixture = { before, verificationId, created: false };
  const batch = db.batch();
  batch.create(db.collection('clubs').doc(teamUi.clubId), { name: 'Club inscriptions QA', status: 'public', memberCount: 3 });
  batch.create(db.collection('teams').doc(teamUi.teamId), { clubId: teamUi.clubId, name: 'Equipe inscriptions QA', status: 'active' });
  batch.create(db.collection('children').doc(teamUi.childId), { displayName: 'Enfant inscriptions QA', guardianUserIds: [teamUi.parentId] });
  for (const [uid, role] of [[teamUi.parentId, 'member'], [teamUi.managerId, 'clubManager'], [teamUi.childId, 'child']])
    batch.create(db.collection('memberships').doc(`${uid}_${teamUi.clubId}`), { userId: uid, clubId: teamUi.clubId, role, status: 'active', active: true });
  await batch.commit(); fixture.created = true;
  try {
    const parent = await signIn('p@example.test'), manager = await signIn('c@example.test');
    const input = { clubId: teamUi.clubId, childId: teamUi.childId, parentUserId: teamUi.parentId };
    await call('transitionGuardianVerification', parent, { ...input, action: 'request', expectedRevision: 0, requestId: randomUUID() });
    await call('transitionGuardianVerification', manager, { ...input, action: 'verify', expectedRevision: 1, requestId: randomUUID() });
    const team = teamContext(await db.collection('teams').doc(teamUi.teamId).get());
    fixture.teamInstanceId = team.teamInstanceId;
    fixture.selfEnrollmentId = teamEnrollmentId(team.teamInstanceId, 'member', teamUi.parentId, null);
    fixture.childEnrollmentId = teamEnrollmentId(team.teamInstanceId, 'child', teamUi.childId,
      (await db.collection('children').doc(teamUi.childId).get()).createTime);
    fixture.seeded = await protectedState(); return fixture;
  } catch (failure) {
    try { await cleanupTeamNativeFixture(fixture); }
    catch (cleanup) { throw new AggregateError([failure, cleanup], 'Team fixture preparation and cleanup failed'); }
    throw failure;
  }
}
export async function verifyTeamNativeFixture(fixture, marker) {
  assert.equal(marker.selfEnrollmentId, fixture.selfEnrollmentId); assert.equal(marker.childEnrollmentId, fixture.childEnrollmentId);
  const expected = [[fixture.selfEnrollmentId, teamUi.parentId, 'member', 'withdrawn', 5, ['request', 'refuse', 'request', 'approve', 'withdraw']],
    [fixture.childEnrollmentId, teamUi.childId, 'child', 'revoked', 3, ['request', 'approve', 'revoke']]];
  for (const [id, subjectId, kind, status, revision, actions] of expected) {
    const record = await db.collection('teamEnrollments').doc(id).get();
    assert.equal(record.get('teamInstanceId'), fixture.teamInstanceId); assert.equal(record.get('requesterUserId'), teamUi.parentId);
    assert.equal(record.get('teamId'), teamUi.teamId); assert.equal(record.get('clubId'), teamUi.clubId);
    assert.equal(record.get('subjectId'), subjectId); assert.equal(record.get('subjectKind'), kind);
    assert.equal(record.get('status'), status); assert.equal(record.get('revision'), revision);
    assert.equal(record.get('lastActorUserId'), kind === 'member' ? teamUi.parentId : teamUi.managerId);
    const events = (await db.collection('teamEnrollmentEvents').where('enrollmentId', '==', id).get()).docs
      .sort((a, b) => a.get('revision') - b.get('revision'));
    assert.equal(events.length, actions.length);
    for (const [index, event] of events.entries()) {
      assert.equal(event.get('action'), actions[index]); assert.equal(event.get('revision'), index + 1);
      assert.equal(event.get('actorUserId'), ['request', 'withdraw'].includes(actions[index]) ? teamUi.parentId : teamUi.managerId);
    }
  }
  const verification = await db.collection('guardianVerifications').doc(verificationId).get();
  assert.equal(verification.get('status'), 'revoked'); assert.equal(verification.get('revision'), 3);
  const event = await db.collection('guardianVerificationEvents').doc(guardianOperationId(teamUi.managerId, marker.guardianRevokeRequestId)).get();
  assert.equal(event.get('verificationId'), verificationId); assert.equal(event.get('action'), 'revoke');
  const guardianEvents = (await db.collection('guardianVerificationEvents').where('verificationId', '==', verificationId).get()).docs
    .sort((a, b) => a.get('revision') - b.get('revision'));
  assert.equal(guardianEvents.length, 3);
  for (const [index, row] of guardianEvents.entries()) {
    assert.equal(row.get('action'), ['request', 'verify', 'revoke'][index]); assert.equal(row.get('revision'), index + 1);
    assert.equal(row.get('actorUserId'), index === 0 ? teamUi.parentId : teamUi.managerId);
  }
  const after = await protectedState();
  assertProtectedState(after, fixture.seeded, ['guardianVerifications', 'guardianVerificationEvents', 'teamEnrollments', 'teamEnrollmentEvents']);
  for (const name of ['teamEnrollments', 'teamEnrollmentEvents'])
    assert.deepEqual(after[name].filter((row) => row.teamId !== teamUi.teamId), fixture.before[name], name);
  assert.deepEqual(after.guardianVerifications.filter((row) => row.id !== verificationId), fixture.before.guardianVerifications);
  assert.deepEqual(after.guardianVerificationEvents.filter((row) => row.verificationId !== verificationId), fixture.before.guardianVerificationEvents);
}
export async function cleanupTeamNativeFixture(fixture) {
  assert(fixture.created, 'Only an explicitly created isolated fixture may be cleaned up');
  const batch = db.batch(); for (const ref of baseRefs()) batch.delete(ref);
  batch.delete(db.collection('guardianVerifications').doc(verificationId));
  for (const [name, field, value] of [['guardianVerificationEvents', 'verificationId', verificationId],
    ['teamEnrollments', 'teamId', teamUi.teamId], ['teamEnrollmentEvents', 'teamId', teamUi.teamId]]) {
    for (const doc of (await db.collection(name).where(field, '==', value).get()).docs) {
      assert.equal(doc.get('clubId'), teamUi.clubId);
      if (name !== 'guardianVerificationEvents') assert.equal(doc.get('teamInstanceId'), fixture.teamInstanceId);
      batch.delete(doc.ref);
    }
  }
  await batch.commit(); assertProtectedState(await protectedState(), fixture.before);
}
