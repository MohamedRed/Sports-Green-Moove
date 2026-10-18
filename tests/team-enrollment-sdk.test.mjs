import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { XMLParser } from 'fast-xml-parser';
import { validateTeamNativeDevice, teamNativeChecks, teamNativeScreenshots } from '../scripts/qa/team-native-evidence.mjs';

const read = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const runId = 'a'.repeat(32), bytes = Buffer.alloc(24);
Buffer.from('89504e470d0a1a0a', 'hex').copy(bytes); bytes.writeUInt32BE(320, 16); bytes.writeUInt32BE(720, 20);
const hash = createHash('sha256').update(bytes).digest('hex');
const marker = () => ({ runId, projectId: 'demo-sgm-local-qa', scope: 'local-native-team-ui-with-sdk-manager-not-physical',
  selfEnrollmentId: 'b'.repeat(64), childEnrollmentId: 'c'.repeat(64), guardianRevokeRequestId: 'e0f9228a-c4f6-45ed-a273-139d9c191125',
  checks: teamNativeChecks.map((id) => ({ id, status: 'passed' })),
  screenshots: Object.fromEntries(teamNativeScreenshots.map((name) => [name, hash])) });
const receipt = () => ({ runId, projectId: 'demo-sgm-local-qa', scope: 'local-adb-file-sync-command-not-flow-verification',
  phase: 'team-enrollment', completed: true, status: 0, signal: null, errorCode: null });

