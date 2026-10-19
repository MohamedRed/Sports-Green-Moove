import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { XMLParser } from 'fast-xml-parser';
import { fileURLToPath } from 'node:url';
import { assertRetainedSourceFiles } from '../scripts/qa/retained-source-evidence.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const text = (file) => readFileSync(new URL('../' + file, import.meta.url), 'utf8');
const native = (file) => text('android/app/src/main/java/be/sportgreenmoove/app/' + file + '.kt');
const base = 'docs/release/evidence/team-enrollment-history-2026-10-19/';

test('owned history uses only the authenticated requester and immutable team identity without direct writes', () => {
  const service = text('functions/src/services/teamEnrollmentHistory.ts');
  for (const guard of ['requireEnrollmentRequester(token, false)', 'current.requesterUserId !== uid',
    'where("requesterUserId", "==", uid)', 'query.limit(21)', 'page.docs.slice(0, 20)',
    'context?.teamInstanceId === current.teamInstanceId', 'hasRole(token, "parent")', 'subjectName = label',
    'current.status === "requested" || eligible', '[uid, "owned-team-enrollments"]']) assert(service.includes(guard), guard);
  assert(!/transaction\.(create|set|update|delete)\(/.test(service));
  const callable = text('functions/src/callables/teamEnrollmentHistory.ts');
  assert(callable.includes('requireAuth(request.auth?.uid)')); assert(callable.includes('.strict()'));
  assert(text('functions/src/index.ts').includes('listOwnedTeamEnrollments, getOwnedTeamEnrollmentView'));
});
test('history transport re-reads the exact owned revision and never substitutes active club discovery', () => {
  const gateway = native('services/FirebaseAndroidTeamEnrollmentGateway');
  const method = gateway.slice(gateway.indexOf('override suspend fun withdrawOwnedTeamEnrollment'));
  assert(method.includes('val current = ownedTeamEnrollmentView(uid, expected.id)'));
  assert(!method.includes('teamEnrollmentView(uid,')); assert(!method.includes('teamOptions('));
  for (const guard of ['current.revision == expected.revision', 'current.subjectId == expected.subjectId',
    'current.childId == expected.childId', 'TeamEnrollmentAction.Withdraw in current.allowedActions',
    '"transitionTeamEnrollment"', 'it.status == TeamEnrollmentStatus.Withdrawn']) assert(method.includes(guard), guard);
  const wire = native('services/TeamEnrollmentHistoryWire');
  assert(wire.includes('map["requesterUserId"] == uid')); assert(wire.includes('view.status != null && view.revision > 0'));
  assert(wire.includes('view.subjectName == null')); assert(wire.includes('view.allowedActions.isEmpty()'));
});
test('history and current requests have separate disposable state and confirmations cannot use stale page objects', () => {
  const route = native('ui/TeamEnrollmentRoute'), state = native('ui/TeamEnrollmentHistoryState');
  assert(route.includes('if (history) TeamEnrollmentHistoryRoute')); assert(route.includes('else TeamEnrollmentRequestRoute'));
  for (const guard of ['selected !== expected', 'view.teamInstanceId == expected.teamInstanceId', 'currentCoroutineContext().ensureActive()',
    'view.revision >= expected.revision', 'requests.close()', 'fun close()', 'Retrait non confirmé']) assert(state.includes(guard), guard);
  const history = native('ui/TeamEnrollmentHistoryRoute');
  assert(history.includes('showSelected = confirm == null')); assert(history.includes('repeatOnLifecycle'));
  assert(history.includes('state.clear()')); assert(history.includes('team-history.confirm')); assert(history.includes('team-history.keep'));
});
test('four component scenarios compile independently of actual service and phone evidence', () => {
  const file = 'android/app/src/androidTest/java/be/sportgreenmoove/app/ui/TeamEnrollmentHistoryFlowTest.kt';
  const component = text(file); assert.equal((component.match(/@Test fun/g) ?? []).length, 4);
  assert(component.includes('HistoryUiFixture')); assert(component.includes('fontScale = 1.3f'));
  assert(component.includes('Modifier.width(320.dp)')); assert(component.includes('fixture.writes.isEmpty()'));
  assert(component.includes('capture("team-history-redacted-child.png", dialog = true)'));
  assert(component.includes('captureLocalUi(compose, name, dialog = dialog, landscape = dialog)'));
  for (const image of ['team-history-paging.png', 'team-history-redacted-child.png'])
    assert(text('scripts/run-android-ui-tests-and-collect-screenshots.sh').includes(image));
  assert.equal((text('android/app/src/test/java/be/sportgreenmoove/app/services/TeamEnrollmentHistoryWireTest.kt').match(/@Test fun/g) ?? []).length, 6);
  assert.equal((text('android/app/src/test/java/be/sportgreenmoove/app/ui/TeamEnrollmentHistoryStateTest.kt').match(/@Test fun/g) ?? []).length, 9);
});
test('the retained fourteen-group service replay does not claim native history or conversation success', () => {
  const report = JSON.parse(text(base + 'services.json'));
  assert.equal(report.projectId, 'demo-sgm-local-qa'); assert.equal(report.coverage, 'owned-team-enrollment-history');
  assert.equal(report.testCount, 14); assert.equal(report.checks.length, 14);
  assert(report.checks.every((item) => item.status === 'passed')); assert.equal(new Set(report.checks.map((item) => item.id)).size, 14);
  for (const key of ['nativeUiExecuted', 'physicalDevice', 'productionWrites', 'teamChatImplemented']) assert.equal(report[key], false);
  assert.equal(report.providerRequests, 0); assertRetainedSourceFiles(root, report.sourceFiles);
});
test('all CI entry points cover current history source and the real isolated service replay', () => {
  for (const name of ['backend-ci.yml', 'web-integration-smoke.yml']) {
    const workflow = text('.github/workflows/' + name);
    assert(workflow.includes('npm run test:team-enrollment-history')); assert(workflow.includes('tests/team-enrollment-history-contract.test.mjs'));
  }
  const workflow = text('.github/workflows/native-ci.yml');
  assert(workflow.includes('node --test tests/team-enrollment-history-contract.test.mjs'));
  assert.equal(workflow.split('"tests/team-enrollment-history-contract.test.mjs"').length - 1, 2);
});
test('the original Android unit reports contain fifteen executed passes with source and artifact bindings', () => {
  const report = JSON.parse(text(base + 'unit-sources.json'));
  assert.equal(report.scope, 'executed-android-jvm-history-unit-tests-not-ui');
  assertRetainedSourceFiles(root, report.sourceFiles);
  let count = 0;
  for (const [file, expected] of Object.entries(report.artifacts)) {
    const raw = readFileSync(new URL('../' + base + file, import.meta.url));
    assert.equal(createHash('sha256').update(raw).digest('hex'), expected);
    const suite = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '', parseAttributeValue: true }).parse(raw.toString()).testsuite;
    for (const key of ['failures', 'errors', 'skipped']) assert.equal(suite[key], 0);
    assert.equal(suite.testcase.length, suite.tests); count += suite.tests;
  }
  assert.equal(count, 15);
});
test('the original narrow-dialog capture failure stays failed and cannot be replaced by the physical replay', () => {
  const path = 'docs/release/evidence/team-history-dialog-failure-2026-10-19/';
  const report = JSON.parse(text(path + 'results.json'));
  assert.equal(report.scope, 'failed-native-history-dialog-capture-not-complete-suite');
  assert.equal(report.dialogCaptureSucceeded, false); assert.equal(report.historyCases, 4);
  assert.equal(report.historyPassed, 3); assert.equal(report.historyFailed, 1);
  assertRetainedSourceFiles(root, report.sourceFiles);
  const suite = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '', parseAttributeValue: true }).parse(text(path + 'ordinary-tests.xml')).testsuite;
  assert.equal(suite.tests, 154); assert.equal(suite.skipped, 34); assert.equal(suite.failures, 1); assert.equal(suite.errors, 0);
  const cases = suite.testcase.filter((item) => item.classname.endsWith('TeamEnrollmentHistoryFlowTest'));
  assert.equal(cases.length, 4); assert.equal(cases.filter((item) => item.failure).length, 1);
  assert.match(cases.find((item) => item.failure).failure, /found '2' nodes that satisfy: \(isRoot\)/);
  assert.deepEqual(JSON.parse(text(path + 'native-suite-status.json')),
    { scope: 'native-suite-exit-status-not-flow-verification', ordinaryTests: 1, componentEvidence: 0, localReplay: 0 });
  for (const [file, expected] of Object.entries(JSON.parse(text(path + 'artifact-sha256.json'))))
    assert.equal(createHash('sha256').update(readFileSync(new URL('../' + path + file, import.meta.url))).digest('hex'), expected);
});
