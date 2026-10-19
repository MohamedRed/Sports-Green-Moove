import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { Timestamp } from 'firebase-admin/firestore';
import { auth, call, db, denied, signIn } from './local-flow-client.mjs';
import { guardianVerificationId } from '../../functions/lib/domain/guardianVerification.js';

execFileSync(process.execPath, [resolve(import.meta.dirname, 'seed-firebase-emulator.mjs')],
  { env: process.env, stdio: ['ignore', 'pipe', 'pipe'], timeout: 90_000 });
const parent = await signIn('p@example.test'), manager = await signIn('c@example.test');
async function actor(uid, roles) {
  const email = `${uid}@example.test`;
  await auth.createUser({ uid, email, password: process.env.SGM_QA_PASSWORD });
  await auth.setCustomUserClaims(uid, { roleKeys: roles }); return signIn(email);
}
const other = await actor('guardian-parent-other', ['parent']), admin = await actor('guardian-parent-admin', ['admin']);
const clubId = 'sgm-qa-club-green-wavre', childId = 'sgm-qa-child-lina';
const clubRef = db.collection('clubs').doc(clubId), childRef = db.collection('children').doc(childId);
const memberRef = db.collection('memberships').doc(`${parent.uid}_${clubId}`);
const view = (actor = parent, extra = {}) => call('getMyGuardianVerification', actor, { clubId, childId, ...extra });
const options = (kind, cursor) => call('listGuardianParentOptions', parent, { kind, ...(cursor ? { cursor } : {}) });
const transition = (actor, action, revision) => call('transitionGuardianVerification', actor,
  { clubId, childId, parentUserId: parent.uid, action, expectedRevision: revision, requestId: randomUUID() });
