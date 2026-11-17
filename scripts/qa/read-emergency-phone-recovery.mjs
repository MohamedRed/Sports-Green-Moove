import assert from 'node:assert/strict';
import { readFileSync, statSync, writeFileSync, existsSync } from 'node:fs';
import { isAbsolute } from 'node:path';
import { verifyPhoneContactRecovery, recoveryPhases } from './emergency-phone-recovery-evidence.mjs';

const [sessionPath, revokedCheckpointPath, phase, output, beforePath] = process.argv.slice(2);
assert([sessionPath, revokedCheckpointPath, output].every(path => isAbsolute(path ?? '')));
assert(!existsSync(output), 'A fresh output path is required'); assert(recoveryPhases.includes(phase));
assert.equal(statSync(sessionPath).mode & 0o077, 0, 'Fixture credentials must remain private');
const session = JSON.parse(readFileSync(sessionPath, 'utf8'));
const revoked = JSON.parse(readFileSync(revokedCheckpointPath, 'utf8'));
assert.equal(session.projectId, 'demo-sgm-local-qa'); assert.match(session.runId, /^[a-f0-9]{32}$/);
assert.equal(revoked.projectId, session.projectId); assert.equal(revoked.runId, session.runId);
assert.equal(revoked.phase, 'child-revoked'); assert.equal(revoked.guardianStatus, 'revoked');
assert.equal(revoked.scope, 'independent-emergency-checkpoint-not-ui-or-dialer-proof');
process.env.SGM_QA_PASSWORD = session.password;
const { db, signIn, call } = await import('./local-flow-client.mjs');
const { emergencyContactId } = await import('../../functions/lib/domain/emergencyContact.js');
const { guardianVerificationId } = await import('../../functions/lib/domain/guardianVerification.js');
const childId = 'sgm-qa-emergency-child', clubId = 'sgm-qa-club-green-wavre', parentId = 'sgm-qa-parent';
const identity = { childId, childInstanceId: revoked.childInstanceId, contactIds: [
  emergencyContactId('self', parentId), emergencyContactId('child', childId, revoked.childInstanceId)] };
const rows = async name => (await db.collection(name).orderBy('__name__').get()).docs.map(row => ({ id: row.id, ...row.data() }));
let otherView;
if (phase === 'other-account-empty') {
  const actor = await signIn('d@example.test'); assert.equal(actor.uid, 'sgm-qa-driver');
  otherView = await call('getEmergencyContact', actor, { target: { kind: 'self' } });
}
const state = { contacts: await rows('emergencyContacts'), operations: await rows('emergencyContactOperations'),
  guardian: (await db.collection('guardianVerifications').doc(guardianVerificationId(clubId, childId, parentId)).get()).data() };
const before = beforePath ? JSON.parse(readFileSync(beforePath, 'utf8')) : undefined;
const result = verifyPhoneContactRecovery({ phase, state, identity, projectId: session.projectId,
  runId: session.runId, before, otherView });
writeFileSync(output, JSON.stringify(result, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
console.log(`Independent contact checkpoint passed: ${phase}. The primary dialer sequence remains incomplete.`);
