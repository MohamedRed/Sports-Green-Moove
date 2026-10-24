import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { auth, call, db, denied, document, signIn } from './local-flow-client.mjs';
import { configureLocalEmulators } from './local-emulator-config.mjs';
import { fetchLocalQa } from './local-http-request.mjs';

execFileSync(process.execPath, [resolve(import.meta.dirname, 'seed-firebase-emulator.mjs')],
  { env: process.env, stdio: ['ignore', 'pipe', 'pipe'], timeout: 90_000 });
const config = configureLocalEmulators();
const parent = await signIn('p@example.test'), manager = await signIn('c@example.test');
async function actor(uid, roles) {
  const email = `${uid}@example.test`;
  await auth.createUser({ uid, email, password: process.env.SGM_QA_PASSWORD });
  await auth.setCustomUserClaims(uid, { roleKeys: roles });
  return signIn(email);
}
const foreign = await actor('guardian-foreign-manager', ['clubManager']);
const unscoped = await actor('guardian-unscoped-manager', ['clubManager']);
const admin = await actor('guardian-admin', ['admin']);
const clubId = 'sgm-qa-club-green-wavre', childId = 'sgm-qa-child-lina';
const childRef = db.collection('children').doc(childId), childBefore = await document('children', childId);
const membership = (uid, club = clubId) => db.collection('memberships').doc(`${uid}_${club}`);
await membership(parent.uid).set({ userId: parent.uid, clubId, status: 'active', role: 'member', active: true });
await membership(manager.uid).set({ userId: manager.uid, clubId, status: 'active', role: 'clubManager', active: true });
await membership(foreign.uid, 'other-club').set({ userId: foreign.uid, clubId: 'other-club', status: 'active', role: 'clubManager' });
const protectedState = async () => {
  const values = {};
  for (const collection of ['children', 'clubs', 'teams', 'memberships', 'notifications', 'bookings', 'rideSessions', 'trips'])
    values[collection] = (await db.collection(collection).orderBy('__name__').get()).docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  return values;
};
const protectedBefore = await protectedState();
const base = { clubId, childId, parentUserId: parent.uid };
const input = (action, expectedRevision, extra = {}) => ({ ...base, action, expectedRevision, requestId: randomUUID(), ...extra });
const transition = (actor, data) => call('transitionGuardianVerification', actor, data);
const checks = [];
const check = async (id, action) => { await action(); checks.push({ id, status: 'passed' }); };
const eventCount = async () => (await db.collection('guardianVerificationEvents').get()).size;
const originalRequest = input('request', 0);
let current, verificationId;
const read = () => document('guardianVerifications', verificationId);
const currentInput = async (action) => input(action, (await read()).revision);
const freshVerified = async () => {
  await transition(parent, await currentInput('request'));
  return transition(manager, await currentInput('verify'));
};

await check('declared-parent-request-is-not-verified', async () => {
  current = await transition(parent, originalRequest); verificationId = current.verificationId;
  assert.equal(current.status, 'requested'); assert.equal(current.revision, 1);
  assert.deepEqual(Object.keys(current).sort(), ['replayed', 'revision', 'status', 'verificationId']);
  assert.equal((await read()).lastActorUserId, parent.uid); assert.equal(await eventCount(), 1);
});
await check('signed-out-denied', () => denied('transitionGuardianVerification', null, input('verify', 1), 'UNAUTHENTICATED'));
await check('extra-verification-field-denied', () => denied('transitionGuardianVerification', parent,
  { ...input('request', 0), verified: true }, 'INVALID_ARGUMENT'));
await check('another-parent-cannot-act-for-owner', () => denied('transitionGuardianVerification', manager, input('withdraw', 1), 'PERMISSION_DENIED'));
await check('parent-manager-cannot-self-verify', () => denied('transitionGuardianVerification', manager,
  input('verify', 1, { parentUserId: manager.uid }), 'PERMISSION_DENIED'));
