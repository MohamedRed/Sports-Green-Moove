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
  await auth.setCustomUserClaims(uid, { roleKeys: roles });
  return signIn(email);
}
const other = await actor('guardian-review-other', ['parent']);
const foreign = await actor('guardian-review-foreign', ['clubManager']);
const admin = await actor('guardian-review-admin', ['admin']);
await auth.setCustomUserClaims(manager.uid, { roleKeys: ['clubManager', 'parent', 'admin'] });
const dual = await signIn('c@example.test');
const clubId = 'sgm-qa-club-green-wavre', foreignClub = 'sgm-qa-guardian-foreign-club';
const membership = (uid, club = clubId) => db.collection('memberships').doc(`${uid}_${club}`);
await membership(manager.uid).set({ userId: manager.uid, clubId, role: 'clubManager', status: 'active' });
await membership(parent.uid).set({ userId: parent.uid, clubId, role: 'member', status: 'active' });
await db.collection('clubs').doc(foreignClub).set({ name: 'Club voisin QA', status: 'public' });
await membership(foreign.uid, foreignClub).set({ userId: foreign.uid, clubId: foreignClub, role: 'clubManager', status: 'active' });
await db.collection('users').doc(parent.uid).update({ displayName: 'Parent QA', email: 'not-for-review@example.test' });
const fixtures = [];
for (let index = 0; index < 25; index++) {
  const childId = `sgm-qa-review-child-${String(index).padStart(2, '0')}`;
  await db.collection('children').doc(childId).set({ displayName: `Enfant QA ${index}`, guardianUserIds: [parent.uid], privateNote: 'not-for-review' });
  const id = guardianVerificationId(clubId, childId, parent.uid);
  const record = { clubId, childId, parentUserId: parent.uid, status: 'requested', revision: 1,
    lastActorUserId: parent.uid, createdAt: Timestamp.now(), updatedAt: Timestamp.now() };
  await db.collection('guardianVerifications').doc(id).set(record);
  fixtures.push({ id, ...record });
}
const alienId = guardianVerificationId(foreignClub, 'alien-child', other.uid);
await db.collection('guardianVerifications').doc(alienId).set({ ...fixtures[0], clubId: foreignClub,
  childId: 'alien-child', parentUserId: other.uid });
