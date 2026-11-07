import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { call, db, denied, signIn } from './local-flow-client.mjs';
import { cleanupTeamNativeFixture, seedTeamNativeFixture, teamUi, verifyTeamNativeFixture } from './local-team-native-fixture.mjs';

execFileSync(process.execPath, [resolve(import.meta.dirname, 'seed-firebase-emulator.mjs')], { env: process.env, stdio: ['ignore', 'pipe', 'pipe'], timeout: 90_000 });
const parent = await signIn('p@example.test'), manager = await signIn('c@example.test'), driver = await signIn('d@example.test');
await call('initializeUserProfile', parent); await call('initializeUserProfile', driver);
const steps = [], check = async (id, run) => { await run(); steps.push({ id, status: 'passed' }); };
const fixture = await seedTeamNativeFixture(); let failure;
const view = (childId) => call('getTeamEnrollmentView', parent, { teamId: teamUi.teamId, ...(childId ? { childId } : {}) });
const request = async (childId) => {
  const current = await view(childId);
  return call('requestTeamEnrollment', parent, { teamId: teamUi.teamId, ...(childId ? { childId } : {}),
    expectedTeamInstanceId: current.teamInstanceId, expectedEnrollmentId: current.id, expectedRevision: current.revision, requestId: randomUUID() });
};
const decide = (actor, row, action) => call('transitionTeamEnrollment', actor, { enrollmentId: row.enrollmentId ?? row.id,
  expectedRevision: row.revision, action, requestId: randomUUID() });
let revokeRequestId;
try {
  await check('fixture-parent-is-verified-by-two-actual-authenticated-transitions', async () => {
    await assert.rejects(() => seedTeamNativeFixture(), /clubs\/sgm-qa-team-ui-club/);
    await call('initializeUserProfile', parent); await call('initializeUserProfile', driver);
    const record = await db.collection('guardianVerifications').doc(fixture.verificationId).get();
    assert.equal(record.get('status'), 'verified'); assert.equal(record.get('revision'), 2);
    assert.equal((await db.collection('guardianVerificationEvents').where('verificationId', '==', fixture.verificationId).get()).size, 2);
  });
  await check('reading-enrollment-views-does-not-create-an-enrollment', async () => {
    assert.equal((await view()).status, null); assert.equal((await view(teamUi.childId)).status, null);
    assert.equal((await db.collection('teamEnrollments').where('teamId', '==', teamUi.teamId).get()).size, 0);
  });
  await check('owned-member-refusal-new-request-approval-and-withdrawal-have-five-events', async () => {
    let receipt = await request(); await denied('transitionTeamEnrollment', driver, { enrollmentId: receipt.enrollmentId,
      expectedRevision: receipt.revision, action: 'approve', requestId: randomUUID() }, 'PERMISSION_DENIED');
    await decide(manager, receipt, 'refuse'); assert.equal((await view()).status, 'refused');
    receipt = await request(); await decide(manager, receipt, 'approve'); assert.equal((await view()).status, 'approved');
    receipt = await decide(parent, await view(), 'withdraw'); assert.equal(receipt.status, 'withdrawn'); assert.equal(receipt.revision, 5);
  });
  await check('guardian-loss-denies-stale-child-withdrawal-without-an-enrollment-event', async () => {
    const requestReply = await request(teamUi.childId); await decide(manager, requestReply, 'approve'); const approved = await view(teamUi.childId);
    revokeRequestId = randomUUID(); await call('transitionGuardianVerification', manager, { clubId: teamUi.clubId, childId: teamUi.childId,
      parentUserId: teamUi.parentId, expectedRevision: 2, action: 'revoke', requestId: revokeRequestId });
    await denied('transitionTeamEnrollment', parent, { enrollmentId: approved.id, action: 'withdraw', expectedRevision: approved.revision,
      requestId: randomUUID() }, 'PERMISSION_DENIED');
    const current = await view(teamUi.childId); assert.equal(current.subjectName, null); assert.equal(current.eligible, false);
    assert.deepEqual(current.allowedActions, []); assert.equal(current.revision, 2); await decide(manager, current, 'revoke');
  });
  await check('exact-records-audit-actors-claims-and-unrelated-fixtures-stay-protected', async () => {
    await assert.rejects(() => verifyTeamNativeFixture(fixture, { selfEnrollmentId: fixture.selfEnrollmentId, childEnrollmentId: 'foreign' }));
    await verifyTeamNativeFixture(fixture, { selfEnrollmentId: fixture.selfEnrollmentId, childEnrollmentId: fixture.childEnrollmentId,
      guardianRevokeRequestId: revokeRequestId });
  });
} catch (error) { failure = error; }
try { await cleanupTeamNativeFixture(fixture); }
catch (error) { if (failure) throw new AggregateError([failure, error], 'Fixture checks and cleanup failed'); throw error; }
if (failure) throw failure;
steps.push({ id: 'scoped-fixture-cleanup-restores-the-exact-prior-records-and-claims', status: 'passed' });
const files = ['scripts/qa/local-team-native-fixture.mjs', 'scripts/qa/local-team-native-fixture-suite.mjs',
  'scripts/qa/run-local-team-native-fixtures.mjs', 'functions/src/domain/teamEnrollment.ts',
  'functions/src/services/teamEnrollment.ts', 'functions/src/services/teamEnrollmentAuthority.ts',
  'functions/src/services/teamEnrollmentViews.ts', 'functions/src/callables/teamEnrollment.ts',
  'functions/src/domain/guardianVerification.ts', 'functions/src/services/guardianVerification.ts',
  'functions/src/callables/guardianVerification.ts', 'functions/src/lib/https.ts', 'functions/src/callables/adminUsers.ts'];
const report = { projectId: 'demo-sgm-local-qa', runId: process.env.SGM_LOCAL_RUN_ID, testedAt: new Date().toISOString(),
  scope: 'local-emulated-services-not-phone-ui', coverage: 'team-native-fixture-lifecycle-not-native-execution',
  testCount: steps.length, steps, actualGuardianTransitions: 3, actualEnrollmentTransitions: 8, nativeUiExecuted: false,
  physicalDevice: false, productionWrites: false, providerRequests: 0, roleEscalation: false, isolatedFixtureCleanupVerified: true,
  sourceFiles: Object.fromEntries(files.map((file) => [file, createHash('sha256').update(readFileSync(resolve(import.meta.dirname, '../..', file))).digest('hex')])) };
mkdirSync(dirname(process.env.SGM_LOCAL_FLOW_OUTPUT), { recursive: true });
writeFileSync(process.env.SGM_LOCAL_FLOW_OUTPUT, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
console.log(`Passed ${steps.length} team fixture lifecycle groups; no native screen result accepted.`);
