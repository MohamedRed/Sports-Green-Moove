import assert from 'node:assert/strict';
import {existsSync, readFileSync, statSync, writeFileSync} from 'node:fs';
import {isAbsolute, resolve} from 'node:path';
import {deleteApp} from 'firebase-admin/app';
import {withLocalAdminCleanup} from './local-admin-lifecycle.mjs';

const [directory, privateInput] = process.argv.slice(2); assert.equal(process.argv.length, 4);
assert([directory, privateInput].every(path => isAbsolute(path ?? ''))); assert.equal(statSync(privateInput).mode & 0o077, 0);
const path = resolve(directory, 'connection-blocked-records.json'); assert(!existsSync(path));
const before = JSON.parse(readFileSync(resolve(directory, 'observations.json')));
assert.equal(before.projectId, 'demo-sgm-local-qa'); assert.match(before.runId, /^[a-f0-9]{32}$/);
assert.deepEqual(before.observations.map(row => row.phase), ['before']);
const session = JSON.parse(readFileSync(privateInput)); assert.equal(session.projectId, before.projectId); assert.equal(session.runId, before.runId);
process.env.SGM_QA_PASSWORD = session.password;
const {auth, db} = await import('./local-flow-client.mjs');
let adminClientClosed = false, firestoreClientTerminated = false, result;
await withLocalAdminCleanup(async () => {
  const users = await auth.listUsers(1000); assert(!users.pageToken); assert.equal(users.users.length, 3);
  assert(!users.users.some(row => row.email === 'browser-child@example.test'));
  const invitations = await db.collection('childAccountInvitations').get(); assert.equal(invitations.size, 1);
  const data = invitations.docs[0].data(); assert.equal(data.status, 'pending');
  assert.equal(data.attemptCount ?? 0, 0); assert.equal(data.accountUserId, undefined);
  for (const name of ['childAccountLinks', 'childAccountApprovalOwners', 'childAccountApprovalRequests'])
    assert.equal((await db.collection(name).get()).size, 0);
  result = {projectId: before.projectId, runId: before.runId, observedAt: new Date().toISOString(),
    accountCount: 3, childAccountExists: false, invitationStatus: data.status, redemptionCount: 0,
    approvalRequestCount: 0, accountLinkCount: 0, claims: users.users.map(row => ({uid: row.uid, claims: row.customClaims ?? {}}))
      .sort((a, b) => a.uid.localeCompare(b.uid)),
    scope: 'independent-records-after-phone-connection-failure-not-ui-or-root-cause-proof',
    browserFormReached: false, signupProven: false, parentApprovalProven: false, productionWrites: false, releaseComplete: false};
}, {firestore: {terminate: async () => {await db.terminate(); firestoreClientTerminated = true;}},
  closeApp: async app => {await deleteApp(app); adminClientClosed = true;}});
writeFileSync(path, JSON.stringify({...result, adminClientClosed, firestoreClientTerminated}, null, 2) + '\n', {flag: 'wx', mode: 0o600});
delete process.env.SGM_QA_PASSWORD;
console.log('Independent negative observation retained: no child account, redemption, approval request or account link.');
