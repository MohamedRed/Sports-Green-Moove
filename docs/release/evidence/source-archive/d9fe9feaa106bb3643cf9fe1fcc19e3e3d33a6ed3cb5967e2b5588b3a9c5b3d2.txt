import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { Timestamp } from 'firebase-admin/firestore';
import { auth, call, db, denied, signIn } from './local-flow-client.mjs';
import { prepareTeamEnrollmentFixtures } from './local-team-enrollment-fixtures.mjs';
import { guardianVerificationId } from '../../functions/lib/domain/guardianVerification.js';
import { membershipDocumentId } from '../../functions/lib/domain/memberships.js';
import { teamContext } from '../../functions/lib/services/teamEnrollmentAuthority.js';
import { teamEnrollmentId } from '../../functions/lib/domain/teamEnrollment.js';

const { actors: a } = await prepareTeamEnrollmentFixtures(), checks = [], pages = [];
const uid = '界'.repeat(128), email = 'cursor-long-parent@example.test';
await auth.createUser({ uid, email, password: process.env.SGM_QA_PASSWORD });
await auth.setCustomUserClaims(uid, { roleKeys: ['parent', 'clubManager'] });
await db.collection('users').doc(uid).create({ displayName: 'Responsable pagination QA' });
const actor = await signIn(email), claims = (await auth.getUser(uid)).customClaims;
const clubs = Array.from({ length: 21 }, (_, index) => '界'.repeat(254) + String(index).padStart(2, '0'));
let batch = db.batch();
for (const [index, clubId] of clubs.entries()) {
  batch.create(db.collection('clubs').doc(clubId), { name: `Club pagination QA ${index}`, status: 'public', memberCount: 1 });
  batch.create(db.collection('memberships').doc(membershipDocumentId(uid, clubId)), { userId: uid, clubId,
    role: 'clubManager', status: 'active', active: true });
}
await batch.commit();
const check = async (id, run) => { await run(); checks.push({ id, status: 'passed' }); };
async function twoPages(name, input, expected, minCursor = 0) {
  const first = await call(name, actor, input); assert.equal(first.items.length, 20); assert(first.nextCursor);
  assert(first.nextCursor.length > minCursor); assert(first.nextCursor.length <= 16_384);
  const second = await call(name, actor, { ...input, cursor: first.nextCursor });
  assert.equal(second.items.length, 1); assert.equal(second.nextCursor, null);
  const ids = first.items.concat(second.items).map((row) => row.id);
  assert.equal(new Set(ids).size, 21); assert.deepEqual([...ids].sort(), [...expected].sort());
  pages.push({ callable: name, firstCount: 20, secondCount: 1, cursorLength: first.nextCursor.length, duplicateRows: 0 });
  return first.nextCursor;
}
let teamChoiceCursor;
await check('team-club-choices-resume-canonical-multibyte-memberships-with-cursors-over-two-kilobytes', async () => {
  teamChoiceCursor = await twoPages('listTeamEnrollmentOptions', { kind: 'clubs' }, clubs, 2048);
});
await check('parent-guardian-club-choices-use-the-same-lossless-opaque-cursor-contract', async () => {
  await twoPages('listGuardianParentOptions', { kind: 'clubs' }, clubs, 2048);
});
await check('both-manager-club-directories-resume-long-canonical-membership-ids', async () => {
  for (const name of ['listMembershipReviewClubs', 'listGuardianReviewClubs']) await twoPages(name, {}, clubs, 2048);
});
const clubId = clubs[0], memberIds = Array.from({ length: 21 }, (_, index) => '員'.repeat(124) + String(index).padStart(3, '0'));
batch = db.batch();
for (const [index, id] of memberIds.entries()) {
  batch.create(db.collection('users').doc(id), { displayName: `Membre pagination QA ${index}` });
  batch.create(db.collection('memberships').doc(membershipDocumentId(id, clubId)), { userId: id, clubId, role: 'member', status: 'active', active: true });
}
await batch.commit();
let membershipCursor;
await check('manager-membership-pages-preserve-composite-document-ids-without-losing-a-row', async () => {
  const first = await call('listClubMemberships', actor, { clubId }); assert.equal(first.items.length, 20); assert(first.nextCursor.length > 2048);
  const second = await call('listClubMemberships', actor, { clubId, cursor: first.nextCursor }); assert.equal(second.items.length, 2); assert.equal(second.nextCursor, null);
  const ids = first.items.concat(second.items).map((row) => row.id); assert.equal(new Set(ids).size, 22);
  assert.deepEqual([...ids].sort(), [uid, ...memberIds].map((id) => membershipDocumentId(id, clubId)).sort());
  membershipCursor = first.nextCursor;
  pages.push({ callable: 'listClubMemberships', firstCount: 20, secondCount: 2, cursorLength: first.nextCursor.length, duplicateRows: 0 });
});
const childIds = Array.from({ length: 21 }, (_, index) => `cursor-child-${index}`), now = Timestamp.now();
batch = db.batch();
for (const [index, childId] of childIds.entries()) {
  batch.create(db.collection('children').doc(childId), { displayName: `Enfant pagination QA ${index}`, guardianUserIds: [uid] });
  batch.create(db.collection('guardianVerifications').doc(guardianVerificationId(clubId, childId, uid)), {
    clubId, childId, parentUserId: uid, status: 'requested', revision: 1, lastActorUserId: uid, createdAt: now, updatedAt: now });
}
await batch.commit();
await check('parent-and-manager-guardian-pages-preserve-history-and-current-account-scopes', async () => {
  const ids = childIds.map((id) => guardianVerificationId(clubId, id, uid));
  await twoPages('listMyGuardianVerifications', {}, ids); await twoPages('listClubGuardianVerifications', { clubId }, ids);
});
const teamId = 'cursor-team-qa'; await db.collection('teams').doc(teamId).create({ clubId, name: 'Equipe pagination QA', status: 'active' });
const teamSnapshot = await db.collection('teams').doc(teamId).get();
assert.equal(teamSnapshot.exists, true); assert(teamSnapshot.createTime);
assert.equal(teamSnapshot.get('clubId'), clubId); assert.equal(clubId.length, 256);
assert.equal(teamSnapshot.get('status'), 'active');
const team = teamContext(teamSnapshot); batch = db.batch();
for (const id of memberIds) batch.create(db.collection('teamEnrollments').doc(teamEnrollmentId(team.teamInstanceId, 'member', id, null)), {
  teamId, clubId, teamInstanceId: team.teamInstanceId, teamCreatedAt: team.teamCreatedAt, subjectKind: 'member', subjectId: id,
  childCreatedAt: null, requesterUserId: id, status: 'requested', revision: 1, lastActorUserId: id, createdAt: now, updatedAt: now });
