import assert from 'node:assert/strict';
import { db } from './local-flow-client.mjs';

export async function seedResponsiveMembershipFixture() {
  const userId = 'sgm-qa-applicant-responsive';
  const clubId = 'sgm-qa-club-green-wavre';
  const ref = db.collection('memberships').doc(`${userId}_${clubId}`);
  assert(!(await ref.get()).exists, 'Responsive fixture must be new');
  await db.collection('users').doc(userId).set({ displayName: 'Robin QA' });
  await ref.set({ userId, clubId, role: 'member', status: 'requested', active: false, createdAt: new Date() });
}
