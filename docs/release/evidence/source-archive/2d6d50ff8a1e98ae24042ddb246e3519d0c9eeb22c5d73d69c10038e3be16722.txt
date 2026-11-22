import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { auth, call, db, denied } from './local-flow-client.mjs';
import { fetchLocalQa } from './local-http-request.mjs';
import { guardianVerificationId } from '../../functions/lib/domain/guardianVerification.js';
import { teamEnrollmentId } from '../../functions/lib/domain/teamEnrollment.js';
import { clubId, childId, decideEnrollment, enrollmentRequest, freshTeam, prepareTeamEnrollmentFixtures,
  submitEnrollment, verifyEnrollmentParent, viewEnrollment } from './local-team-enrollment-fixtures.mjs';

const { actors: a, roles } = await prepareTeamEnrollmentFixtures(), checks = [];
const check = async (id, action) => { await action(); checks.push({ id, status: 'passed' }); };
const ref = (result) => db.collection('teamEnrollments').doc(result.enrollmentId ?? result.id);
const decisionInput = (result, action, requestId = randomUUID()) => ({ enrollmentId: result.enrollmentId ?? result.id,
  expectedRevision: result.revision, action, requestId });
const events = async (id) => (await db.collection('teamEnrollmentEvents').where('enrollmentId', '==', id).get()).docs.map((doc) => doc.data());
const submit = async (actor, team, child) => { const input = await enrollmentRequest(actor, team, child); return { input, result: await submitEnrollment(actor, input) }; };
const parentMembership = db.collection('memberships').doc(`${a.parent.uid}_${clubId}`);
const childMembership = db.collection('memberships').doc(`${childId}_${clubId}`);
const childRef = db.collection('children').doc(childId);
await check('anonymous-child-and-admin-only-accounts-cannot-manage-enrollment', async () => {
  const team = await freshTeam('roles');
  const valid = await enrollmentRequest(a.parent, team);
  for (const actor of [null, a.child, a.admin]) {
    await denied('getTeamEnrollmentView', actor, { teamId: team }, actor ? 'PERMISSION_DENIED' : 'UNAUTHENTICATED');
    await denied('listTeamEnrollments', actor, { teamId: team }, actor ? 'PERMISSION_DENIED' : 'UNAUTHENTICATED');
    await denied('requestTeamEnrollment', actor, valid, actor ? 'PERMISSION_DENIED' : 'UNAUTHENTICATED');
  }
});
await check('read-only-view-binds-self-and-does-not-create-an-enrollment', async () => {
  const team = await freshTeam('view'), before = (await db.collection('teamEnrollments').get()).size;
  const row = await viewEnrollment(a.parent, team);
  assert.equal(row.subjectId, a.parent.uid); assert.equal(row.revision, 0); assert.equal(row.status, null);
  assert.deepEqual(row.allowedActions, ['request']); assert.equal((await db.collection('teamEnrollments').get()).size, before);
  await denied('getTeamEnrollmentView', a.parent, { teamId: team, userId: a.other.uid }, 'INVALID_ARGUMENT');
  await denied('getTeamEnrollmentView', a.parent, { teamId: team, clubId: 'spoof' }, 'INVALID_ARGUMENT');
});
await check('legacy-team-arrays-and-declared-parent-links-never-count-as-team-approval', async () => {
  const row = await viewEnrollment(a.parent, 'sgm-qa-club-green-wavre-u8');
  assert.equal(row.status, null); assert.equal(row.revision, 0);
  await denied('getTeamEnrollmentView', a.parent, { teamId: row.teamId, childId }, 'PERMISSION_DENIED');
});
let adult;
await check('adult-request-is-versioned-private-and-never-self-approved', async () => {
  const team = await freshTeam('adult'); adult = await submit(a.parent, team);
  assert.equal(adult.result.status, 'requested'); assert.equal(adult.result.revision, 1);
  assert.equal((await events(adult.result.enrollmentId)).length, 1);
  for (const action of ['approve', 'refuse', 'revoke']) await denied('transitionTeamEnrollment', a.parent,
    decisionInput(adult.result, action), 'PERMISSION_DENIED');
  const replay = await submitEnrollment(a.parent, adult.input); assert.equal(replay.replayed, true); assert.equal(replay.revision, 1);
  await denied('requestTeamEnrollment', a.driver, adult.input, 'FAILED_PRECONDITION');
  for (const actor of [a.driver, a.manager]) {
    const own = await submit(actor, await freshTeam(`adult-${actor.uid}`));
    assert.equal(own.result.status, 'requested'); assert.equal((await ref(own.result).get()).get('subjectId'), actor.uid);
  }
});
await check('manager-authority-comes-from-the-teams-stored-club-not-extra-claims-or-input', async () => {
  for (const actor of [a.foreign, a.unscoped, a.admin, a.child]) {
    await denied('transitionTeamEnrollment', actor, decisionInput(adult.result, 'approve'), 'PERMISSION_DENIED');
    await denied('listTeamEnrollments', actor, { teamId: adult.input.teamId }, 'PERMISSION_DENIED');
  }
  await denied('transitionTeamEnrollment', a.manager, { ...decisionInput(adult.result, 'approve'), clubId: 'spoof' }, 'INVALID_ARGUMENT');
  const page = await call('listTeamEnrollments', a.manager, { teamId: adult.input.teamId });
  assert.equal(page.items.length, 1); assert.equal(page.items[0].subjectId, a.parent.uid); assert(page.items[0].allowedActions.includes('approve'));
  assert(!JSON.stringify(page).includes('p@example.test'));
});
let approvedInput;
await check('only-current-manager-approval-grants-status-and-idempotent-replay-does-not-write', async () => {
  approvedInput = decisionInput(adult.result, 'approve');
  adult.result = await call('transitionTeamEnrollment', a.manager, approvedInput);
  assert.equal(adult.result.status, 'approved'); assert.equal(adult.result.revision, 2);
  const before = (await ref(adult.result).get()).data();
  assert.equal((await call('transitionTeamEnrollment', a.manager, approvedInput)).replayed, true);
  assert.deepEqual((await ref(adult.result).get()).data(), before);
  const membership = (await parentMembership.get()).data(); await parentMembership.update({ active: false });
  await denied('transitionTeamEnrollment', a.manager, approvedInput, 'PERMISSION_DENIED'); await parentMembership.set(membership);
});
await check('old-approval-replay-never-revives-a-revoked-team-enrollment', async () => {
  adult.result = await decideEnrollment(a.manager, adult.result, 'revoke');
  const replay = await call('transitionTeamEnrollment', a.manager, approvedInput);
  assert.equal(replay.status, 'revoked'); assert.equal(replay.revision, 3); assert.equal(replay.replayed, true);
  assert.equal((await events(adult.result.enrollmentId)).length, 3);
});
await check('concurrent-manager-decisions-and-stale-revisions-cannot-both-commit', async () => {
  const { result } = await submit(a.parent, await freshTeam('race'));
  const outcomes = await Promise.allSettled(['approve', 'refuse'].map((action) => decideEnrollment(a.manager, result, action)));
  assert.equal(outcomes.filter((item) => item.status === 'fulfilled').length, 1);
  assert.equal(outcomes.find((item) => item.status === 'rejected').reason.code, 'FAILED_PRECONDITION');
  assert.equal((await ref(result).get()).get('revision'), 2); assert.equal((await events(result.enrollmentId)).length, 2);
});
await check('owned-withdrawal-remains-available-after-club-loss-but-not-to-another-account', async () => {
  const { result } = await submit(a.parent, await freshTeam('withdraw'));
  await denied('transitionTeamEnrollment', a.other, decisionInput(result, 'withdraw'), 'PERMISSION_DENIED');
  const membership = (await parentMembership.get()).data(); await parentMembership.update({ active: false });
  assert.equal((await decideEnrollment(a.parent, result, 'withdraw')).status, 'withdrawn'); await parentMembership.set(membership);
});
await check('refused-requests-reopen-with-new-revisions-and-operation-identity-is-payload-bound', async () => {
  const team = await freshTeam('reopen'), first = await submit(a.parent, team);
  const refused = await decideEnrollment(a.manager, first.result, 'refuse'); assert.equal(refused.revision, 2);
  const reopened = await submit(a.parent, team); assert.equal(reopened.result.revision, 3); assert.equal(reopened.result.status, 'requested');
  assert.equal((await submitEnrollment(a.parent, first.input)).status, 'requested');
  await denied('requestTeamEnrollment', a.parent, { ...reopened.input, expectedRevision: 3 }, 'ALREADY_EXISTS');
  for (const patch of [{ approved: true }, { expectedRevision: -1 }, { expectedRevision: Number.MAX_SAFE_INTEGER }, { requestId: 'bad' }])
    await denied('requestTeamEnrollment', a.parent, { ...reopened.input, ...patch }, 'INVALID_ARGUMENT');
});
let childEnrollment;
await check('verified-parent-child-request-and-separate-team-approval-do-not-alter-guardian-or-club-records', async () => {
  await verifyEnrollmentParent(a.parent, a.manager);
  const guardianRef = db.collection('guardianVerifications').doc(guardianVerificationId(clubId, childId, a.parent.uid));
  const guardian = (await guardianRef.get()).data(), membership = (await childMembership.get()).data();
  const team = await freshTeam('child'); childEnrollment = await submit(a.parent, team, childId);
  assert.equal(childEnrollment.result.status, 'requested'); childEnrollment.result = await decideEnrollment(a.manager, childEnrollment.result, 'approve');
  assert.equal(childEnrollment.result.status, 'approved'); assert.deepEqual((await guardianRef.get()).data(), guardian);
  assert.deepEqual((await childMembership.get()).data(), membership);
});
await check('child-and-parent-membership-link-archive-and-team-state-loss-block-all-new-grants', async () => {
  const team = await freshTeam('child-eligibility'), { result } = await submit(a.parent, team, childId);
  const club = db.collection('clubs').doc(clubId), savedClub = (await club.get()).data();
  await club.update({ status: 'private' }); assert.equal((await viewEnrollment(a.parent, team, childId)).eligible, true);
  await club.set(savedClub);
  for (const [record, patch] of [[childRef, { guardianUserIds: [] }], [childMembership, { active: false }],
    [parentMembership, { active: false }], [db.collection('clubs').doc(clubId), { status: 'archived' }],
    [club, { status: 'unknown' }], [club, { status: 'active' }], [club, { status: FieldValue.delete() }],
    [db.collection('teams').doc(team), { active: false }]]) {
    const before = (await record.get()).data(); await record.update(patch);
    await denied('transitionTeamEnrollment', a.manager, decisionInput(result, 'approve'), 'PERMISSION_DENIED');
    const history = await viewEnrollment(a.parent, team, childId); assert.equal(history.eligible, false); assert.equal(history.subjectName, null);
    await record.set(before);
  }
  assert.equal((await ref(result).get()).get('revision'), 1);
});
await check('revoked-parent-authority-blocks-pending-approval-without-turning-history-into-a-grant', async () => {
  const team = await freshTeam('guardian-revoke'), { result } = await submit(a.parent, team, childId);
  const guardianRef = db.collection('guardianVerifications').doc(guardianVerificationId(clubId, childId, a.parent.uid));
  await call('transitionGuardianVerification', a.manager, { clubId, childId, parentUserId: a.parent.uid,
    action: 'revoke', expectedRevision: (await guardianRef.get()).get('revision'), requestId: randomUUID() });
  await denied('transitionTeamEnrollment', a.manager, decisionInput(result, 'approve'), 'PERMISSION_DENIED');
  const row = await viewEnrollment(a.parent, team, childId); assert.equal(row.eligible, false); assert.equal(row.subjectName, null);
  const page = await call('listTeamEnrollments', a.manager, { teamId: team }); assert(!page.items[0].allowedActions.includes('approve'));
  await verifyEnrollmentParent(a.parent, a.manager);
});
await check('another-verified-parent-can-see-the-child-enrollment-but-cannot-withdraw-the-requesters-decision', async () => {
  await childRef.update({ guardianUserIds: [a.parent.uid, a.other.uid] }); await verifyEnrollmentParent(a.other, a.manager);
  const row = await viewEnrollment(a.other, childEnrollment.input.teamId, childId); assert.equal(row.status, 'approved'); assert.equal(row.eligible, true);
  assert(!row.allowedActions.includes('withdraw'));
  await denied('transitionTeamEnrollment', a.other, decisionInput(childEnrollment.result, 'withdraw'), 'PERMISSION_DENIED');
});
await check('team-recreation-cannot-inherit-approval-even-with-a-forged-createdAt-field', async () => {
  const team = await freshTeam('team-recreated'), first = await submit(a.parent, team), teamRef = db.collection('teams').doc(team);
  const saved = (await teamRef.get()).data(); await teamRef.delete(); await teamRef.create(saved);
  const next = await viewEnrollment(a.parent, team); assert.notEqual(next.teamInstanceId, first.input.expectedTeamInstanceId);
  assert.notEqual(next.id, first.result.enrollmentId); assert.equal(next.status, null);
  await denied('requestTeamEnrollment', a.parent, first.input, 'FAILED_PRECONDITION');
  await denied('transitionTeamEnrollment', a.manager, decisionInput(first.result, 'approve'), 'PERMISSION_DENIED');
  assert.equal((await ref(first.result).get()).get('status'), 'requested');
});
await check('team-name-edit-preserves-identity-while-club-transfer-cannot-reuse-a-viewed-approval', async () => {
  const team = await freshTeam('team-update'), first = await submit(a.parent, team), teamRef = db.collection('teams').doc(team);
  await teamRef.update({ name: 'Nom modifie QA', createdAt: Timestamp.fromMillis(0) });
  assert.equal((await viewEnrollment(a.parent, team)).teamInstanceId, first.input.expectedTeamInstanceId);
  await teamRef.update({ clubId: 'enroll-foreign-club' });
  await denied('requestTeamEnrollment', a.parent, first.input, 'FAILED_PRECONDITION');
  await denied('transitionTeamEnrollment', a.manager, decisionInput(first.result, 'approve'), 'PERMISSION_DENIED');
});
await check('recreated-child-profiles-require-new-parent-verification-and-new-enrollment-identities', async () => {
  const team = await freshTeam('child-recreated'), first = await submit(a.parent, team, childId);
  const saved = (await childRef.get()).data(); await childRef.delete(); await childRef.create(saved);
  await denied('getTeamEnrollmentView', a.parent, { teamId: team, childId }, 'PERMISSION_DENIED');
  await verifyEnrollmentParent(a.parent, a.manager);
  const current = await viewEnrollment(a.parent, team, childId); assert.notEqual(current.id, first.result.enrollmentId); assert.equal(current.status, null);
  await denied('requestTeamEnrollment', a.parent, first.input, 'FAILED_PRECONDITION');
  await denied('transitionTeamEnrollment', a.manager, decisionInput(first.result, 'approve'), 'PERMISSION_DENIED');
});
await check('private-enrollment-and-audit-collections-deny-direct-client-access-including-admin', async () => {
  const base = `http://${process.env.FIRESTORE_EMULATOR_HOST}/v1/projects/demo-sgm-local-qa/databases/(default)/documents`;
  const before = (await ref(adult.result).get()).data();
  for (const actor of [null, a.parent, a.manager, a.admin]) for (const collection of ['teamEnrollments', 'teamEnrollmentEvents']) {
    for (const [suffix, method] of [['', 'GET'], [`/${adult.result.enrollmentId}`, 'GET'], [`/${adult.result.enrollmentId}`, 'PATCH'], [`/${adult.result.enrollmentId}`, 'DELETE']]) {
      const response = await fetchLocalQa(`${base}/${collection}${suffix}`, { method,
        headers: { 'content-type': 'application/json', ...(actor ? { authorization: `Bearer ${actor.token}` } : {}) },
        ...(method === 'PATCH' ? { body: JSON.stringify({ fields: { status: { stringValue: 'approved' } } }) } : {}) });
      assert.equal(response.status, 403); await response.arrayBuffer();
    }
  }
  assert.deepEqual((await ref(adult.result).get()).data(), before);
});
await check('malformed-private-records-fail-closed-and-never-look-like-missing-enrollment', async () => {
  const team = await freshTeam('corrupt'), { result } = await submit(a.parent, team), record = ref(result), saved = (await record.get()).data();
  for (const patch of [{ revision: 0 }, { clubId: 'spoof' }, { childCreatedAt: Timestamp.now() }, { extra: true }]) {
    await record.set({ ...saved, ...patch });
    await denied('getTeamEnrollmentView', a.parent, { teamId: team }, 'FAILED_PRECONDITION');
    await denied('transitionTeamEnrollment', a.manager, decisionInput(result, 'approve'), 'FAILED_PRECONDITION');
    await denied('listTeamEnrollments', a.manager, { teamId: team }, 'FAILED_PRECONDITION');
  }
  await record.set(saved);
});
await check('manager-pages-are-bounded-and-cursors-cannot-cross-account-or-team-scope', async () => {
  const team = await freshTeam('paging'), { result } = await submit(a.parent, team), sample = (await ref(result).get()).data();
  const batch = db.batch();
  for (let index = 0; index < 21; index++) {
    const subjectId = `paging-member-${index}`;
    batch.create(db.collection('teamEnrollments').doc(teamEnrollmentId(sample.teamInstanceId, 'member', subjectId, null)),
      { ...sample, subjectId, requesterUserId: subjectId, lastActorUserId: subjectId });
  }
  await batch.commit();
  const first = await call('listTeamEnrollments', a.manager, { teamId: team }); assert.equal(first.items.length, 20); assert(first.nextCursor);
  const second = await call('listTeamEnrollments', a.manager, { teamId: team, cursor: first.nextCursor });
  assert.equal(second.items.length, 2); assert.equal(second.nextCursor, null);
  await denied('listTeamEnrollments', a.manager, { teamId: await freshTeam('other-page'), cursor: first.nextCursor }, 'PERMISSION_DENIED');
  await denied('listTeamEnrollments', a.peerManager, { teamId: team, cursor: first.nextCursor }, 'PERMISSION_DENIED');
  assert.equal((await call('listTeamEnrollments', a.peerManager, { teamId: team })).items.length, 20);
  await denied('listTeamEnrollments', a.manager, { teamId: team, cursor: 'malformed!' }, 'INVALID_ARGUMENT');
  await denied('listTeamEnrollments', a.foreign, { teamId: team, cursor: first.nextCursor }, 'PERMISSION_DENIED');
  for (const row of (await db.collection('teamEnrollmentEvents').get()).docs) {
    assert(!JSON.stringify(row.data()).includes('Hermes Parent QA')); assert(!JSON.stringify(row.data()).includes('@example.test'));
  }
  assert.deepEqual(await Promise.all(Object.values(a).map(async ({ uid }) => ({ uid, claims: (await auth.getUser(uid)).customClaims }))), roles);
});
const paths = ['functions/src/domain/teamEnrollment.ts', 'functions/src/services/teamEnrollmentAuthority.ts',
  'functions/src/services/teamEnrollment.ts', 'functions/src/services/teamEnrollmentViews.ts', 'functions/src/callables/teamEnrollment.ts',
  'functions/src/__tests__/team-enrollment.test.ts', 'scripts/qa/local-team-enrollment-fixtures.mjs',
  'scripts/qa/local-team-enrollment-suite.mjs', 'scripts/qa/run-local-team-enrollment.mjs', 'firestore.rules'];
const report = { projectId: 'demo-sgm-local-qa', runId: process.env.SGM_LOCAL_RUN_ID, testedAt: new Date().toISOString(),
  scope: 'local-emulated-services-not-phone-ui', coverage: 'team-enrollment-authority-not-conversation-or-native-ui',
  testCount: checks.length, checks, steps: checks,
  teamChatImplemented: false, nativeUiExecuted: false, productionWrites: false, physicalDevice: false, providerRequests: 0,
  paginationFixtureRows: 21, sourceFiles: Object.fromEntries(paths.map((path) => [path,
    createHash('sha256').update(readFileSync(resolve(import.meta.dirname, '../..', path))).digest('hex')])) };
mkdirSync(dirname(process.env.SGM_LOCAL_FLOW_OUTPUT), { recursive: true });
writeFileSync(process.env.SGM_LOCAL_FLOW_OUTPUT, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
console.log(`Passed ${checks.length} isolated team-enrollment groups; no conversation or native UI accepted.`);
