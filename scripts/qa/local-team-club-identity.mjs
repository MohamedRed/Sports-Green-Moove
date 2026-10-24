import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Timestamp } from 'firebase-admin/firestore';
import { deleteApp, getApp } from 'firebase-admin/app';
import { getDatabase } from 'firebase-admin/database';
import { auth, call, db, denied } from './local-flow-client.mjs';
import { guardianVerificationId } from '../../functions/lib/domain/guardianVerification.js';
import { clubId, childId, decideEnrollment, enrollmentRequest, freshTeam, prepareTeamEnrollmentFixtures,
  submitEnrollment, verifyEnrollmentParent, viewEnrollment } from './local-team-enrollment-fixtures.mjs';

const { actors: a, roles } = await prepareTeamEnrollmentFixtures();
const checks = [], observed = {};
const check = async (id, action) => {
  try { await action(); checks.push({ id, status: 'passed' }); }
  catch (error) { checks.push({ id, status: 'failed', errorCode: /^[A-Z_]+$/.test(error.code) ? error.code : 'ASSERTION_FAILED' }); }
};
const protectedCollections = ['users', 'memberships', 'children', 'trips', 'bookings', 'rideSessions',
  'messages', 'chatInboxes', 'notifications', 'co2Ledger', 'rewardLedger', 'clubs', 'teams', 'guardianVerifications'];
const excluded = { clubs: clubId, teams: 'enroll-qa-club-identity-current',
  guardianVerifications: guardianVerificationId(clubId, childId, a.parent.uid) };
const baseline = async () => Object.fromEntries(await Promise.all(protectedCollections.map(async (name) => [name,
  (await db.collection(name).orderBy('__name__').get()).docs.filter((row) => row.id !== excluded[name])
    .map((row) => ({ id: row.id, data: row.data() }))])));
