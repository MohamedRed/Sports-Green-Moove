import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { auth, db } from './local-flow-client.mjs';
import { projectId } from './local-emulator-config.mjs';

export async function seedLocalUiFixtures() {
  execFileSync(process.execPath, [resolve(import.meta.dirname, 'seed-firebase-emulator.mjs')],
    { env: process.env, stdio: ['ignore', 'pipe', 'pipe'], timeout: 90_000 });
  await auth.createUser({ uid: 'sgm-qa-admin', email: 'admin@example.test', password: process.env.SGM_QA_PASSWORD });
  await auth.setCustomUserClaims('sgm-qa-admin', { roleKeys: ['admin'] });
  await db.collection('users').doc('sgm-qa-admin').set({ displayName: 'Local QA Admin', email: 'admin@example.test', roles: { admin: true } });
  await db.collection('reports').doc('sgm-qa-support-review').set({ reporterUserId: 'sgm-qa-parent',
    subjectType: 'other', reason: 'Local QA support', description: 'Isolated local support processing test',
    status: 'open', createdAt: new Date() });
  for (const decision of ['approve', 'reject']) {
    const userId = `sgm-qa-applicant-${decision}`;
    await db.collection('memberships').doc(`${userId}_sgm-qa-club-green-wavre`).set({
      userId, clubId: 'sgm-qa-club-green-wavre', role: 'member', status: 'requested', active: false, createdAt: new Date() });
  }
  const session = { projectId, password: process.env.SGM_QA_PASSWORD,
    disposableEmulator: process.env.SGM_LOCAL_DISPOSABLE_EMULATOR === 'true',
    parent: 'p@example.test', driver: 'd@example.test', admin: 'admin@example.test' };
  writeFileSync(process.env.SGM_LOCAL_UI_SESSION_FILE, JSON.stringify(session), { mode: 0o600, flag: 'wx' });
  return session;
}