const id = guardianVerificationId(clubId, childId, parent.uid), ref = db.collection('guardianVerifications').doc(id);
const checks = [], check = async (id, action) => { await action(); checks.push({ id, status: 'passed' }); };
const protectedState = async () => {
  const result = {};
  for (const collection of ['children', 'clubs', 'memberships', 'teams', 'users', 'bookings', 'notifications'])
    result[collection] = (await db.collection(collection).orderBy('__name__').get()).docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  return result;
};
await check('signed-out-and-admin-only-accounts-cannot-read-parent-options-or-targets', async () => {
  for (const actor of [null, admin]) {
    const code = actor ? 'PERMISSION_DENIED' : 'UNAUTHENTICATED';
    await denied('getMyGuardianVerification', actor, { clubId, childId }, code);
    await denied('listGuardianParentOptions', actor, { kind: 'children' }, code);
  }
});
await check('parent-identity-cannot-be-supplied-or-overridden-in-read-inputs', async () => {
  await denied('getMyGuardianVerification', parent, { clubId, childId, parentUserId: other.uid }, 'INVALID_ARGUMENT');
  await denied('listGuardianParentOptions', parent, { kind: 'children', parentUserId: other.uid }, 'INVALID_ARGUMENT');
  await denied('listGuardianParentOptions', parent, { kind: 'unknown' }, 'INVALID_ARGUMENT');
});
await check('eligible-absent-request-is-explicit-null-at-revision-zero-without-writes', async () => {
  const before = await protectedState(); const result = await view();
  assert.equal(result.id, id); assert.equal(result.parentUserId, parent.uid);
  assert.equal(result.status, null); assert.equal(result.revision, 0); assert.deepEqual(result.allowedActions, ['request']);
  assert.equal((await ref.get()).exists, false); assert.equal((await db.collection('guardianVerificationEvents').get()).size, 0);
  assert.deepEqual(await protectedState(), before);
});
await check('another-parent-cannot-infer-a-child-or-create-a-request-for-it', async () => {
  await denied('getMyGuardianVerification', other, { clubId, childId }, 'PERMISSION_DENIED');
  assert.deepEqual((await call('listGuardianParentOptions', other, { kind: 'children' })).items, []);
  await denied('transitionGuardianVerification', other, { clubId, childId, parentUserId: parent.uid,
    action: 'request', expectedRevision: 0, requestId: randomUUID() }, 'PERMISSION_DENIED');
});
await check('request-refusal-reopen-verification-withdrawal-and-revocation-use-fresh-versions', async () => {
  for (const [actor, action, previous, status, allowed] of [
    [parent, 'request', 0, 'requested', ['withdraw']], [manager, 'refuse', 1, 'refused', ['request']],
    [parent, 'request', 2, 'requested', ['withdraw']], [manager, 'verify', 3, 'verified', ['withdraw']],
    [parent, 'withdraw', 4, 'withdrawn', ['request']], [parent, 'request', 5, 'requested', ['withdraw']],
    [manager, 'verify', 6, 'verified', ['withdraw']], [manager, 'revoke', 7, 'revoked', ['request']],
  ]) {
    const before = await view(); assert.equal(before.revision, previous);
    await transition(actor, action, before.revision);
    const current = await view(); assert.equal(current.status, status); assert.equal(current.revision, previous + 1);
    assert.deepEqual(current.allowedActions, allowed);
  }
  assert.equal((await db.collection('guardianVerificationEvents').get()).size, 8);
});
await check('removed-parent-link-hides-current-child-name-in-the-owned-history-read', async () => {
  const before = (await childRef.get()).data();
  await childRef.update({ guardianUserIds: [], displayName: 'Private unrelated current identity QA' });
  const result = await view(); assert.equal(result.childName, null); assert.deepEqual(result.allowedActions, []);
  assert(!JSON.stringify(result).includes('Private unrelated current identity QA')); await childRef.set(before);
});
await check('leaving-or-archiving-the-club-prevents-grants-but-not-removing-existing-verification', async () => {
  await transition(parent, 'request', 8); await transition(manager, 'verify', 9);
  const previous = (await clubRef.get()).data();
  await clubRef.update({ status: 'archived' }); await memberRef.update({ active: false });
  assert.deepEqual((await view()).allowedActions, ['withdraw']); await transition(parent, 'withdraw', 10);
  assert.deepEqual((await view()).allowedActions, []);
  await denied('getMyGuardianVerification', parent, { clubId, childId: 'absent-child' }, 'PERMISSION_DENIED');
  await clubRef.set(previous); await memberRef.update({ active: true });
});
let childCursor, clubCursor;
await check('children-and-active-clubs-are-paged-without-silent-first-page-limits', async () => {
  for (let index = 0; index < 25; index++) {
    const suffix = String(index).padStart(2, '0'), child = `sgm-qa-parent-child-${suffix}`, club = `sgm-qa-parent-club-${suffix}`;
    await db.collection('children').doc(child).set({ displayName: `Enfant pagination QA ${index}`, guardianUserIds: [parent.uid] });
    await db.collection('clubs').doc(club).set({ name: `Club pagination QA ${index}`, status: 'public' });
    await db.collection('memberships').doc(`${parent.uid}_${club}`).set({ userId: parent.uid, clubId: club, role: 'member', status: 'active' });
  }
  for (const kind of ['children', 'clubs']) {
    let cursor; const seen = new Set(); let pages = 0;
    do {
      const result = await options(kind, cursor); assert(result.items.length <= 20);
      for (const item of result.items) { assert(!seen.has(item.id)); seen.add(item.id); }
      if (!pages++) { if (kind === 'children') childCursor = result.nextCursor; else clubCursor = result.nextCursor; }
      cursor = result.nextCursor;
    } while (cursor);
    assert.equal(seen.size, 26); assert.equal(pages, 2);
  }
});
await check('option-cursors-cannot-cross-list-kind-or-parent-account', async () => {
  await denied('listGuardianParentOptions', parent, { kind: 'clubs', cursor: childCursor }, 'PERMISSION_DENIED');
  await denied('listGuardianParentOptions', other, { kind: 'clubs', cursor: clubCursor }, 'PERMISSION_DENIED');
  await denied('listGuardianParentOptions', parent, { kind: 'children', cursor: '!invalid' }, 'INVALID_ARGUMENT');
});
await check('a-record-beyond-first-history-page-is-never-returned-as-a-new-request', async () => {
  for (let index = 0; index < 25; index++) {
    const child = `sgm-qa-parent-child-${String(index).padStart(2, '0')}`;
    await db.collection('guardianVerifications').doc(guardianVerificationId(clubId, child, parent.uid)).set({
      clubId, childId: child, parentUserId: parent.uid, status: 'revoked', revision: 7,
      lastActorUserId: manager.uid, createdAt: Timestamp.now(), updatedAt: Timestamp.now(),
    });
  }
  const all = await db.collection('guardianVerifications').orderBy('__name__').get();
  const last = all.docs.filter((doc) => doc.get('childId').startsWith('sgm-qa-parent-child-')).at(-1);
  const first = await call('listMyGuardianVerifications', parent); assert(first.nextCursor);
  assert(!first.items.some((item) => item.id === last.id));
  const result = await view(parent, { childId: last.get('childId') }); assert.equal(result.id, last.id);
  assert.equal(result.status, 'revoked'); assert.equal(result.revision, 7);
});
await check('inactive-and-forged-memberships-do-not-offer-request-clubs', async () => {
  const inactive = 'sgm-qa-parent-club-00', forged = 'sgm-qa-forged-private';
  await db.collection('memberships').doc(`${parent.uid}_${inactive}`).update({ active: false });
  await db.collection('memberships').doc('000-forged-membership').set({ userId: parent.uid, clubId: forged, status: 'active' });
  const seen = []; let cursor;
  do { const result = await options('clubs', cursor); seen.push(...result.items.map((item) => item.id)); cursor = result.nextCursor; } while (cursor);
  assert(!seen.includes(inactive)); assert(!seen.includes(forged));
});
await check('malformed-stored-verification-fails-closed-in-targeted-reads', async () => {
  const before = (await ref.get()).data(); await ref.update({ revision: 'broken' });
  await denied('getMyGuardianVerification', parent, { clubId, childId }, 'FAILED_PRECONDITION'); await ref.set(before);
});
await check('option-and-point-reads-do-not-mutate-any-fixture-or-audit-record', async () => {
  const before = await protectedState(), count = (await db.collection('guardianVerificationEvents').get()).size;
  await options('children'); await options('clubs'); await view();
  assert.deepEqual(await protectedState(), before); assert.equal((await db.collection('guardianVerificationEvents').get()).size, count);
  assert.equal(count, 11); assert.deepEqual((await auth.getUser(parent.uid)).customClaims.roleKeys, ['parent']);
});
const sources = ['functions/src/services/guardianParent.ts', 'functions/src/callables/guardianParent.ts',
  'scripts/qa/local-guardian-parent-suite.mjs'];
const result = { projectId: 'demo-sgm-local-qa', runId: process.env.SGM_LOCAL_RUN_ID, testedAt: new Date().toISOString(),
  scope: 'local-emulated-services-not-phone-ui', checks, testCount: checks.length,
  steps: [{ id: 'guardian-parent-services', status: 'passed' }], providerRequests: 0, productionWrites: false, physicalDevice: false,
  nativeUiExecuted: false, teamChatImplemented: false, childEmergencyImplemented: false,
  sourceFiles: Object.fromEntries(sources.map((path) => [path, createHash('sha256').update(readFileSync(resolve(import.meta.dirname, '../..', path))).digest('hex')])) };
mkdirSync(dirname(process.env.SGM_LOCAL_FLOW_OUTPUT), { recursive: true });
writeFileSync(process.env.SGM_LOCAL_FLOW_OUTPUT, JSON.stringify(result, null, 2) + '\n');
console.log(`Guardian parent HTTP groups passed: ${checks.length}. No provider calls or production writes.`);
