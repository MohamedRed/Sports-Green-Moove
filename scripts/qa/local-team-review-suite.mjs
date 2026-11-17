import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { call, db, denied, signIn } from './local-flow-client.mjs';
import { teamUi } from './local-team-native-fixture.mjs';
import { cleanupTeamReviewFixture, prepareTeamReviewFixture, teamReviewSnapshot, verifyTeamReviewFixture } from './local-team-review-fixture.mjs';

execFileSync(process.execPath, [resolve(import.meta.dirname, 'seed-firebase-emulator.mjs')],
  { env: process.env, stdio: ['ignore', 'pipe', 'pipe'], timeout: 90000 });
const fixture = await prepareTeamReviewFixture(), checks = [];
const check = async (id, action) => { await action(); checks.push({ id, status: 'passed' }); };
const list = (clubId = teamUi.clubId, cursor) => call('listTeamEnrollmentReviewTeams', fixture.manager, { clubId, ...(cursor ? { cursor } : {}) });
const managerMember = db.collection('memberships').doc(`${teamUi.managerId}_${teamUi.clubId}`);
const transition = (id, action, revision) => call('transitionTeamEnrollment', fixture.manager,
  { enrollmentId: id, action, expectedRevision: revision, requestId: randomUUID() });
const hooks = {
  requestSelfAgain: () => fixture.request(fixture.parent),
  withdrawSelf: async () => {
    const view = await call('getTeamEnrollmentView', fixture.parent, { teamId: teamUi.teamId });
    return call('transitionTeamEnrollment', fixture.parent, { enrollmentId: view.id, action: 'withdraw', expectedRevision: view.revision, requestId: randomUUID() });
  },
  revokeGuardian: async () => {
    fixture.guardianRevokeRequestId = randomUUID();
    await call('transitionGuardianVerification', fixture.manager, { clubId: teamUi.clubId, childId: teamUi.childId,
      parentUserId: teamUi.parentId, action: 'revoke', expectedRevision: 2, requestId: fixture.guardianRevokeRequestId });
  },
  revokeManager: () => managerMember.update({ active: false }), restoreManager: () => managerMember.update({ active: true }),
};
let browser, failure;
try {
  await check('team-review-requires-auth-and-current-exact-club-management', async () => {
    await denied('listTeamEnrollmentReviewTeams', null, { clubId: teamUi.clubId }, 'UNAUTHENTICATED');
    for (const actor of [fixture.parent, await signIn('d@example.test')])
      await denied('listTeamEnrollmentReviewTeams', actor, { clubId: teamUi.clubId }, 'PERMISSION_DENIED');
    await denied('listTeamEnrollmentReviewTeams', fixture.manager, { clubId: 'sgm-qa-unmanaged-club' }, 'PERMISSION_DENIED');
  });
  let first;
  await check('twenty-five-teams-paginate-with-immutable-identity-and-minimal-fields', async () => {
    first = await list(); assert.equal(first.items.length, 20); assert(first.nextCursor);
    const second = await list(teamUi.clubId, first.nextCursor), items = [...first.items, ...second.items];
    assert.equal(second.items.length, 5); assert.equal(second.nextCursor, null); assert.equal(new Set(items.map((row) => row.id)).size, 25);
    assert(items.some((row) => row.id === teamUi.teamId && row.open));
    for (const row of items) {
      assert.equal(row.clubId, teamUi.clubId); assert.match(row.teamInstanceId, /^[a-f0-9]{64}$/);
      assert.deepEqual(Object.keys(row).sort(), ['clubId', 'id', 'name', 'open', 'teamInstanceId']);
    }
    assert(!JSON.stringify(items).includes('not-for-review'));
  });
  await check('team-review-cursors-cannot-cross-clubs-or-enrollment-lists', async () => {
    await denied('listTeamEnrollmentReviewTeams', fixture.manager,
      { clubId: 'sgm-qa-club-green-wavre', cursor: first.nextCursor }, 'PERMISSION_DENIED');
    await denied('listTeamEnrollments', fixture.manager, { teamId: teamUi.teamId, cursor: first.nextCursor }, 'PERMISSION_DENIED');
    for (const input of [{ clubId: teamUi.clubId, extra: true }, { clubId: teamUi.clubId, cursor: '!invalid' }])
      await denied('listTeamEnrollmentReviewTeams', fixture.manager, input, 'INVALID_ARGUMENT');
  });
  await check('manager-revocation-invalidates-an-already-returned-team-cursor', async () => {
    await hooks.revokeManager();
    try { await denied('listTeamEnrollmentReviewTeams', fixture.manager, { clubId: teamUi.clubId, cursor: first.nextCursor }, 'PERMISSION_DENIED'); }
    finally { await hooks.restoreManager(); }
  });
  await check('closed-team-removal-remains-discoverable-without-parent-enrollment-access', async () => {
    const second = await list(teamUi.clubId, first.nextCursor);
    const archived = second.items.find((row) => row.id.endsWith('choice-23')); assert(archived); assert.equal(archived.open, false);
    const options = await call('listTeamEnrollmentOptions', fixture.parent, { kind: 'teams', clubId: teamUi.clubId });
    const next = await call('listTeamEnrollmentOptions', fixture.parent, { kind: 'teams', clubId: teamUi.clubId, cursor: options.nextCursor });
    assert(![...options.items, ...next.items].some((row) => row.id === archived.id));
  });
  await check('team-review-reads-never-create-or-rewrite-any-protected-record', async () => {
    const before = await teamReviewSnapshot();
    await list(); await list(teamUi.clubId, first.nextCursor);
    const requests = await call('listTeamEnrollments', fixture.manager, { teamId: teamUi.teamId });
    assert.equal(requests.items.length, 20); assert(requests.nextCursor);
    const last = await call('listTeamEnrollments', fixture.manager, { teamId: teamUi.teamId, cursor: requests.nextCursor });
    assert.equal(last.items.length, 5);
    assert.deepEqual(await teamReviewSnapshot(), before);
  });
  if (process.env.SGM_TEAM_REVIEW_BROWSER_TEST === 'true') {
    const { checkTeamReviewBrowser } = await import('./local-team-review-browser.mjs');
    browser = await checkTeamReviewBrowser(fixture, hooks);
  } else {
    const core = fixture.created.core;
    await transition(core.selfEnrollmentId, 'refuse', 1); await hooks.requestSelfAgain();
    await transition(core.selfEnrollmentId, 'approve', 3); await hooks.withdrawSelf();
    await transition(core.childEnrollmentId, 'approve', 1); await hooks.revokeGuardian();
    await transition(core.childEnrollmentId, 'revoke', 2);
  }
  await check('persisted-core-decisions-and-all-twenty-three-other-requests-retain-exact-actors-and-revisions', () => verifyTeamReviewFixture(fixture));
} catch (error) { failure = error; }
try { await cleanupTeamReviewFixture(fixture); }
catch (cleanup) { throw failure ? new AggregateError([failure, cleanup], 'Team review run and cleanup failed') : cleanup; }
if (failure) throw failure;
checks.push({ id: 'scoped-fixture-cleanup-restores-all-original-records-and-account-roles', status: 'passed' });
const sources = ['functions/src/callables/teamEnrollmentReview.ts', 'functions/src/services/teamEnrollmentReview.ts',
  'functions/src/services/teamEnrollmentViews.ts', 'functions/src/services/teamEnrollmentAuthority.ts', 'functions/src/services/teamEnrollment.ts',
  'functions/src/callables/teamEnrollment.ts', 'functions/src/domain/teamEnrollment.ts', 'functions/src/index.ts',
  'functions/src/domain/guardianVerification.ts', 'functions/src/services/guardianVerification.ts', 'functions/src/callables/guardianVerification.ts',
  'scripts/qa/local-team-native-fixture.mjs', 'scripts/qa/local-emulator-config.mjs', 'scripts/qa/local-egress-guard.mjs',
  'scripts/qa/local-team-review-fixture.mjs', 'scripts/qa/local-team-review-suite.mjs', 'scripts/qa/run-local-team-review.mjs'];
