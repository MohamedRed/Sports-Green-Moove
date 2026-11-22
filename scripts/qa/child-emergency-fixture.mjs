import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { Timestamp } from 'firebase-admin/firestore';
import { auth, call, db, signIn } from './local-flow-client.mjs';
import { guardianVerificationId } from '../../functions/lib/domain/guardianVerification.js';
import { emergencyChildInstanceId, emergencyContactId } from '../../functions/lib/domain/emergencyContact.js';

export const childContact = { name: 'Contact enfant fictif QA', phone: '+12025550121' };
export async function childEmergencyActors() {
  for (const [uid, email] of [['sgm-qa-child-account-lina', 'child@example.test'], ['sgm-qa-child-other', 'other-child@example.test']]) {
    assert(!(await db.collection('users').doc(uid).get()).exists);
    await auth.createUser({ uid, email, password: process.env.SGM_QA_PASSWORD });
    await auth.setCustomUserClaims(uid, { roleKeys: ['child'] });
    await db.collection('users').doc(uid).create({ displayName: 'Compte enfant fictif QA', roles: { child: true } });
  }
  const actors = { parent: await signIn('p@example.test'), manager: await signIn('c@example.test'), driver: await signIn('d@example.test'),
    child: await signIn('child@example.test'), other: await signIn('other-child@example.test') };
  await seedChildAccountLink(actors.child.uid, 'sgm-qa-child-lina', actors.manager.uid);
  return actors;
}
export async function seedChildAccountLink(accountUserId, childId, verifiedByUserId) {
  const child = await db.collection('children').doc(childId).get(); assert(child.exists && child.createTime);
  await db.collection('childAccountLinks').doc(accountUserId).set({ accountUserId, childId,
    childInstanceId: emergencyChildInstanceId(childId, child.createTime), status: 'verified', verifiedAt: Timestamp.now(), verifiedByUserId });
}
export async function verifyChildContactParent(actors, childId, clubId) {
  const ref = db.collection('guardianVerifications').doc(guardianVerificationId(clubId, childId, actors.parent.uid));
  const transition = async (actor, action) => call('transitionGuardianVerification', actor, { clubId, childId,
    parentUserId: actors.parent.uid, action, expectedRevision: (await ref.get()).get('revision') ?? 0, requestId: randomUUID() });
  if ((await ref.get()).get('status') === 'verified') await transition(actors.manager, 'revoke');
  if ((await ref.get()).get('status') !== 'requested') await transition(actors.parent, 'request');
  await transition(actors.manager, 'verify');
}
export async function saveChildChosenContact(parent, childId, clubId, contact = childContact) {
  const target = { kind: 'child', childId, clubId }, view = await call('getEmergencyContact', parent, { target });
  await call('saveEmergencyContact', parent, { target, contact, expectedRevision: view.revision,
    expectedChildInstanceId: view.childInstanceId, requestId: randomUUID() });
  return { ...await call('getEmergencyContact', parent, { target }),
    contactId: emergencyContactId('child', childId, view.childInstanceId) };
}
export async function withChildFixturePatch(ref, patch, action) {
  const original = await ref.get(); assert(original.exists);
  try { await ref.update(patch); await action(); }
  finally { await ref.set(original.data()); }
}
