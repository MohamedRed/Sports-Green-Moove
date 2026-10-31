import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { XMLParser } from 'fast-xml-parser';
import { assertOriginalPaginationSources } from './helpers/original-pagination-sources.mjs';
import { assertRetainedSourceFiles } from '../scripts/qa/retained-source-evidence.mjs';
import { fileURLToPath } from 'node:url';

const read = (path) => readFileSync(new URL('../' + path, import.meta.url));
const text = (path) => read(path).toString('utf8');
const json = (path) => JSON.parse(text(path));
const sha = (raw) => createHash('sha256').update(raw).digest('hex');
const root = fileURLToPath(new URL('../', import.meta.url));
const base = 'docs/release/evidence/local-team-enrollment-native-2026-10-18/';
test('team choices retain all twelve isolated groups without claiming native execution or enrollment approval', () => {
  const report = json(base + 'choices.json'); assert.equal(report.projectId, 'demo-sgm-local-qa');
  assert.match(report.runId, /^[a-f0-9]{32}$/); assert.equal(report.testCount, 12); assert.equal(report.steps.length, 12);
  assert(report.steps.every((item) => item.status === 'passed')); assert.equal(new Set(report.steps.map((item) => item.id)).size, 12);
  assert.equal(report.coverage, 'team-enrollment-choice-discovery-not-native-ui');
  for (const key of ['nativeUiExecuted', 'teamChatImplemented', 'productionWrites']) assert.equal(report[key], false);
  assert.equal(report.providerRequests, 0); assert.equal(report.syntheticTeamChoices, 24);
  assert.equal(report.syntheticChildrenWithActualLocalManagerVerification, 21);
  assertOriginalPaginationSources(report.sourceFiles, ['functions/src/services/teamEnrollmentOptions.ts']);
  const service = text('functions/src/services/teamEnrollmentOptions.ts');
  for (const guard of ['z.discriminatedUnion', 'requireEnrollmentRequester', 'teamEnrollmentEligibility', 'team?.teamInstanceId',
    'query.limit(21)', 'page.docs.slice(0, 20)', 'membershipDocumentId(uid, id)', 'page.size > 20']) assert(service.includes(guard), guard);
  assert(!/transaction\.(create|set|update|delete)\(/.test(service));
});
test('sixteen unit cases and a compiled component suite never substitute actual native screen evidence', () => {
  const report = json(base + 'build-checks.json'); assert.equal(report.unitCaseCount, 16);
  assert.equal(report.nativeComponentCasesCompiled, 4); assert.equal(report.nativeTestApkCompiled, true);
  for (const flag of ['nativeUiExecuted', 'sdkConnectedEnrollmentProven', 'physicalDevice', 'productionWrites']) assert.equal(report[flag], false);
  let count = 0;
  for (const [file, hash] of Object.entries(report.artifacts)) {
    const raw = read(base + file); assert.equal(sha(raw), hash);
    const suite = new XMLParser({ ignoreAttributes: false }).parse(raw.toString('utf8')).testsuite;
    for (const key of ['skipped', 'failures', 'errors']) assert.equal(Number(suite['@_' + key]), 0);
    count += Number(suite['@_tests']);
  }
  assert.equal(count, 16);
  assertRetainedSourceFiles(root, report.sourceFiles);
  for (const path of Object.keys(report.sourceFiles)) assert(text(path).split('\n').length < 300, path);
  const fixture = text('android/app/src/androidTest/java/be/sportgreenmoove/app/ui/TeamEnrollmentFlowTest.kt');
  assert.equal((fixture.match(/@Test fun/g) ?? []).length, 4); assert(fixture.includes('TeamEnrollmentUiFixture'));
  assert(fixture.includes('fontScale = 1.3f')); assert(fixture.includes('Modifier.width(320.dp)'));
});
test('native submissions remain account-bound, fresh, versioned and explicitly confirmed', () => {
  const root = 'android/app/src/main/java/be/sportgreenmoove/app/';
  const gateway = text(root + 'services/FirebaseAndroidTeamEnrollmentGateway.kt');
  assert.equal((gateway.match(/requireSession\(uid\)/g) ?? []).length, 2);
  for (const guard of ['current.id == expected.id', 'current.teamInstanceId == expected.teamInstanceId', 'current.revision == expected.revision',
    'action in current.allowedActions']) assert(gateway.includes(guard), guard);
  const state = text(root + 'ui/TeamEnrollmentState.kt');
  for (const guard of ['view !== expected', 'latest.revision >= receipt.revision', 'currentCoroutineContext().ensureActive()',
    'receipt.enrollmentId == expected.id', 'result.subjectId == (child ?: uid)', 'if (current(ticket))']) assert(state.includes(guard), guard);
  const route = text(root + 'ui/TeamEnrollmentRoute.kt'); assert(route.includes('state.clear()')); assert(route.includes('repeatOnLifecycle'));
  assert(route.includes('team-enrollment.confirm')); assert(route.includes('team-enrollment.keep'));
  assert(text(root + 'ui/SportsGreenMooveApp.kt').includes('canManageTeamEnrollment(requireNotNull(session).roles)'));
});
test('a second failed original transfer stays failed despite passing ordinary screens and restoration', () => {
  const sub = base + 'previous-run-interruption/'; const hashes = json(sub + 'artifact-sha256.json');
  assert.equal(Object.keys(hashes).length, 5);
  for (const [file, hash] of Object.entries(hashes)) assert.equal(sha(read(sub + file)), hash, file);
  const receipt = json(sub + 'adb-pull-trip-change-parent-confirmation.json');
  assert.equal(receipt.runId, 'd5375b51c7c7ddf126b458eddf93a8c3'); assert.equal(receipt.completed, false); assert.equal(receipt.status, 1);
  assert.equal(json(sub + 'native-suite-status.json').localReplay, 1); assert.equal(json(sub + 'disposable-store-restore.json').verified, true);
});
test('both CI paths replay discovery and validate the current native-source scope', () => {
  for (const name of ['backend-ci.yml', 'web-integration-smoke.yml']) {
    const workflow = text('.github/workflows/' + name);
    assert(workflow.includes('npm run test:team-options')); assert(workflow.includes('tests/team-enrollment-native-contract.test.mjs'));
  }
  const script = text('scripts/run-android-ui-tests-and-collect-screenshots.sh');
  assert(script.includes('adb pull /sdcard/Download/sgm-team-enrollment'));
  for (const file of ['team-requested.png', 'team-requested-window.png', 'team-approved-narrow.png', 'team-approved-narrow-window.png']) assert(script.includes(file));
});
test('four executed team screen cases stay separate from the failed capture export and successful local replay', () => {
  const sub = 'docs/release/evidence/team-screen-export-2026-10-18/';
  const hashes = json(sub + 'artifact-sha256.json'); assert.equal(Object.keys(hashes).length, 5);
  for (const [file, hash] of Object.entries(hashes)) assert.equal(sha(read(sub + file)), hash, file);
  const suite = new XMLParser({ ignoreAttributes: false }).parse(text(sub + 'ordinary-tests.xml')).testsuite;
  assert.equal(Number(suite['@_tests']), 143); assert.equal(Number(suite['@_skipped']), 33);
  assert.equal(Number(suite['@_failures']), 0); assert.equal(Number(suite['@_errors']), 0);
  const cases = suite.testcase.filter((item) => item['@_classname'] === 'be.sportgreenmoove.app.ui.TeamEnrollmentFlowTest');
  assert.equal(cases.length, 4); assert(cases.every((item) => !('failure' in item) && !('error' in item) && !('skipped' in item)));
  assert.deepEqual(json(sub + 'native-suite-status.json'), { scope: 'native-suite-exit-status-not-flow-verification',
    ordinaryTests: 0, componentEvidence: 1, localReplay: 0 });
  const replay = json(sub + 'local-replay.json');
  assert.equal(replay.projectId, 'demo-sgm-local-qa'); assert.equal(replay.testCount, 35); assert.equal(replay.nativeCaseCount, 37);
  assert.equal(replay.steps.length, 35); assert(replay.steps.every((step) => step.status === 'passed'));
  assert.equal(json(sub + 'disposable-store-restore.json').verified, true);
});
test('team capture export uses safe direct argv paths and verifies original bytes instead of trusting blank stdout', () => {
  const fixture = text('android/app/src/androidTest/java/be/sportgreenmoove/app/ui/TeamEnrollmentFlowTest.kt');
  const original = text('docs/release/evidence/team-screen-export-2026-10-18/TeamEnrollmentFlowTest.before.kt');
  assert(original.includes('cp \'${File(source, file).absolutePath}\' \'$target\''));
  assert(fixture.includes('Regex("[A-Za-z0-9/_.-]+").matches(original.absolutePath)'));
  assert(fixture.includes('cp ${original.absolutePath} $target')); assert(!fixture.includes('cp \'${'));
  for (const guard of ['original.isFile && original.length() > 0', 'MessageDigest.getInstance("SHA-256").digest(original.readBytes())',
    'sha256sum $target', 'observed.size == 2 && observed[0] == expected && observed[1] == target']) assert(fixture.includes(guard), guard);
});
test('the completed replay binds actual XML cases and original captures without promoting simulated responses to a real enrollment', () => {
  const sub = 'docs/release/evidence/team-screen-export-2026-10-18/completed/';
  const report = json(sub + 'component-results.json');
  assert.equal(report.scope, 'local-native-component-ui-not-physical-device'); assert.equal(report.projectId, null);
  assert.equal(report.sourceCommit, '0cb8e4c4cfdcc51f25201bfe1af8a90ec7bd3b36');
  assert.equal(report.gateway, 'in-memory-fixture'); assert.equal(report.componentSuiteCompleted, true);
  for (const flag of ['applicationBackendConnected', 'fullAppReplay', 'physicalDevice', 'realProviderOutcomesVerified']) assert.equal(report[flag], false);
  assert.equal(Object.keys(report.artifacts).length, 8);
  for (const [path, hash] of Object.entries(report.artifacts)) assert.equal(sha(read(sub + path)), hash, path);
  assertRetainedSourceFiles(root, report.sourceFiles);
  const suite = new XMLParser({ ignoreAttributes: false }).parse(text(sub + 'ordinary-tests.xml')).testsuite;
  assert.equal(Number(suite['@_tests']), 143); assert.equal(Number(suite['@_skipped']), 33);
  for (const field of ['failures', 'errors']) assert.equal(Number(suite['@_' + field]), 0);
  const cases = suite.testcase.filter((item) => item['@_classname'] === 'be.sportgreenmoove.app.ui.TeamEnrollmentFlowTest');
  assert.equal(cases.length, 4); assert(cases.every((item) => !('failure' in item) && !('error' in item) && !('skipped' in item)));
  assert.equal(report.testedAt, suite['@_timestamp'] + 'Z'); assert.equal(report.testCount, 4);
  assert.deepEqual(report.steps, cases.map((item) => ({ id: item['@_name'], status: 'passed' })));
  for (const file of ['team-requested-window.png', 'team-approved-narrow-window.png']) {
    const image = read(sub + file); assert.equal(image.readUInt32BE(16), 1080); assert.equal(image.readUInt32BE(20), 2400);
  }
});
test('the complete native run preserves all 35 local groups and passes every primary suite boundary', () => {
  const sub = 'docs/release/evidence/team-screen-export-2026-10-18/completed/';
  const run = json(sub + 'local-replay.json'); assert.equal(run.projectId, 'demo-sgm-local-qa');
  assert.equal(run.runId, '1d6cf0c01fe85db4566bb5610e13d919'); assert.equal(run.scope, 'local-ui-not-physical-device');
  assert.equal(run.testCount, 35); assert.equal(run.nativeCaseCount, 37); assert.equal(run.steps.length, 35);
  assert(run.steps.every((step) => step.status === 'passed')); assert.equal(new Set(run.steps.map((step) => step.id)).size, 35);
  assert.deepEqual(json(sub + 'native-suite-status.json'), { scope: 'native-suite-exit-status-not-flow-verification',
    ordinaryTests: 0, componentEvidence: 0, localReplay: 0 });
  const restore = json(sub + 'disposable-store-restore.json'); assert.equal(restore.restored, true); assert.equal(restore.verified, true);
});
test('the later interrupted ordinary run remains failed even though its team cases and separate local replay pass', () => {
  const sub = 'docs/release/evidence/team-screen-export-2026-10-18/later-update-interruption/';
  const hashes = json(sub + 'artifact-sha256.json'); assert.equal(Object.keys(hashes).length, 6);
  for (const [path, hash] of Object.entries(hashes)) assert.equal(sha(read(sub + path)), hash, path);
  const suite = new XMLParser({ ignoreAttributes: false }).parse(text(sub + 'ordinary-tests.xml')).testsuite;
  assert.equal(Number(suite['@_tests']), 135); assert.equal(Number(suite['@_skipped']), 33); assert.equal(Number(suite['@_failures']), 1);
  const team = suite.testcase.filter((item) => item['@_classname'] === 'be.sportgreenmoove.app.ui.TeamEnrollmentFlowTest');
  assert.equal(team.length, 4); assert(team.every((item) => !('failure' in item) && !('error' in item) && !('skipped' in item)));
  const setup = json(sub + 'disposable-device-setup.json'); assert.equal(setup.mapsRuntime.playServicesVersion, '24.23.35');
  const journal = json(sub + 'OrdinaryUiSuite-install-sessions.txt');
  assert(journal.sections.flatMap((section) => section.sessions).some((item) => item.appPackageName === 'com.google.android.gms' && item.mSessionApplied === true));
  assert.equal(json(sub + 'disposable-store-restore.json').verified, false);
  assert.deepEqual(json(sub + 'native-suite-status.json'), { scope: 'native-suite-exit-status-not-flow-verification',
    ordinaryTests: 1, componentEvidence: 0, localReplay: 0 });
  const replay = json(sub + 'local-replay.json'); assert.equal(replay.testCount, 35); assert.equal(replay.steps.length, 35);
  assert(replay.steps.every((step) => step.status === 'passed'));
});