if (browser) sources.push('scripts/qa/local-team-review-browser.mjs', 'admin/src/TeamReviewPanel.tsx', 'admin/src/TeamReviewConfirmation.tsx',
  'admin/src/TeamReviewController.ts', 'admin/src/teamReviewTypes.ts', 'admin/src/teamReviewWire.ts', 'admin/src/teamReviewGateway.ts',
  'admin/src/teamReview.css', 'admin/src/ClubDashboard.tsx', 'admin/src/AdminDashboard.tsx', 'admin/src/App.tsx', 'admin/src/useAdminAuth.ts', 'admin/src/firebase.ts');
const result = { projectId: 'demo-sgm-local-qa', runId: process.env.SGM_LOCAL_RUN_ID, testedAt: new Date().toISOString(),
  scope: 'local-team-manager-review-not-physical-or-parent-native-ui', checks, testCount: checks.length,
  steps: [{ id: 'team-review-services', status: 'passed' }, ...(browser ? [{ id: 'team-manager-review-ui', status: 'passed' }] : [])],
  ...(browser ? { browser } : {}), independentPersistedVerification: true, fixtureCleanupVerified: true,
  teamRequestsThroughAuthenticatedSdk: 26, coreEnrollmentTransitions: 8, otherRequestsUnchanged: 23, guardianTransitions: 3,
  managerDecisionsMethod: browser ? 'authenticated-management-browser' : 'authenticated-local-sdk',
  parentRequestsMethod: 'authenticated-local-sdk-not-parent-ui', managerUiProven: Boolean(browser), parentNativeUiProven: false,
  wholeNativeReplayProven: false, fullProcessRestartProven: false, videoCaptured: false, releaseEvidenceAccepted: false,
  providerRequests: 0, productionWrites: false, physicalDevice: false, teamChatImplemented: false,
  sourceFiles: Object.fromEntries(sources.map((path) => [path, createHash('sha256').update(readFileSync(resolve(import.meta.dirname, '../..', path))).digest('hex')])) };
mkdirSync(dirname(process.env.SGM_LOCAL_FLOW_OUTPUT), { recursive: true });
writeFileSync(process.env.SGM_LOCAL_FLOW_OUTPUT, JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
console.log(`Team review checks passed: ${checks.length}${browser ? `, browser: ${browser.checks.length}` : ''}. No production writes.`);