const list = (actor, cursor) => call('listClubGuardianVerifications', actor, { clubId, ...(cursor ? { cursor } : {}) });
const checks = [];
const check = async (id, action) => { await action(); checks.push({ id, status: 'passed' }); };
let first, own;
await check('signed-out-cannot-list-private-verifications', async () => {
  for (const name of ['listGuardianReviewClubs', 'listMyGuardianVerifications', 'listClubGuardianVerifications'])
    await denied(name, null, name === 'listClubGuardianVerifications' ? { clubId } : {}, 'UNAUTHENTICATED');
});
await check('review-requires-manager-claim-and-current-exact-club-membership', async () => {
  for (const account of [parent, other, admin, foreign]) await denied('listClubGuardianVerifications', account, { clubId }, 'PERMISSION_DENIED');
  await denied('listGuardianReviewClubs', parent, {}, 'PERMISSION_DENIED');
  await denied('listGuardianReviewClubs', admin, {}, 'PERMISSION_DENIED');
  await denied('listMyGuardianVerifications', foreign, {}, 'PERMISSION_DENIED');
});
await check('combined-admin-role-does-not-expand-managed-clubs', async () => {
  assert.deepEqual((await call('listGuardianReviewClubs', dual)).items.map((item) => item.id), [clubId]);
  await denied('listClubGuardianVerifications', dual, { clubId: foreignClub }, 'PERMISSION_DENIED');
});
await check('review-page-is-bounded-private-and-currently-actionable', async () => {
  first = await list(manager);
  assert.equal(first.items.length, 20); assert(first.nextCursor);
  for (const item of first.items) {
    assert.equal(item.clubId, clubId); assert.equal(item.parentUserId, parent.uid);
    assert.equal(item.parentName, 'Parent QA'); assert.match(item.childName, /^Enfant QA/);
    assert.deepEqual(item.allowedActions, ['verify', 'refuse']); assert.equal(item.revision, 1);
    assert.deepEqual(Object.keys(item).sort(), ['allowedActions', 'childId', 'childName', 'clubId', 'clubName', 'id', 'parentName', 'parentUserId', 'revision', 'status']);
  }
  assert(!JSON.stringify(first).includes('not-for-review'));
});
await check('pagination-preserves-every-scoped-request-once', async () => {
  const second = await list(manager, first.nextCursor);
  assert.equal(second.items.length, 5); assert.equal(second.nextCursor, null);
  assert.deepEqual(new Set([...first.items, ...second.items].map((item) => item.id)), new Set(fixtures.map((item) => item.id)));
});
await check('parents-see-only-their-own-requests-and-withdraw-capability', async () => {
  own = await call('listMyGuardianVerifications', parent);
  assert.equal(own.items.length, 20); assert(own.items.every((item) => item.parentUserId === parent.uid));
  assert(own.items.every((item) => JSON.stringify(item.allowedActions) === '["withdraw"]'));
  assert.deepEqual((await call('listMyGuardianVerifications', other)).items.map((item) => item.id), [alienId]);
  await denied('listMyGuardianVerifications', parent, { parentUserId: other.uid }, 'INVALID_ARGUMENT');
});
await check('cursors-cannot-cross-account-club-or-list-boundaries', async () => {
  await denied('listMyGuardianVerifications', other, { cursor: own.nextCursor }, 'PERMISSION_DENIED');
  await denied('listMyGuardianVerifications', parent, { cursor: first.nextCursor }, 'PERMISSION_DENIED');
  assert.equal((await list(dual, first.nextCursor)).items.length, 5);
  await membership(foreign.uid).set({ userId: foreign.uid, clubId, role: 'clubManager', status: 'active' });
  await denied('listClubGuardianVerifications', foreign, { clubId, cursor: first.nextCursor }, 'PERMISSION_DENIED');
  await membership(foreign.uid).delete();
  await denied('listClubGuardianVerifications', foreign, { clubId: foreignClub, cursor: first.nextCursor }, 'PERMISSION_DENIED');
  await denied('listGuardianReviewClubs', manager, { cursor: first.nextCursor }, 'PERMISSION_DENIED');
  await denied('listClubGuardianVerifications', manager, { clubId, cursor: '!invalid' }, 'INVALID_ARGUMENT');
  await denied('listClubGuardianVerifications', manager, { clubId, extra: true }, 'INVALID_ARGUMENT');
});
await check('manager-revocation-blocks-a-previously-valid-next-page', async () => {
  await membership(manager.uid).update({ active: false });
  await denied('listClubGuardianVerifications', manager, { clubId, cursor: first.nextCursor }, 'PERMISSION_DENIED');
  assert.equal((await call('listGuardianReviewClubs', dual)).items.length, 0);
  await membership(manager.uid).update({ active: true });
});
const target = first.items[0], ref = db.collection('guardianVerifications').doc(target.id);
const child = db.collection('children').doc(target.childId);
await check('removed-child-declaration-removes-verify-not-refusal', async () => {
  await child.update({ guardianUserIds: [] });
  assert.deepEqual((await list(manager)).items[0].allowedActions, ['refuse']);
  await child.update({ guardianUserIds: [parent.uid] });
});
await check('historical-request-does-not-grant-current-child-profile-access', async () => {
  const previous = (await child.get()).data();
  await child.update({ guardianUserIds: [], displayName: 'Unrelated private current name QA' });
  const review = await list(manager), history = await call('listMyGuardianVerifications', parent);
  assert.equal(review.items[0].childName, null); assert.equal(history.items[0].childName, null);
  assert(!JSON.stringify([review, history]).includes('Unrelated private current name QA'));
  await child.set(previous);
});
await check('inactive-parent-cannot-be-newly-verified', async () => {
  await membership(parent.uid).update({ active: false });
  const row = (await list(manager)).items[0];
  assert.deepEqual(row.allowedActions, ['refuse']); assert.equal(row.childName, null); assert.equal(row.parentName, null);
  await membership(parent.uid).update({ active: true });
});
await check('archived-club-still-allows-removing-not-granting-verification', async () => {
  const club = db.collection('clubs').doc(clubId), previous = (await club.get()).data();
  await club.update({ status: 'archived' });
  assert.deepEqual((await list(manager)).items[0].allowedActions, ['refuse']);
  await ref.update({ status: 'verified', revision: 2 });
  assert.deepEqual((await list(manager)).items[0].allowedActions, ['revoke']);
  await ref.update({ status: 'requested', revision: 1 }); await club.set(previous);
});
await check('manager-cannot-approve-or-remove-their-own-parent-verification', async () => {
  const id = guardianVerificationId(clubId, 'self-child', manager.uid);
  await db.collection('guardianVerifications').doc(id).set({ ...fixtures[0], childId: 'self-child', parentUserId: manager.uid });
  const page = await list(dual), next = page.nextCursor ? await list(dual, page.nextCursor) : { items: [] };
  assert.deepEqual([...page.items, ...next.items].find((item) => item.id === id).allowedActions, []);
  await db.collection('guardianVerifications').doc(id).delete();
});
await check('malformed-or-noncanonical-records-fail-closed', async () => {
  await ref.update({ revision: 'bad' });
  await denied('listClubGuardianVerifications', manager, { clubId }, 'FAILED_PRECONDITION');
  await ref.update({ revision: 1 });
  await db.collection('guardianVerifications').doc('000-noncanonical').set(fixtures[0]);
  await denied('listClubGuardianVerifications', manager, { clubId }, 'FAILED_PRECONDITION');
  await db.collection('guardianVerifications').doc('000-noncanonical').delete();
});
await check('listed-revision-supports-real-manager-confirmation-and-stale-rejection', async () => {
  const operation = { clubId, childId: target.childId, parentUserId: parent.uid, action: 'verify', expectedRevision: target.revision, requestId: randomUUID() };
  const result = await call('transitionGuardianVerification', manager, operation);
  assert.equal(result.status, 'verified'); assert.equal(result.revision, 2);
  await denied('transitionGuardianVerification', manager, { ...operation, action: 'refuse', requestId: randomUUID() }, 'FAILED_PRECONDITION');
  const row = (await list(manager)).items[0]; assert.equal(row.status, 'verified'); assert.deepEqual(row.allowedActions, ['revoke']);
});
await check('read-only-lists-do-not-create-events-or-change-protected-records', async () => {
  const snapshot = async () => {
    const state = {};
    for (const collection of ['guardianVerifications', 'guardianVerificationEvents', 'children', 'memberships', 'teams', 'bookings', 'notifications'])
      state[collection] = (await db.collection(collection).orderBy('__name__').get()).docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    return state;
  };
  const before = await snapshot();
  await list(manager); await call('listMyGuardianVerifications', parent); await call('listGuardianReviewClubs', dual);
  assert.deepEqual(await snapshot(), before);
});
const sourceFiles = ['functions/src/services/guardianLists.ts', 'functions/src/callables/guardianLists.ts',
  'functions/src/services/guardianVerification.ts', 'functions/src/callables/guardianVerification.ts',
  'scripts/qa/local-guardian-review-suite.mjs'];
