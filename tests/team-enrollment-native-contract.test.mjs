import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { XMLParser } from 'fast-xml-parser';

const read = (path) => readFileSync(new URL('../' + path, import.meta.url));
const text = (path) => read(path).toString('utf8');
const json = (path) => JSON.parse(text(path));
const sha = (raw) => createHash('sha256').update(raw).digest('hex');
const base = 'docs/release/evidence/local-team-enrollment-native-2026-10-18/';
test('team choices retain all twelve isolated groups without claiming native execution or enrollment approval', () => {
  const report = json(base + 'choices.json'); assert.equal(report.projectId, 'demo-sgm-local-qa');
  assert.match(report.runId, /^[a-f0-9]{32}$/); assert.equal(report.testCount, 12); assert.equal(report.steps.length, 12);
  assert(report.steps.every((item) => item.status === 'passed')); assert.equal(new Set(report.steps.map((item) => item.id)).size, 12);
  assert.equal(report.coverage, 'team-enrollment-choice-discovery-not-native-ui');
  for (const key of ['nativeUiExecuted', 'teamChatImplemented', 'productionWrites']) assert.equal(report[key], false);
  assert.equal(report.providerRequests, 0); assert.equal(report.syntheticTeamChoices, 24);
  assert.equal(report.syntheticChildrenWithActualLocalManagerVerification, 21);
  for (const [path, hash] of Object.entries(report.sourceFiles)) assert.equal(sha(read(path)), hash, path);
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
  for (const [path, hash] of Object.entries(report.sourceFiles)) {
    assert.equal(sha(read(path)), hash, path); assert(text(path).split('\n').length < 300, path);
  }
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
