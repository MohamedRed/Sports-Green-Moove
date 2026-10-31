import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { Timestamp } from 'firebase-admin/firestore';
import { auth, call, db, signIn } from './local-flow-client.mjs';
import { seedTeamNativeFixture, teamUi, verifyTeamNativeFixture, cleanupTeamNativeFixture } from './local-team-native-fixture.mjs';

const collections = ['users', 'children', 'clubs', 'memberships', 'teams', 'bookings', 'notifications',
  'guardianVerifications', 'guardianVerificationEvents', 'teamEnrollments', 'teamEnrollmentEvents'];
export async function teamReviewSnapshot() {
  const state = {};
  for (const name of collections) state[name] = (await db.collection(name).orderBy('__name__').get()).docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  state.roles = (await auth.listUsers()).users.map((user) => ({ uid: user.uid, claims: user.customClaims })).sort((a, b) => a.uid.localeCompare(b.uid));
  return state;
}
export async function prepareTeamReviewFixture() {
  const before = await teamReviewSnapshot(), created = { teams: [], users: [], memberships: [], core: null };
  const fixture = { before, created, parent: await signIn('p@example.test'), manager: await signIn('c@example.test'), extraEnrollments: [] };
  fixture.request = async (actor, childId) => {
    const target = { teamId: teamUi.teamId, ...(childId ? { childId } : {}) };
    const view = await call('getTeamEnrollmentView', actor, target);
    return call('requestTeamEnrollment', actor, { ...target, expectedTeamInstanceId: view.teamInstanceId,
      expectedEnrollmentId: view.id, expectedRevision: view.revision, requestId: randomUUID() });
  };
  try {
    for (let index = 0; index < 24; index++) {
      const ref = db.collection('teams').doc(`sgm-qa-team-ui-choice-${String(index).padStart(2, '0')}`);
      await ref.create({ clubId: teamUi.clubId, name: `Équipe QA ${index}`, status: index === 23 ? 'archived' : 'active', privateNote: 'not-for-review' });
      created.teams.push(ref);
    }
    for (let index = 0; index < 23; index++) {
      const uid = `sgm-qa-team-review-parent-${String(index).padStart(2, '0')}`, email = `${uid}@example.test`;
      await auth.createUser({ uid, email, password: process.env.SGM_QA_PASSWORD }); created.users.push(uid);
      await auth.setCustomUserClaims(uid, { roleKeys: ['parent'] });
      await db.collection('users').doc(uid).create({ displayName: `Membre équipe QA ${index}`, updatedAt: Timestamp.now() });
    }
    created.core = await seedTeamNativeFixture();
    for (const uid of created.users) {
      const ref = db.collection('memberships').doc(`${uid}_${teamUi.clubId}`);
      await ref.create({ userId: uid, clubId: teamUi.clubId, role: 'member', status: 'active', active: true }); created.memberships.push(ref);
      const actor = await signIn(`${uid}@example.test`), result = await fixture.request(actor);
      fixture.extraEnrollments.push({ id: result.enrollmentId, actorUserId: uid });
    }
    await db.collection('clubs').doc(teamUi.clubId).update({ memberCount: 26 });
    const self = await fixture.request(fixture.parent), child = await fixture.request(fixture.parent, teamUi.childId);
    assert.equal(self.enrollmentId, created.core.selfEnrollmentId); assert.equal(child.enrollmentId, created.core.childEnrollmentId);
    return fixture;
  } catch (failure) {
    try { await cleanupTeamReviewFixture(fixture); }
    catch (cleanup) { throw new AggregateError([failure, cleanup], 'Team review fixture preparation and cleanup failed'); }
    throw failure;
  }
}
export async function verifyTeamReviewFixture(fixture) {
  assert.match(fixture.guardianRevokeRequestId, /^[a-f0-9-]{36}$/);
  for (const extra of fixture.extraEnrollments) {
    const record = await db.collection('teamEnrollments').doc(extra.id).get();
    assert.equal(record.get('requesterUserId'), extra.actorUserId); assert.equal(record.get('teamId'), teamUi.teamId);
    assert.equal(record.get('revision'), 1); assert.equal(record.get('status'), 'requested');
    const events = (await db.collection('teamEnrollmentEvents').where('enrollmentId', '==', extra.id).get()).docs;
    assert.equal(events.length, 1); assert.equal(events[0].get('action'), 'request');
    assert.equal(events[0].get('actorUserId'), extra.actorUserId);
  }
  assert.equal((await db.collection('teamEnrollments').where('teamId', '==', teamUi.teamId).get()).size, 25);
  assert.equal((await db.collection('teamEnrollmentEvents').where('teamId', '==', teamUi.teamId).get()).size, 31);
  const batch = db.batch(); for (const ref of fixture.created.memberships) batch.delete(ref);
  batch.update(db.collection('clubs').doc(teamUi.clubId), { memberCount: 3 }); await batch.commit();
  await verifyTeamNativeFixture(fixture.created.core, { selfEnrollmentId: fixture.created.core.selfEnrollmentId,
    childEnrollmentId: fixture.created.core.childEnrollmentId, guardianRevokeRequestId: fixture.guardianRevokeRequestId });
}
export async function cleanupTeamReviewFixture(fixture) {
  const batch = db.batch(); for (const ref of fixture.created.memberships) batch.delete(ref);
  if (fixture.created.core) batch.update(db.collection('clubs').doc(teamUi.clubId), { memberCount: 3 });
  await batch.commit();
  if (fixture.created.core) await cleanupTeamNativeFixture(fixture.created.core);
  const extra = db.batch(); for (const ref of fixture.created.teams) extra.delete(ref);
  for (const uid of fixture.created.users) {
    assert.match(uid, /^sgm-qa-team-review-parent-\d{2}$/); extra.delete(db.collection('users').doc(uid));
  }
  await extra.commit(); for (const uid of fixture.created.users) await auth.deleteUser(uid);
  assert.deepEqual(await teamReviewSnapshot(), fixture.before);
}