let browser;
if (process.env.SGM_GUARDIAN_BROWSER_TEST === 'true') {
  const reviewer = await actor('guardian-review-ui-manager', ['clubManager']);
  await membership(reviewer.uid).set({ userId: reviewer.uid, clubId, role: 'clubManager', status: 'active' });
  const { checkGuardianReviewBrowser } = await import('./local-guardian-review-browser.mjs');
  browser = await checkGuardianReviewBrowser({ clubId, email: 'guardian-review-ui-manager@example.test' });
  sourceFiles.push('admin/src/GuardianReviewPanel.tsx', 'admin/src/GuardianReviewController.ts',
    'admin/src/guardianReviewGateway.ts', 'admin/src/guardianReviewWire.ts', 'admin/src/guardianReviewTypes.ts',
    'admin/src/memberships.css', 'scripts/qa/local-guardian-review-browser.mjs');
}
const result = { projectId: 'demo-sgm-local-qa', runId: process.env.SGM_LOCAL_RUN_ID, testedAt: new Date().toISOString(),
  scope: 'isolated-guardian-review-http-not-native-ui', checks, testCount: checks.length,
  steps: [{ id: 'guardian-review-services', status: 'passed' },
    ...(browser ? [{ id: 'guardian-review-ui', status: 'passed' }] : [])], providerRequests: 0, productionWrites: false,
  physicalDevice: false, teamChatImplemented: false, childEmergencyImplemented: false,
  ...(browser ? { browser } : {}),
  sourceFiles: Object.fromEntries(sourceFiles.map((path) => [path, createHash('sha256')
    .update(readFileSync(resolve(import.meta.dirname, '../..', path))).digest('hex')])) };
mkdirSync(dirname(process.env.SGM_LOCAL_FLOW_OUTPUT), { recursive: true });
writeFileSync(process.env.SGM_LOCAL_FLOW_OUTPUT, JSON.stringify(result, null, 2) + '\n');
console.log(`Guardian review HTTP checks passed: ${checks.length}. No production writes or provider calls.`);