await batch.commit();
await check('manager-team-pages-use-the-shared-cursor-without-changing-any-enrollment', async () => {
  await twoPages('listTeamEnrollments', { teamId }, memberIds.map((id) => teamEnrollmentId(team.teamInstanceId, 'member', id, null)));
  assert.equal((await db.collection('teamEnrollmentEvents').get()).size, 0);
  assert((await db.collection('teamEnrollments').get()).docs.every((doc) => doc.get('revision') === 1 && doc.get('status') === 'requested'));
});
await check('foreign-account-list-and-club-cursors-remain-denied-after-increasing-size-support', async () => {
  await denied('listTeamEnrollmentOptions', a.parent, { kind: 'clubs', cursor: teamChoiceCursor }, 'PERMISSION_DENIED');
  await denied('listGuardianParentOptions', actor, { kind: 'clubs', cursor: teamChoiceCursor }, 'PERMISSION_DENIED');
  await denied('listClubMemberships', actor, { clubId: clubs[1], cursor: membershipCursor }, 'PERMISSION_DENIED');
  await denied('listTeamEnrollmentOptions', actor, { kind: 'clubs', cursor: 'A'.repeat(16_385) }, 'INVALID_ARGUMENT');
  await denied('listTeamEnrollmentOptions', actor, { kind: 'clubs', cursor: teamChoiceCursor + '=' }, 'INVALID_ARGUMENT');
  const manager = db.collection('memberships').doc(membershipDocumentId(uid, clubId)), saved = (await manager.get()).data();
  await manager.update({ active: false }); await denied('listClubMemberships', actor, { clubId, cursor: membershipCursor }, 'PERMISSION_DENIED'); await manager.set(saved);
});
await check('long-membership-decisions-still-require-current-manager-version-and-canonical-identity', async () => {
  const target = db.collection('memberships').doc(membershipDocumentId(memberIds[0], clubId));
  await target.update({ status: 'requested', active: false }); const record = await target.get();
  const expectedVersion = `${record.updateTime.seconds}.${record.updateTime.nanoseconds}`;
  const input = { membershipId: target.id, decision: 'approve', expectedVersion };
  for (const outsider of [a.parent, a.manager]) await denied('reviewClubMembership', outsider, input, 'PERMISSION_DENIED');
  const reply = await call('reviewClubMembership', actor, input); assert.equal(reply.status, 'active'); assert.equal(reply.membershipId, target.id);
  assert.equal((await clubRef(clubId).get()).get('memberCount'), 2);
  await denied('reviewClubMembership', actor, input, 'FAILED_PRECONDITION');
  const malformed = db.collection('memberships').doc('cursor-noncanonical-qa'); await malformed.create({ ...record.data(), status: 'requested', active: false });
  const bad = await malformed.get(); await denied('reviewClubMembership', actor, { membershipId: malformed.id, decision: 'approve',
    expectedVersion: `${bad.updateTime.seconds}.${bad.updateTime.nanoseconds}` }, 'FAILED_PRECONDITION');
  assert.equal((await malformed.get()).get('status'), 'requested'); assert.equal((await clubRef(clubId).get()).get('memberCount'), 2);
  await denied('listClubMemberships', actor, { clubId }, 'FAILED_PRECONDITION');
  assert.equal((await db.collection('membershipReviews').get()).size, 1); assert.equal((await db.collection('notifications').where('type', '==', 'membershipReviewed').get()).size, 1);
});
function clubRef(id) { return db.collection('clubs').doc(id); }
assert.deepEqual((await auth.getUser(uid)).customClaims, claims);
const paths = ['functions/src/domain/firestoreDocumentId.ts', 'functions/src/lib/membershipPageCursor.ts',
  'functions/src/callables/membershipLists.ts', 'functions/src/callables/membershipReview.ts', 'functions/src/callables/guardianLists.ts',
  'functions/src/callables/guardianParent.ts', 'functions/src/callables/teamEnrollment.ts', 'functions/src/services/teamEnrollmentOptions.ts',
  'scripts/qa/local-membership-cursor-suite.mjs', 'scripts/qa/run-local-membership-cursors.mjs'];
const report = { projectId: 'demo-sgm-local-qa', runId: process.env.SGM_LOCAL_RUN_ID, testedAt: new Date().toISOString(),
  scope: 'local-emulated-services-not-phone-ui', coverage: 'long-composite-and-multibyte-membership-cursor-continuation', testCount: checks.length, steps: checks, pages,
  nativeUiExecuted: false, productionWrites: false, providerRequests: 0, syntheticClubs: 21, syntheticTeamEnrollmentRows: 21,
  syntheticRequestedGuardianRows: 21, actualLocalMembershipApprovals: 1, livePushProven: false,
  sourceFiles: Object.fromEntries(paths.map((path) => [path, createHash('sha256').update(readFileSync(resolve(import.meta.dirname, '../..', path))).digest('hex')])) };
mkdirSync(dirname(process.env.SGM_LOCAL_FLOW_OUTPUT), { recursive: true });
writeFileSync(process.env.SGM_LOCAL_FLOW_OUTPUT, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
console.log(`Passed ${checks.length} scoped cursor scenario groups; no native or live-provider flow accepted.`);
