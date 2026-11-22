import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { auth, call, db, denied, signIn } from './local-flow-client.mjs';
import { clubId, childId, decideEnrollment, enrollmentRequest, freshTeam, prepareTeamEnrollmentFixtures,
  submitEnrollment, verifyEnrollmentParent } from './local-team-enrollment-fixtures.mjs';

const { actors: a, roles } = await prepareTeamEnrollmentFixtures(), checks = [];
const check = async (id, action) => { await action(); checks.push({ id, status: 'passed' }); };
const owned = (actor, id) => call('getOwnedTeamEnrollmentView', actor, { enrollmentId: id });
const page = (actor, cursor) => call('listOwnedTeamEnrollments', actor, cursor ? { cursor } : {});
const submit = async (name, child) => submitEnrollment(a.parent, await enrollmentRequest(a.parent, await freshTeam('history-' + name), child));
const parentMembership = db.collection('memberships').doc(`${a.parent.uid}_${clubId}`);
const childRef = db.collection('children').doc(childId);
const eventCount = async () => (await db.collection('teamEnrollmentEvents').get()).size;
let first;
await check('history-is-auth-bound-and-rejects-child-admin-and-supplied-owner-fields', async () => {
  first = await submit('first');
  for (const actor of [null, a.child, a.admin]) {
    await denied('listOwnedTeamEnrollments', actor, {}, actor ? 'PERMISSION_DENIED' : 'UNAUTHENTICATED');
    await denied('getOwnedTeamEnrollmentView', actor, { enrollmentId: first.enrollmentId }, actor ? 'PERMISSION_DENIED' : 'UNAUTHENTICATED');
  }
  for (const name of ['listOwnedTeamEnrollments', 'getOwnedTeamEnrollmentView'])
    await denied(name, a.parent, { ...(name.startsWith('get') ? { enrollmentId: first.enrollmentId } : {}), userId: a.other.uid }, 'INVALID_ARGUMENT');
});
await check('owned-list-and-detail-are-read-only-and-cannot-read-another-requester', async () => {
  const before = await eventCount();
  const list = await page(a.parent), row = await owned(a.parent, first.enrollmentId);
  assert.equal(list.items.length, 1); assert.equal(row.id, first.enrollmentId); assert.equal(row.requesterUserId, a.parent.uid);
  assert.equal(row.subjectId, a.parent.uid); assert.deepEqual(row.allowedActions, ['withdraw']);
  assert.equal(row.status, 'requested'); assert.equal(await eventCount(), before);
  assert.deepEqual((await page(a.other)).items, []);
  await denied('getOwnedTeamEnrollmentView', a.other, { enrollmentId: row.id }, 'PERMISSION_DENIED');
  await denied('getOwnedTeamEnrollmentView', a.manager, { enrollmentId: row.id }, 'PERMISSION_DENIED');
});
await check('an-owned-request-remains-discoverable-and-withdrawable-after-club-loss', async () => {
  const saved = (await parentMembership.get()).data(); await parentMembership.update({ active: false });
  await denied('listTeamEnrollmentOptions', a.parent, { kind: 'teams', clubId }, 'PERMISSION_DENIED');
  const row = await owned(a.parent, first.enrollmentId); assert.equal(row.eligible, false); assert.equal(row.subjectName, null);
  assert((await page(a.parent)).items.some((item) => item.id === row.id));
  assert.deepEqual(row.allowedActions, ['withdraw']);
  assert.equal((await decideEnrollment(a.parent, row, 'withdraw')).status, 'withdrawn');
  assert.deepEqual((await owned(a.parent, row.id)).allowedActions, []); await parentMembership.set(saved);
});
await check('approved-adult-enrollment-can-be-withdrawn-without-renewing-club-eligibility', async () => {
  let result = await submit('approved'); result = await decideEnrollment(a.manager, result, 'approve');
  const saved = (await parentMembership.get()).data(); await parentMembership.update({ active: false });
  const row = await owned(a.parent, result.enrollmentId); assert.equal(row.status, 'approved'); assert.equal(row.eligible, false);
  assert.equal((await decideEnrollment(a.parent, row, 'withdraw')).status, 'withdrawn'); await parentMembership.set(saved);
});
await check('retired-and-deleted-teams-do-not-hide-owned-history-or-grant-new-requests', async () => {
  for (const mode of ['retired', 'deleted']) {
    const result = await submit(mode), record = await owned(a.parent, result.enrollmentId);
    const team = db.collection('teams').doc(record.teamId);
    if (mode === 'deleted') await team.delete(); else await team.update({ status: 'archived' });
    const history = await owned(a.parent, record.id); assert.equal(history.eligible, false);
    assert.deepEqual(history.allowedActions, ['withdraw']); if (mode === 'deleted') assert.equal(history.teamName, null);
    assert.equal((await decideEnrollment(a.parent, history, 'withdraw')).status, 'withdrawn');
  }
});
await check('recreated-or-transferred-teams-never-supply-new-labels-or-inherit-old-grants', async () => {
  for (const mode of ['recreated', 'transferred']) {
    const result = await submit(mode), original = await owned(a.parent, result.enrollmentId);
    const team = db.collection('teams').doc(original.teamId), saved = (await team.get()).data();
    if (mode === 'recreated') { await team.delete(); await team.create({ ...saved, name: 'New private identity QA' }); }
    else await team.update({ clubId: 'enroll-foreign-club', name: 'Foreign private team QA' });
    const row = await owned(a.parent, original.id); assert.equal(row.teamInstanceId, original.teamInstanceId);
    assert.equal(row.teamName, null); assert.equal(row.eligible, false); assert(!row.allowedActions.includes('request'));
    await denied('transitionTeamEnrollment', a.manager, { enrollmentId: row.id, expectedRevision: row.revision,
      action: 'approve', requestId: randomUUID() }, 'PERMISSION_DENIED');
  }
});
let approvedChild;
await check('revoking-a-parent-hides-the-child-label-and-denies-approved-child-withdrawal', async () => {
  await verifyEnrollmentParent(a.parent, a.manager);
  approvedChild = await decideEnrollment(a.manager, await submit('child-approved', childId), 'approve');
  assert((await owned(a.parent, approvedChild.enrollmentId)).subjectName);
  await call('transitionGuardianVerification', a.parent, { clubId, childId, parentUserId: a.parent.uid,
    action: 'withdraw', expectedRevision: (await db.collection('guardianVerifications').where('parentUserId', '==', a.parent.uid).get()).docs[0].get('revision'), requestId: randomUUID() });
  const row = await owned(a.parent, approvedChild.enrollmentId);
  assert.equal(row.subjectName, null); assert.equal(row.eligible, false); assert.deepEqual(row.allowedActions, []);
  await denied('transitionTeamEnrollment', a.parent, { enrollmentId: row.id, expectedRevision: row.revision,
    action: 'withdraw', requestId: randomUUID() }, 'PERMISSION_DENIED');
});
await check('only-the-requesting-parent-can-withdraw-a-pending-child-request-after-authority-loss', async () => {
  await verifyEnrollmentParent(a.parent, a.manager); const result = await submit('child-pending', childId);
  const saved = (await childRef.get()).data(); await childRef.update({ guardianUserIds: [] });
  const row = await owned(a.parent, result.enrollmentId); assert.equal(row.subjectName, null); assert.deepEqual(row.allowedActions, ['withdraw']);
  await denied('getOwnedTeamEnrollmentView', a.other, { enrollmentId: row.id }, 'PERMISSION_DENIED');
  assert.equal((await decideEnrollment(a.parent, row, 'withdraw')).status, 'withdrawn'); await childRef.set(saved);
});
await check('recreated-child-profiles-cannot-expose-new-names-or-reuse-old-approved-identities', async () => {
  const saved = (await childRef.get()).data(); await childRef.delete(); await childRef.create({ ...saved, displayName: 'Recreated child QA' });
  const row = await owned(a.parent, approvedChild.enrollmentId);
  assert.equal(row.subjectName, null); assert.equal(row.eligible, false); assert.deepEqual(row.allowedActions, []);
  await verifyEnrollmentParent(a.parent, a.manager);
  assert.equal((await owned(a.parent, row.id)).subjectName, null);
});
await check('a-refreshed-adult-token-without-parent-role-cannot-operate-child-history', async () => {
  const fresh = await submit('child-role', childId); const before = (await auth.getUser(a.parent.uid)).customClaims;
  await auth.setCustomUserClaims(a.parent.uid, { roleKeys: ['driver'] }); const driver = await signIn('p@example.test');
  const row = await owned(driver, fresh.enrollmentId); assert.equal(row.eligible, false); assert.equal(row.subjectName, null);
  assert.deepEqual(row.allowedActions, []);
  await denied('transitionTeamEnrollment', driver, { enrollmentId: row.id, expectedRevision: row.revision,
    action: 'withdraw', requestId: randomUUID() }, 'PERMISSION_DENIED');
  await auth.setCustomUserClaims(a.parent.uid, before);
});
await check('malformed-owned-records-and-invalid-identifiers-fail-closed', async () => {
  const result = await submit('corrupt'), ref = db.collection('teamEnrollments').doc(result.enrollmentId), saved = (await ref.get()).data();
  await ref.update({ revision: 0 }); await denied('getOwnedTeamEnrollmentView', a.parent, { enrollmentId: ref.id }, 'FAILED_PRECONDITION');
  await denied('listOwnedTeamEnrollments', a.parent, {}, 'FAILED_PRECONDITION'); await ref.set(saved);
  for (const id of ['bad', 'f'.repeat(63)]) await denied('getOwnedTeamEnrollmentView', a.parent, { enrollmentId: id }, 'INVALID_ARGUMENT');
  await denied('getOwnedTeamEnrollmentView', a.parent, { enrollmentId: 'f'.repeat(64) }, 'PERMISSION_DENIED');
});
await check('all-owned-pages-continue-without-duplicates-or-cross-account-cursor-access', async () => {
  for (let i = 0; i < 25; i++) await submit('page-' + i);
  let current = await page(a.parent); const firstCursor = current.nextCursor; assert.equal(current.items.length, 20); assert(firstCursor);
  const ids = current.items.map((item) => item.id); let pages = 1;
  while (current.nextCursor) {
    current = await page(a.parent, current.nextCursor); assert(current.items.length <= 20); ids.push(...current.items.map((item) => item.id));
    assert(++pages <= 10);
  }
  const expected = (await db.collection('teamEnrollments').where('requesterUserId', '==', a.parent.uid).get()).docs.map((doc) => doc.id).sort();
  assert.deepEqual([...ids].sort(), expected); assert.equal(new Set(ids).size, ids.length);
  await denied('listOwnedTeamEnrollments', a.other, { cursor: firstCursor }, 'PERMISSION_DENIED');
  await denied('listOwnedTeamEnrollments', a.parent, { cursor: 'invalid!' }, 'INVALID_ARGUMENT');
});
await check('an-old-withdraw-operation-does-not-withdraw-a-newly-reopened-request', async () => {
  const result = await submit('replay'), row = await owned(a.parent, result.enrollmentId), requestId = randomUUID();
  const withdrawn = await decideEnrollment(a.parent, row, 'withdraw', requestId);
  assert.equal((await owned(a.parent, row.id)).revision, withdrawn.revision);
  const next = await submitEnrollment(a.parent, await enrollmentRequest(a.parent, row.teamId));
  const replay = await decideEnrollment(a.parent, row, 'withdraw', requestId);
  assert.equal(replay.replayed, true); assert.equal(replay.status, 'requested'); assert.equal(replay.revision, next.revision);
  assert.equal((await owned(a.parent, row.id)).status, 'requested');
});
await check('history-never-grants-roles-conversation-access-or-request-capability', async () => {
  assert.deepEqual(await Promise.all(Object.values(a).map(async ({ uid }) => ({ uid, claims: (await auth.getUser(uid)).customClaims }))), roles);
  for (const item of (await page(a.parent)).items) assert(item.allowedActions.every((action) => action === 'withdraw'));
  assert.equal((await page(a.other)).items.length, 0);
});
const files = ['functions/src/services/teamEnrollmentHistory.ts', 'functions/src/callables/teamEnrollmentHistory.ts',
  'functions/src/services/teamEnrollmentAuthority.ts', 'functions/src/services/teamEnrollment.ts', 'functions/src/domain/teamEnrollment.ts',
  'functions/src/index.ts', 'scripts/qa/local-team-history-suite.mjs', 'scripts/qa/run-local-team-history.mjs'];
const report = { projectId: 'demo-sgm-local-qa', runId: process.env.SGM_LOCAL_RUN_ID, testedAt: new Date().toISOString(),
  scope: 'local-emulated-services-not-phone-ui', coverage: 'owned-team-enrollment-history', testCount: checks.length, checks, steps: checks,
  nativeUiExecuted: false, physicalDevice: false, productionWrites: false, providerRequests: 0, teamChatImplemented: false,
  sourceFiles: Object.fromEntries(files.map((file) => [file, createHash('sha256').update(readFileSync(resolve(import.meta.dirname, '../..', file))).digest('hex')])) };
mkdirSync(dirname(process.env.SGM_LOCAL_FLOW_OUTPUT), { recursive: true });
writeFileSync(process.env.SGM_LOCAL_FLOW_OUTPUT, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
console.log(`Passed ${checks.length} isolated owned-enrollment history groups; no native or team-chat result accepted.`);
