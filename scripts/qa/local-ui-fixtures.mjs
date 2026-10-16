import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { auth, db, signIn, call, tripInput } from './local-flow-client.mjs';
import { projectId } from './local-emulator-config.mjs';
import { seedLocalChatFixtures } from './local-chat-fixtures.mjs';
import { indexLocalChatFixtures } from './index-local-chat-fixtures.mjs';
import { seedResponsiveMembershipFixture } from './local-membership-ui-fixtures.mjs';

export async function seedLocalUiFixtures() {
  execFileSync(process.execPath, [resolve(import.meta.dirname, 'seed-firebase-emulator.mjs')],
    { env: process.env, stdio: ['ignore', 'pipe', 'pipe'], timeout: 90_000 });
  await auth.createUser({ uid: 'sgm-qa-admin', email: 'admin@example.test', password: process.env.SGM_QA_PASSWORD });
  await auth.setCustomUserClaims('sgm-qa-admin', { roleKeys: ['admin'] });
  await db.collection('users').doc('sgm-qa-admin').set({ displayName: 'Local QA Admin', email: 'admin@example.test', roles: { admin: true } });
  await db.collection('reports').doc('sgm-qa-support-review').set({ reporterUserId: 'sgm-qa-parent',
    subjectType: 'other', reason: 'Local QA support', description: 'Isolated local support processing test',
    status: 'open', createdAt: new Date() });
  for (const decision of ['approve', 'reject', 'admin']) {
    const userId = `sgm-qa-applicant-${decision}`;
    await db.collection('users').doc(userId).set({ displayName: { approve: 'Camille QA', reject: 'Alex QA', admin: 'Jordan QA' }[decision] });
    await db.collection('memberships').doc(`${userId}_sgm-qa-club-green-wavre`).set({
      userId, clubId: 'sgm-qa-club-green-wavre', role: 'member', status: 'requested', active: false, createdAt: new Date() });
  }
  await seedLocalChatFixtures(process.env.SGM_QA_PASSWORD);
  await seedResponsiveMembershipFixture();
  await indexLocalChatFixtures();
  const multiSeatTrip = await call('createTrip', await signIn('d@example.test'), {
    ...tripInput(), title: 'Trajet QA deux places', seatsTotal: 4, seatsAvailable: 4,
  });
  const session = { projectId, runId: process.env.SGM_LOCAL_RUN_ID, password: process.env.SGM_QA_PASSWORD,
    multiSeatTripId: multiSeatTrip.tripId,
    disposableEmulator: process.env.SGM_LOCAL_DISPOSABLE_EMULATOR === 'true',
    parent: 'p@example.test', driver: 'd@example.test', manager: 'c@example.test', admin: 'admin@example.test', outsider: 'outsider@example.test' };
  writeFileSync(process.env.SGM_LOCAL_UI_SESSION_FILE, JSON.stringify(session), { mode: 0o600, flag: 'wx' });
  return session;
}
