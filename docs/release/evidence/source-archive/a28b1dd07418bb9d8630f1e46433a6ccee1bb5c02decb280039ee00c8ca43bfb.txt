import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { Timestamp } from 'firebase-admin/firestore';
import { auth, call, db, signIn } from './local-flow-client.mjs';
import { guardianVerificationId } from '../../functions/lib/domain/guardianVerification.js';

export const clubId = 'sgm-qa-club-green-wavre', childId = 'sgm-qa-child-lina';
export async function prepareTeamEnrollmentFixtures() {
  execFileSync(process.execPath, [resolve(import.meta.dirname, 'seed-firebase-emulator.mjs')],
    { env: process.env, stdio: ['ignore', 'pipe', 'pipe'], timeout: 90_000 });
  const create = async (uid, roles) => {
    const email = `${uid}@example.test`;
    await auth.createUser({ uid, email, password: process.env.SGM_QA_PASSWORD });
    await auth.setCustomUserClaims(uid, { roleKeys: roles });
    await db.collection('users').doc(uid).set({ displayName: `${uid} QA`, roles: Object.fromEntries(roles.map((role) => [role, true])) });
    return signIn(email);
  };
  const actors = { parent: await signIn('p@example.test'), driver: await signIn('d@example.test'), manager: await signIn('c@example.test'),
    other: await create('enroll-other-parent', ['parent']), admin: await create('enroll-admin', ['admin']),
    child: await create('enroll-child-account', ['child', 'parent', 'clubManager']),
    peerManager: await create('enroll-peer-manager', ['clubManager', 'parent']),
    foreign: await create('enroll-foreign-manager', ['clubManager', 'parent']),
    unscoped: await create('enroll-unscoped-manager', ['clubManager', 'parent']) };
  await db.collection('clubs').doc('enroll-foreign-club').create({ name: 'Autre club QA', status: 'public' });
  await db.collection('memberships').doc(`${actors.foreign.uid}_enroll-foreign-club`).create({ userId: actors.foreign.uid,
    clubId: 'enroll-foreign-club', role: 'clubManager', status: 'active', active: true });
  await db.collection('memberships').doc(`${actors.other.uid}_${clubId}`).create({ userId: actors.other.uid, clubId, role: 'member', status: 'active', active: true });
  await db.collection('memberships').doc(`${actors.peerManager.uid}_${clubId}`).create({ userId: actors.peerManager.uid, clubId,
    role: 'clubManager', status: 'active', active: true });
  await db.collection('memberships').doc(`${actors.child.uid}_${clubId}`).create({ userId: actors.child.uid, clubId,
    role: 'clubManager', status: 'active', active: true });
  const roles = await Promise.all(Object.values(actors).map(async ({ uid }) => ({ uid, claims: (await auth.getUser(uid)).customClaims })));
  return { actors, roles };
}
export async function freshTeam(name) {
  const id = `enroll-qa-${name}`;
  await db.collection('teams').doc(id).create({ clubId, name: `Equipe QA ${name}`, status: 'active', createdAt: Timestamp.now() });
  return id;
}
export const viewEnrollment = (actor, teamId, id) => call('getTeamEnrollmentView', actor, { teamId, ...(id === undefined ? {} : { childId: id }) });
export async function enrollmentRequest(actor, teamId, id) {
  const before = await viewEnrollment(actor, teamId, id);
  return { teamId, ...(id === undefined ? {} : { childId: id }), expectedTeamInstanceId: before.teamInstanceId,
    expectedEnrollmentId: before.id, expectedRevision: before.revision, requestId: randomUUID() };
}
export const submitEnrollment = (actor, input) => call('requestTeamEnrollment', actor, input);
export const decideEnrollment = (actor, row, action, requestId = randomUUID()) => call('transitionTeamEnrollment', actor,
  { enrollmentId: row.enrollmentId ?? row.id, action, expectedRevision: row.revision, requestId });
export async function verifyEnrollmentParent(parent, manager) {
  const id = guardianVerificationId(clubId, childId, parent.uid), ref = db.collection('guardianVerifications').doc(id);
  let current = await ref.get();
  const transition = async (actor, action) => {
    const result = await call('transitionGuardianVerification', actor, { clubId, childId, parentUserId: parent.uid,
      action, expectedRevision: current.get('revision') ?? 0, requestId: randomUUID() });
    current = await ref.get(); return result;
  };
  if (current.get('status') === 'verified') await transition(parent, 'withdraw');
  if (current.get('status') !== 'requested') await transition(parent, 'request');
  await transition(manager, 'verify');
  assert.equal(current.get('status'), 'verified'); return current;
}