test('team SDK proof requires all ten checks and five original nonempty portrait captures', () => {
  validateTeamNativeDevice(marker(), receipt(), runId, () => bytes);
  for (const patch of [{ runId: 'b'.repeat(32) }, { projectId: 'production' }, { scope: 'component-fixture' },
    { selfEnrollmentId: 'unknown' }, { childEnrollmentId: 'b'.repeat(64) }, { guardianRevokeRequestId: 'unknown' },
    { checks: marker().checks.slice(1) }, { checks: marker().checks.toReversed() },
    { screenshots: { ...marker().screenshots, 'extra.png': hash } }])
    assert.throws(() => validateTeamNativeDevice({ ...marker(), ...patch }, receipt(), runId, () => bytes));
  const failed = marker(); failed.checks[0].status = 'failed';
  assert.throws(() => validateTeamNativeDevice(failed, receipt(), runId, () => bytes));
  assert.throws(() => validateTeamNativeDevice(marker(), receipt(), runId, () => Buffer.from('changed')));
  const blank = Buffer.from(bytes); blank.writeUInt32BE(0, 16);
  assert.throws(() => validateTeamNativeDevice(marker(), receipt(), runId, () => blank));
});
test('cleanup transfers, stale receipts and interrupted primary copies never satisfy team proof', () => {
  for (const patch of [{ phase: 'failure-cleanup' }, { status: 1 }, { completed: false }, { signal: 'SIGTERM' },
    { errorCode: 'ETIMEDOUT' }, { runId: 'b'.repeat(32) }, { projectId: 'production' }])
    assert.throws(() => validateTeamNativeDevice(marker(), { ...receipt(), ...patch }, runId, () => bytes));
});
test('team enrollment is added to the complete app matrix without removing preceding scenarios', () => {
  const runner = read('scripts/qa/local-android-session.mjs');
  assert(runner.includes('testCount: 36, nativeCaseCount: 38')); assert(runner.includes("'team-enrollment-ui'"));
  assert(runner.indexOf('await replayEmergencyContactUi') < runner.indexOf('await replayTeamEnrollmentUi'));
  assert(runner.indexOf('await replayTeamEnrollmentUi') < runner.indexOf("instrument(['LocalAppFlowTest'"));
  for (const action of ['replayGuardianParentUi', 'replayNativeBookingLoss', 'replayBookingUiLoss', 'verifyLocalRideUi',
    'replayTripConsentRestart', 'replayTripConsentRecovery', 'replayTripDraftRestart', 'replayScheduleDraftRestart', 'replayChatLossUi']) assert(runner.includes('await ' + action), action);
  assert(read('scripts/qa/collect-local-ui-evidence.mjs').includes("'team-enrollment'"));
});
test('only verified, persisted, transcript-bound and independently cleaned team results are recorded', () => {
  const replay = read('scripts/qa/local-team-enrollment-ui.mjs');
  assert(replay.includes('assertInstrumentationPassed')); assert(replay.includes('readTeamNativeDevice'));
  assert(replay.indexOf('await verifyTeamNativeFixture') < replay.indexOf('await cleanupTeamNativeFixture'));
  assert(replay.indexOf('if (failure) throw failure') < replay.indexOf("'team-enrollment-results.json'"));
  for (const field of ['guardianVerificationPreseeded: false', 'physicalDevice: false', 'productionWrites: false',
    'fullProcessRestartProven: false', 'teamChatImplemented: false', 'authenticated-local-sdk-not-management-ui']) assert(replay.includes(field), field);
  const native = read('android/app/src/androidTest/java/be/sportgreenmoove/app/ui/LocalTeamEnrollmentFlowTest.kt');
  assert(native.includes('BuildConfig.DEBUG && BuildConfig.SGM_USE_FIREBASE_EMULATOR'));
  assert(native.includes('ActivityScenario.launch(MainActivity::class.java)')); assert(native.includes('activity.recreate()'));
  assert(!native.includes('TeamEnrollmentUiFixture')); assert(native.includes('assertFalse(denied.eligible)'));
  assert(native.includes('assertEquals(2L, denied.revision)')); assert(native.includes('assertNull(denied.subjectName)'));
});
test('fixtures verify the parent through actual transitions and only remove their own records', () => {
  const fixture = read('scripts/qa/local-team-native-fixture.mjs');
  assert(!fixture.includes('setCustomUserClaims')); assert(fixture.includes("action: 'request', expectedRevision: 0"));
  assert(fixture.includes("action: 'verify', expectedRevision: 1")); assert(fixture.includes('assertProtectedState(await protectedState(), fixture.before)'));
  assert(fixture.includes("const loginIds = [teamUi.parentId, 'sgm-qa-driver']")); assert(fixture.includes('current >= previous'));
  assert(fixture.includes('const { updatedAt, ...fields } = row'));
  assert(fixture.includes("assert.equal(doc.get('clubId'), teamUi.clubId)"));
  assert(fixture.includes("assert.equal(doc.get('teamInstanceId'), fixture.teamInstanceId)"));
  const peer = read('android/app/src/androidTest/java/be/sportgreenmoove/app/ui/LocalTeamEnrollmentPeer.kt');
  assert(peer.includes('auth.currentUser?.uid == "sgm-qa-club-manager"')); assert(peer.includes('action in row["allowedActions"]'));
});
test('backend, native and web smoke gates enforce the new evidence contract and fixture lifecycle', () => {
  for (const name of ['backend-ci.yml', 'web-integration-smoke.yml', 'native-ci.yml'])
    assert(read('.github/workflows/' + name).includes('tests/team-enrollment-sdk.test.mjs'), name);
  for (const name of ['backend-ci.yml', 'web-integration-smoke.yml'])
    assert(read('.github/workflows/' + name).includes('npm run test:team-native-fixtures'), name);
});
test('six executed service groups bind the current fixture sources and retain explicit non-native scope', () => {
  const report = JSON.parse(read('docs/release/evidence/local-team-enrollment-sdk-2026-10-18/fixtures.json'));
  assert.equal(report.projectId, 'demo-sgm-local-qa'); assert.equal(report.scope, 'local-emulated-services-not-phone-ui');
  assert.equal(report.coverage, 'team-native-fixture-lifecycle-not-native-execution');
  assert.equal(report.testCount, 6); assert.equal(report.steps.length, 6); assert(report.steps.every((step) => step.status === 'passed'));
  assert.equal(report.actualGuardianTransitions, 3); assert.equal(report.actualEnrollmentTransitions, 8);
  for (const field of ['nativeUiExecuted', 'physicalDevice', 'productionWrites', 'roleEscalation']) assert.equal(report[field], false);
  assert.equal(report.providerRequests, 0); assert.equal(report.isolatedFixtureCleanupVerified, true);
  assert.equal(Object.keys(report.sourceFiles).length, 13);
  for (const [path, expected] of Object.entries(report.sourceFiles)) assert.equal(createHash('sha256').update(readFileSync(new URL('../' + path, import.meta.url))).digest('hex'), expected, path);
});
test('the compiled emulator-profile replay and 16 original unit passes cannot imply native team execution', () => {
  const base = 'docs/release/evidence/local-team-enrollment-sdk-2026-10-18/';
  const report = JSON.parse(read(base + 'build-checks.json')); assert.equal(report.nativeTestApkCompiled, true);
  for (const field of ['nativeUiExecuted', 'physicalDevice', 'productionWrites', 'managerNativeUiImplemented']) assert.equal(report[field], false);
  let count = 0;
  for (const [path, expected] of Object.entries(report.artifacts)) {
    const raw = readFileSync(new URL('../' + base + path, import.meta.url));
    assert.equal(createHash('sha256').update(raw).digest('hex'), expected, path);
    if (path.endsWith('.xml')) {
      const suite = new XMLParser({ ignoreAttributes: false }).parse(raw.toString('utf8')).testsuite;
      for (const field of ['errors', 'failures', 'skipped']) assert.equal(Number(suite['@_' + field]), 0);
      count += Number(suite['@_tests']);
    }
  }
  assert.equal(count, 16); assert.equal(report.unitCaseCount, count); assert(read(base + 'local-build.log').includes('BUILD SUCCESSFUL'));
  for (const [path, expected] of Object.entries(report.sourceFiles)) {
    assert.equal(createHash('sha256').update(readFileSync(new URL('../' + path, import.meta.url))).digest('hex'), expected, path);
    assert(read(path).split('\n').length < 300, path);
  }
});
