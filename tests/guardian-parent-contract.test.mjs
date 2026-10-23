import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { XMLParser } from 'fast-xml-parser';
import { guardianParentChecks, guardianParentScreenshots, validateGuardianParentDevice } from '../scripts/qa/guardian-parent-evidence.mjs';
import { assertOriginalPaginationSources } from './helpers/original-pagination-sources.mjs';

const read = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const uid = 'a'.repeat(32);
const png = Buffer.from('89504e470d0a1a0a00000000', 'hex');
const digest = createHash('sha256').update(png).digest('hex');
const marker = () => ({ projectId: 'demo-sgm-local-qa', runId: uid, scope: 'local-native-parent-ui-with-local-sdk-manager-not-physical',
  checks: guardianParentChecks.map((id) => ({ id, status: 'passed' })), screenshots: Object.fromEntries(guardianParentScreenshots.map((name) => [name, digest])) });
const receipt = () => ({ projectId: 'demo-sgm-local-qa', runId: uid, scope: 'local-adb-file-sync-command-not-flow-verification',
  phase: 'guardian-parent-verification', completed: true, status: 0, signal: null, errorCode: null });

test('guardian native proof requires this run, the complete UI assertions and original copied bytes', () => {
  validateGuardianParentDevice(marker(), receipt(), uid, () => png);
  for (const patch of [{ runId: 'b'.repeat(32) }, { projectId: 'production' }, { checks: marker().checks.slice(1) },
    { screenshots: { ...marker().screenshots, 'other.png': digest } }])
    assert.throws(() => validateGuardianParentDevice({ ...marker(), ...patch }, receipt(), uid, () => png));
  const failed = marker(); failed.checks[0].status = 'failed';
  assert.throws(() => validateGuardianParentDevice(failed, receipt(), uid, () => png));
  assert.throws(() => validateGuardianParentDevice(marker(), receipt(), uid, () => Buffer.from('different')));
});
test('failed primary transfer and later cleanup cannot be promoted to guardian UI success', () => {
  for (const patch of [{ phase: 'failure-cleanup' }, { completed: false }, { status: 1 }, { signal: 'SIGTERM' },
    { errorCode: 'ETIMEDOUT' }, { runId: 'b'.repeat(32) }])
    assert.throws(() => validateGuardianParentDevice(marker(), { ...receipt(), ...patch }, uid, () => png));
  const runner = read('scripts/qa/local-android-session.mjs');
  assert(runner.includes("collectEvidence('guardian-parent-verification')"));
  assert(runner.indexOf('await replayGuardianParentUi') < runner.indexOf("instrument(['LocalAppFlowTest'"));
  assert(runner.includes('testCount: 37, nativeCaseCount: 40'));
  assert(read('scripts/qa/collect-local-ui-evidence.mjs').includes("'guardian-parent-verification'"));
  const verifier = read('scripts/qa/local-guardian-parent-ui.mjs');
  assert(verifier.indexOf('readGuardianParentDevice(directory, runId)') < verifier.indexOf("'guardian-parent-results.json'"));
  assert(verifier.includes('assert.deepEqual(await protectedState(), before)'));
  assert(verifier.includes("assert.equal(events.length, 8)"));
});
test('parent reads bind ownership in auth, use fresh canonical state and do not grant verification', () => {
  const callables = read('functions/src/callables/guardianParent.ts'), service = read('functions/src/services/guardianParent.ts');
  assert(callables.includes('requireAuth(request.auth?.uid)')); assert(callables.includes('.strict()'));
  assert(service.includes('guardianVerificationId(clubId, childId, uid)'));
  assert(service.includes('firestore.runTransaction'));
  assert(service.includes('if (!verification.exists && !eligible)'));
  assert(service.includes('childName: linked ?'));
  assert.doesNotMatch(service, /transaction\.(set|create|update|delete)\(/);
  const gateway = read('android/app/src/main/java/be/sportgreenmoove/app/services/FirebaseAndroidGuardianGateway.kt');
  assert.equal(gateway.split('requireSession(uid)').length - 1, 2);
  assert(gateway.includes('before.revision == request.expectedRevision'));
  const state = read('android/app/src/main/java/be/sportgreenmoove/app/ui/GuardianVerificationState.kt');
  assert(state.includes('view !== expected')); assert(state.includes('receipt.revision > expected.revision'));
  assert(state.includes('currentCoroutineContext().ensureActive()'));
  const model = read('android/app/src/main/java/be/sportgreenmoove/app/data/GuardianVerificationModels.kt');
  assert.match(model, /enum class GuardianParentAction[^\n]+Request\("request"\), Withdraw\("withdraw"\)/);
});
test('parent flow code stays modular and its device replay remains explicitly local', () => {
  const base = 'android/app/src/main/java/be/sportgreenmoove/app/';
  for (const file of ['ui/GuardianVerificationState.kt', 'ui/GuardianVerificationScreen.kt', 'ui/GuardianVerificationRoute.kt',
    'ui/GuardianVerificationDialogs.kt', 'ui/GuardianPageState.kt', 'services/FirebaseAndroidGuardianGateway.kt', 'services/GuardianVerificationWire.kt'])
    assert(read(base + file).split('\n').length < 300, file);
  const replay = read('android/app/src/androidTest/java/be/sportgreenmoove/app/ui/LocalGuardianVerificationFlowTest.kt');
  assert(replay.includes('BuildConfig.DEBUG && BuildConfig.SGM_USE_FIREBASE_EMULATOR'));
  assert(replay.includes('assertNull(initial.status)')); assert(replay.includes('activity.recreate()'));
  assert(replay.includes('requireNotNull(initial.childName)).assertDoesNotExist()'));
  assert(replay.includes('waitFor(hasTestTag(tag) and isEnabled())'));
  assert(replay.includes('compose.waitUntil(60_000)'));
  assert(read(base + 'ui/SportsGreenMooveApp.kt').includes('AppScreen.Guardians -> GuardianVerificationRoute'));
});

test('retained parent service and unit proofs cannot be presented as an executed native UI run', () => {
  const base = 'docs/release/evidence/local-guardian-parent-2026-10-18/';
  const sha = (value) => createHash('sha256').update(value).digest('hex');
  const services = JSON.parse(read(base + 'services.json'));
  assert.equal(sha(read(base + 'services.json')), '37f0342dc2c5ba54436850b7ab824052edd67e9ee2e248fbf20fc978e5ee5ca5');
  assert.equal(services.runId, '2d8dcd75f0a49550daddca977b0a7b36');
  assert.equal(services.checks.length, 13); assert(services.checks.every((check) => check.status === 'passed'));
  assert.equal(services.nativeUiExecuted, false); assert.equal(services.physicalDevice, false);
  assert.equal(services.providerRequests, 0); assert.equal(services.productionWrites, false);
  const build = JSON.parse(read(base + 'build-checks.json'));
  assert.equal(build.nativeUiExecuted, false); assert.equal(build.nativeTestApkCompiled, true);
  const parser = new XMLParser({ ignoreAttributes: false });
  let cases = 0;
  const hashes = JSON.parse(read(base + 'artifact-sha256.json'));
  for (const [file, digest] of Object.entries(hashes)) {
    assert.equal(sha(readFileSync(new URL('../' + base + file, import.meta.url))), digest, file);
    if (file.endsWith('.xml')) {
      const suite = parser.parse(read(base + file)).testsuite;
      assert.equal(Number(suite['@_failures']), 0); assert.equal(Number(suite['@_errors']), 0); assert.equal(Number(suite['@_skipped']), 0);
      cases += Number(suite['@_tests']);
    }
  }
  assert.equal(cases, 17);
  assertOriginalPaginationSources({ ...services.sourceFiles, ...build.sourceFiles }, ['functions/src/callables/guardianParent.ts',
    'android/app/src/main/java/be/sportgreenmoove/app/services/GuardianVerificationWire.kt']);
  for (const file of ['backend-ci.yml', 'web-integration-smoke.yml'])
    assert(read('.github/workflows/' + file).includes('npm run test:guardian-parent && node --test tests/guardian-parent-contract.test.mjs'));
});

test('the failed parent replay preserves ordinary component passes without inventing a successful app replay', () => {
  const base = 'docs/release/evidence/guardian-parent-loading-failure-2026-10-18/';
  for (const [file, digest] of Object.entries(JSON.parse(read(base + 'artifact-sha256.json'))))
    assert.equal(createHash('sha256').update(read(file.startsWith(base) ? file : base + file)).digest('hex'), digest, file);
  const suite = new XMLParser({ ignoreAttributes: false }).parse(read(base + 'ordinary-tests.xml')).testsuite;
  assert.equal(Number(suite['@_tests']), 129); assert.equal(Number(suite['@_skipped']), 32);
  assert.equal(Number(suite['@_failures']), 0); assert.equal(Number(suite['@_errors']), 0);
  const cases = suite.testcase.filter((item) => item['@_classname'] === 'be.sportgreenmoove.app.ui.GuardianVerificationFlowTest');
  assert.equal(cases.length, 4);
  assert(cases.every((item) => !Object.hasOwn(item, 'skipped') && !Object.hasOwn(item, 'failure')));
  const transcript = read(base + 'local-instrumentation.txt');
  assert(transcript.includes("Tag: 'guardian.child'")); assert(transcript.includes('[Disabled]'));
  assert(transcript.includes('FAILURES!!!')); assert(transcript.includes('assertIsEnabled'));
  const cleanup = JSON.parse(read(base + 'adb-pull-failure-cleanup.json'));
  assert.equal(cleanup.runId, 'b2bd4c4e01584c9678b8c087a2d328db');
  assert.equal(cleanup.phase, 'failure-cleanup'); assert.equal(cleanup.completed, false); assert.equal(cleanup.status, 1);
});

test('the completed parent stage requires its original marker, primary transfer, captures and audit proof despite the failed whole run', () => {
  const base = 'docs/release/evidence/local-guardian-parent-native-2026-10-18/';
  const raw = read(base + 'guardian-parent-results.json'), report = JSON.parse(raw);
  assert.equal(createHash('sha256').update(raw).digest('hex'), 'eb5ba17a72f560ac4781819b05e7cb7913a70c0eb05b088355182f5021d91838');
  assert.equal(report.runId, 'dcaf30b6b6b5e66753fa2709163d44a8');
  validateGuardianParentDevice(JSON.parse(read(base + 'guardian-parent-device.json')),
    JSON.parse(read(base + 'adb-pull-guardian-parent-verification.json')), report.runId,
    (file) => readFileSync(new URL('../' + base + file, import.meta.url)));
  assert.equal(report.testCount, 1); assert.equal(report.nativeCaseCount, 1);
  assert.deepEqual(report.steps, [{ id: 'guardian-parent-ui', status: 'passed' }]);
  assert.equal(report.auditEventCount, 8); assert.equal(report.revision, 8); assert.equal(report.status, 'revoked');
  assert.equal(report.managerDecisionMethod, 'authenticated-local-sdk-not-management-ui');
  assert.equal(report.physicalDevice, false); assert.equal(report.productionWrites, false);
  assert.match(read(base + 'LocalGuardianVerificationFlowTest-instrumentation.txt'), /OK \(1 test\)/);
  assert.equal(createHash('sha256').update(read(base + 'LocalGuardianVerificationFlowTest-instrumentation.txt')).digest('hex'), report.transcriptSha256);
  assertOriginalPaginationSources(report.sourceFiles, ['functions/src/callables/guardianParent.ts',
    'android/app/src/main/java/be/sportgreenmoove/app/services/GuardianVerificationWire.kt']);
  const whole = JSON.parse(read(base + 'full-run/native-suite-status.json'));
  assert.equal(whole.ordinaryTests, 1); assert.equal(whole.componentEvidence, 0); assert.equal(whole.localReplay, 1);
  const store = JSON.parse(read(base + 'full-run/disposable-store-restore.json'));
  assert.equal(store.restored, true); assert.equal(store.verified, false);
  assert(read(base + 'full-run/LocalChatNetworkFlowTest-instrumentation.txt').includes('FAILURES!!!'));
});