await check('foreign-manager-denied', () => denied('transitionGuardianVerification', foreign, input('verify', 1), 'PERMISSION_DENIED'));
await check('admin-alone-denied', () => denied('transitionGuardianVerification', admin, input('verify', 1), 'PERMISSION_DENIED'));
await check('manager-role-without-current-membership-denied', () => denied('transitionGuardianVerification', unscoped, input('verify', 1), 'PERMISSION_DENIED'));
await check('lost-reply-replay-does-not-create-another-event', async () => {
  const before = await read();
  assert.deepEqual(await transition(parent, originalRequest), { ...current, replayed: true });
  assert.deepEqual(await read(), before); assert.equal(await eventCount(), 1);
});
await check('operation-identity-cannot-change-meaning', () => denied('transitionGuardianVerification', parent,
  { ...originalRequest, action: 'withdraw', expectedRevision: 1 }, 'ALREADY_EXISTS'));
await check('stale-decision-denied-without-mutation', async () => {
  const before = await read();
  await denied('transitionGuardianVerification', manager, input('verify', 0), 'FAILED_PRECONDITION');
  assert.deepEqual(await read(), before); assert.equal(await eventCount(), 1);
});
await check('concurrent-manager-decisions-have-one-winner', async () => {
  const before = await eventCount();
  const results = await Promise.allSettled([transition(manager, input('verify', 1)), transition(manager, input('refuse', 1))]);
  assert.equal(results.filter((item) => item.status === 'fulfilled').length, 1);
  assert.equal(results.find((item) => item.status === 'rejected').reason.code, 'FAILED_PRECONDITION');
  assert.equal(await eventCount(), before + 1); assert.equal((await read()).revision, 2);
  if ((await read()).status === 'refused') await freshVerified();
});
let verifiedOperation;
await check('inactive-manager-cannot-revoke-with-stale-role-claim', async () => {
  await membership(manager.uid).update({ status: 'revoked' });
  const before = await read();
  await denied('transitionGuardianVerification', manager, await currentInput('revoke'), 'PERMISSION_DENIED');
  assert.deepEqual(await read(), before);
  await membership(manager.uid).update({ status: 'active' });
});
await check('parent-can-withdraw-after-leaving-club', async () => {
  await membership(parent.uid).update({ status: 'inactive' });
  assert.equal((await transition(parent, await currentInput('withdraw'))).status, 'withdrawn');
  await denied('transitionGuardianVerification', parent, await currentInput('request'), 'PERMISSION_DENIED');
  await membership(parent.uid).update({ status: 'active' });
});
await check('revocation-needs-a-new-parent-request-before-verification', async () => {
  await transition(parent, await currentInput('request'));
  verifiedOperation = await currentInput('verify');
  await transition(manager, verifiedOperation);
  await transition(manager, await currentInput('revoke'));
  const before = await read();
  await denied('transitionGuardianVerification', manager, await currentInput('verify'), 'FAILED_PRECONDITION');
  assert.deepEqual(await read(), before);
});
await check('old-success-replay-returns-current-revoked-state-with-no-new-write', async () => {
  const before = await read(), count = await eventCount();
  const replay = await transition(manager, verifiedOperation);
  assert.equal(replay.status, 'revoked'); assert.equal(replay.replayed, true);
  assert.equal(replay.revision, before.revision); assert.deepEqual(await read(), before); assert.equal(await eventCount(), count);
});
await check('removed-child-link-cannot-be-verified', async () => {
  await transition(parent, await currentInput('request'));
  await childRef.update({ guardianUserIds: [] });
  const before = await read();
  await denied('transitionGuardianVerification', manager, await currentInput('verify'), 'PERMISSION_DENIED');
  assert.deepEqual(await read(), before); await childRef.set(childBefore);
  await transition(manager, await currentInput('verify'));
});
await check('archived-club-denies-grants-but-still-permits-revocation', async () => {
  const club = db.collection('clubs').doc(clubId), before = await club.get();
  await club.update({ status: 'archived' });
  await transition(manager, await currentInput('revoke'));
  await denied('transitionGuardianVerification', parent, await currentInput('request'), 'PERMISSION_DENIED');
  await club.set(before.data());
});
await check('corrupt-stored-record-fails-closed', async () => {
  const ref = db.collection('guardianVerifications').doc(verificationId), before = await read();
  await ref.update({ revision: 'invalid' });
  await denied('transitionGuardianVerification', parent, input('request', before.revision), 'FAILED_PRECONDITION');
  assert.equal((await read()).revision, 'invalid'); await ref.set(before);
});
await check('private-direct-access-and-immutable-audit-boundaries', async () => {
  const root = `http://${process.env.FIRESTORE_EMULATOR_HOST}/v1/projects/${config.projectId}/databases/(default)/documents`;
  const request = (path, actor, method = 'GET', body) => fetchLocalQa(`${root}/${path}`, {
    method, headers: { 'content-type': 'application/json', ...(actor ? { authorization: `Bearer ${actor.token}` } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const path = `guardianVerifications/${verificationId}`;
  for (const actor of [parent, manager]) assert.equal((await request(path, actor)).status, 200);
  for (const actor of [null, foreign, unscoped, admin]) assert.equal((await request(path, actor)).status, 403);
  for (const actor of [parent, manager, admin]) {
    assert.equal((await request(path, actor, 'PATCH', { fields: { status: { stringValue: 'verified' } } })).status, 403);
    assert.equal((await request(path, actor, 'DELETE')).status, 403);
    assert.equal((await request('guardianVerifications/forged-new-record', actor, 'PATCH', {
      fields: { parentUserId: { stringValue: actor.uid }, clubId: { stringValue: clubId }, status: { stringValue: 'verified' } },
    })).status, 403);
  }
  const event = (await db.collection('guardianVerificationEvents').get()).docs[0];
  assert.equal((await request(`guardianVerificationEvents/${event.id}`, parent, 'PATCH', { fields: {} })).status, 403);
  const query = (actor, field, value) => fetchLocalQa(`${root}:runQuery`, {
    method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${actor.token}` },
    body: JSON.stringify({ structuredQuery: { from: [{ collectionId: 'guardianVerifications' }],
      where: { fieldFilter: { field: { fieldPath: field }, op: 'EQUAL', value: { stringValue: value } } } } }),
  });
  assert.equal((await query(parent, 'parentUserId', parent.uid)).status, 200);
  assert.equal((await query(manager, 'clubId', clubId)).status, 200);
  assert.equal((await query(foreign, 'clubId', clubId)).status, 403);
  assert.deepEqual(await childRef.get().then((snapshot) => snapshot.data()), childBefore);
  assert.equal((await db.collection('guardianVerifications').get()).size, 1);
  assert.deepEqual(await protectedState(), protectedBefore);
});
const result = { projectId: config.projectId, runId: process.env.SGM_LOCAL_RUN_ID, testedAt: new Date().toISOString(),
  scope: 'isolated-guardian-verification-services-not-native-ui', checks, testCount: checks.length,
  steps: [{ id: 'guardian-verification-services', status: 'passed' }], providerRequests: 0,
  teamChatImplemented: false, childEmergencyImplemented: false, physicalDevice: false, productionWrites: false,
  sourceFiles: Object.fromEntries(['functions/src/domain/guardianVerification.ts', 'functions/src/services/guardianVerification.ts',
    'functions/src/callables/guardianVerification.ts', 'firestore.rules', 'scripts/qa/local-guardian-verification-suite.mjs']
    .map((path) => [path, createHash('sha256').update(readFileSync(resolve(import.meta.dirname, '../..', path))).digest('hex')])) };
mkdirSync(dirname(process.env.SGM_LOCAL_FLOW_OUTPUT), { recursive: true });
writeFileSync(process.env.SGM_LOCAL_FLOW_OUTPUT, JSON.stringify(result, null, 2) + '\n');
console.log(`Guardian verification service checks passed: ${checks.length}. No production writes or provider calls.`);