let baselineRecordsPreserved = false, claimsUnchanged = false, adminClientClosed = false;
const club = db.collection('clubs').doc(clubId), originalClub = await club.get();
const oldTeam = await freshTeam('club-identity-before');
for (let index = 0; index < 23; index++) await freshTeam(`club-identity-page-${String(index).padStart(2, '0')}`);
const oldChoices = await call('listTeamEnrollmentOptions', a.parent, { kind: 'teams', clubId });
const oldReview = await call('listTeamEnrollmentReviewTeams', a.manager, { clubId });
assert(oldChoices.nextCursor && oldReview.nextCursor);
const before = await baseline(), liveBefore = (await getDatabase().ref('liveTrips').get()).val();
await verifyEnrollmentParent(a.parent, a.manager);
const adultPending = await submitEnrollment(a.parent, await enrollmentRequest(a.parent, oldTeam));
const childPending = await submitEnrollment(a.parent, await enrollmentRequest(a.parent, oldTeam, childId));
try {
  await check('current-team-and-separately-verified-parent-are-eligible', async () => {
    assert.equal((await viewEnrollment(a.parent, oldTeam)).eligible, true);
    assert.equal((await viewEnrollment(a.parent, oldTeam, childId)).eligible, true);
  });
  await check('editing-stored-club-createdAt-does-not-invalidate-server-identity', async () => {
    await club.update({ createdAt: Timestamp.fromMillis(0) });
    assert.equal((await viewEnrollment(a.parent, oldTeam, childId)).eligible, true);
    assert((await call('listTeamEnrollmentOptions', a.parent, { kind: 'teams', clubId, cursor: oldChoices.nextCursor })).items.length > 0);
    assert((await call('listTeamEnrollmentReviewTeams', a.manager, { clubId, cursor: oldReview.nextCursor })).items.length > 0);
    await club.set(originalClub.data());
  });
  await club.delete(); await club.create({ ...originalClub.data(), createdAt: originalClub.createTime });
  const recreated = await club.get();
  assert(recreated.createTime.valueOf() > originalClub.createTime.valueOf());
  observed.clubCreationChanged = true;
  await check('old-adult-team-cannot-be-approved-by-the-recreated-club', async () => {
    const row = await viewEnrollment(a.parent, oldTeam); observed.oldAdultEligible = row.eligible;
    await denied('transitionTeamEnrollment', a.manager, { enrollmentId: adultPending.enrollmentId, action: 'approve',
      expectedRevision: adultPending.revision, requestId: randomUUID() }, 'PERMISSION_DENIED');
    assert.equal(row.eligible, false);
  });
  const currentTeam = await freshTeam('club-identity-current');
  await check('team-choice-cursors-cannot-cross-the-clubs-server-creation-identity', async () => {
    await denied('listTeamEnrollmentOptions', a.parent, { kind: 'teams', clubId, cursor: oldChoices.nextCursor }, 'PERMISSION_DENIED');
  });
  await check('manager-team-cursors-cannot-cross-the-clubs-server-creation-identity', async () => {
    await denied('listTeamEnrollmentReviewTeams', a.manager, { clubId, cursor: oldReview.nextCursor }, 'PERMISSION_DENIED');
  });
  await check('old-parent-verification-does-not-grant-a-new-team-in-the-recreated-club', async () => {
    let visible;
    try { visible = await viewEnrollment(a.parent, currentTeam, childId); }
    catch (error) { if (error.code !== 'PERMISSION_DENIED') throw error; }
    observed.oldGuardianAccepted = visible?.eligible === true;
    assert.equal(visible, undefined);
    const children = await call('listTeamEnrollmentOptions', a.parent, { kind: 'children', teamId: currentTeam });
    assert.equal(children.items.length, 0);
  });
  await check('new-club-choices-and-manager-lists-do-not-expose-orphaned-teams', async () => {
    const choices = await call('listTeamEnrollmentOptions', a.parent, { kind: 'teams', clubId });
    const review = await call('listTeamEnrollmentReviewTeams', a.manager, { clubId });
    observed.oldTeamOffered = choices.items.some((row) => row.id === oldTeam);
    assert.equal(observed.oldTeamOffered, false);
    assert.equal(review.items.some((row) => row.id === oldTeam), false);
    assert(choices.items.some((row) => row.id === currentTeam));
  });
  await check('new-club-manager-cannot-read-the-old-team-roster-or-refuse-its-request', async () => {
    await denied('listTeamEnrollments', a.manager, { teamId: oldTeam }, 'PERMISSION_DENIED');
    await denied('transitionTeamEnrollment', a.manager, { enrollmentId: childPending.enrollmentId, action: 'refuse',
      expectedRevision: childPending.revision, requestId: randomUUID() }, 'PERMISSION_DENIED');
  });
  await verifyEnrollmentParent(a.parent, a.manager);
  await check('fresh-parent-verification-and-current-team-explicit-approval-restore-child-access', async () => {
    const row = await viewEnrollment(a.parent, currentTeam, childId); assert.equal(row.eligible, true);
    const pending = await submitEnrollment(a.parent, await enrollmentRequest(a.parent, currentTeam, childId));
    const approved = await decideEnrollment(a.manager, pending, 'approve'); assert.equal(approved.status, 'approved');
    assert.equal((await viewEnrollment(a.parent, currentTeam, childId)).status, 'approved');
  });
  await check('fresh-parent-verification-still-cannot-revive-the-orphaned-team', async () => {
    const row = await viewEnrollment(a.parent, oldTeam, childId); assert.equal(row.eligible, false); assert.equal(row.subjectName, null);
    await denied('transitionTeamEnrollment', a.manager, { enrollmentId: childPending.enrollmentId, action: 'approve',
      expectedRevision: childPending.revision, requestId: randomUUID() }, 'PERMISSION_DENIED');
  });
} finally {
  try {
    assert.deepEqual(await baseline(), before);
    assert.deepEqual((await getDatabase().ref('liveTrips').get()).val(), liveBefore);
    baselineRecordsPreserved = true;
    assert.deepEqual(await Promise.all(Object.values(a).map(async ({ uid }) => ({ uid,
      claims: (await auth.getUser(uid)).customClaims }))), roles); claimsUnchanged = true;
  } finally { await deleteApp(getApp()); adminClientClosed = true; }
  const paths = ['functions/src/domain/teamEnrollment.ts', 'functions/src/services/teamEnrollmentAuthority.ts', 'functions/src/services/teamEnrollment.ts',
    'functions/src/services/teamEnrollmentViews.ts', 'functions/src/services/teamEnrollmentReview.ts',
    'functions/src/services/teamEnrollmentOptions.ts', 'scripts/qa/local-team-club-identity.mjs',
    'scripts/qa/run-local-team-club-identity.mjs'];
  writeFileSync(process.env.SGM_LOCAL_FLOW_OUTPUT, JSON.stringify({ projectId: 'demo-sgm-local-qa', runId: process.env.SGM_LOCAL_RUN_ID,
    testedAt: new Date().toISOString(), scope: 'local-emulated-services-not-phone-ui', coverage: 'team-club-identity-not-chat-or-native-ui',
    testCount: checks.length, steps: checks, checks, observed, baselineRecordsPreserved, baselineCollections: protectedCollections,
    claimsUnchanged, adminClientClosed,
    teamChatImplemented: false, nativeUiExecuted: false, physicalDevice: false, productionWrites: false, providerRequests: 0,
    sourceFiles: Object.fromEntries(paths.map((path) => [path, createHash('sha256').update(readFileSync(resolve(import.meta.dirname, '../..', path))).digest('hex')]))
  }, null, 2) + '\n', { flag: 'wx' });
}
assert.equal(checks.length, 10); assert(checks.every((row) => row.status === 'passed'), 'Club identity checks failed; retain this attempt as failed evidence');
console.log('Ten isolated team/club identity groups passed; team chat and native UI remain unverified.');
