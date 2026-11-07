import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { auth, db, call, signIn } from './local-flow-client.mjs';
import { verifyChildContactParent } from './child-emergency-fixture.mjs';

export async function seedChildAccountPhoneFixture() {
  execFileSync(process.execPath, [resolve(import.meta.dirname, 'seed-firebase-emulator.mjs')],
    { env: process.env, stdio: ['ignore', 'pipe', 'pipe'], timeout: 90_000 });
  const childUid = 'sgm-qa-child-link-phone', childEmail = 'child-link@example.test';
  assert(!(await db.collection('users').doc(childUid).get()).exists);
  await auth.createUser({ uid: childUid, email: childEmail, displayName: 'Compte enfant fictif QA', password: process.env.SGM_QA_PASSWORD });
  await auth.setCustomUserClaims(childUid, { roleKeys: ['child'] });
  await db.collection('users').doc(childUid).create({ displayName: 'Compte enfant fictif QA', roles: { child: true } });
  const actors = { parent: await signIn('p@example.test'), child: await signIn(childEmail), manager: await signIn('c@example.test') };
  for (const actor of [actors.parent, actors.child]) await call('initializeUserProfile', actor);
  const childId = 'sgm-qa-child-lina', clubId = 'sgm-qa-club-green-wavre';
  await verifyChildContactParent(actors, childId, clubId);
  const view = await call('getEmergencyContact', actors.parent, { target: { kind: 'child', childId, clubId } });
  for (const name of ['childAccountLinks', 'childAccountApprovalOwners', 'childAccountApprovalRequests'])
    assert.equal((await db.collection(name).get()).size, 0, 'The phone must create and approve its own code');
  return { parentUid: actors.parent.uid, childUid, childId, clubId, childInstanceId: view.childInstanceId,
    childName: view.childName, parentEmail: 'p@example.test', childEmail };
}
