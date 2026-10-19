import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { parseDocument } from 'yaml';
import { assertRetainedSourceFiles } from '../scripts/qa/retained-source-evidence.mjs';
import { emergencyIdentityUiChecks, emergencyIdentityUiImages, validateEmergencyIdentityDevice } from '../scripts/qa/emergency-identity-ui-evidence.mjs';

const read = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const runId = '1'.repeat(32), bytes = Buffer.alloc(25);
Buffer.from('89504e470d0a1a0a', 'hex').copy(bytes); bytes.writeUInt32BE(320, 16); bytes.writeUInt32BE(720, 20);
const sha = createHash('sha256').update(bytes).digest('hex');
const marker = () => ({ projectId: 'demo-sgm-local-qa', runId, scope: 'local-recreated-child-contact-ui-not-own-child-account',
  checks: emergencyIdentityUiChecks.map((id) => ({ id, status: 'passed' })), physicalDevice: false, dialIntentCount: 0,
  directCallIntentCount: 0, screenshots: Object.fromEntries(emergencyIdentityUiImages.map((name) => [name, sha])) });
const receipt = () => ({ projectId: 'demo-sgm-local-qa', runId, phase: 'emergency-identity',
  scope: 'local-adb-file-sync-command-not-flow-verification', completed: true, status: 0, signal: null, errorCode: null });
test('the retained fixture probes prove local calls and disposal, never native or physical execution', () => {
  const base = 'docs/release/evidence/emergency-identity-ui-prepared-2026-10-19/';
  const root = fileURLToPath(new URL('../', import.meta.url));
  const hashes = JSON.parse(read(base + 'artifact-sha256.json')); assert.equal(Object.keys(hashes).length, 9);
  for (const [file, hash] of Object.entries(hashes))
    assert.equal(createHash('sha256').update(readFileSync(new URL('../' + base + file, import.meta.url))).digest('hex'), hash, file);
  for (const file of ['fixture-services.json', 'fixture-final.json', 'login-after.json']) {
    const report = JSON.parse(read(base + file));
    assert.equal(report.projectId, 'demo-sgm-local-qa'); assert.equal(report.nativeUiExecuted, false);
    assert.equal(report.physicalDevice, false); assert.equal(report.productionWrites, false); assert.equal(report.providerRequests, 0);
    assert.deepEqual(report.isolation, { baselineRecordsPreserved: true, claimsUnchanged: true, baselineCollectionCount: 15,
      contactCount: 2, contactOperationCount: 2, guardianEventCount: 5, oldContactPreserved: true });
    assertRetainedSourceFiles(root, report.sourceFiles);
  }
  const final = JSON.parse(read(base + 'fixture-final.json'));
  for (const key of ['adminClientClosed', 'isolatedEnvironmentDestroyed', 'emulatorCliExitedSuccessfully']) assert.equal(final[key], true);
  assert.deepEqual(final.emulatorEndpoints, { host: '127.0.0.1', ports: [9099, 8080, 9000, 5001], closed: true });
  assertRetainedSourceFiles(root, JSON.parse(read(base + 'login-before-sources.json')));
  assert(read(base + 'login-before.txt').includes('AssertionError [ERR_ASSERTION]: users'));
  assert(read(base + 'login-before.txt').includes('exited with code 1'));
  const login = JSON.parse(read(base + 'login-after.json'));
  for (const key of ['adminClientClosed', 'isolatedEnvironmentDestroyed', 'emulatorCliExitedSuccessfully']) assert.equal(login[key], true);
  assert.deepEqual(login.emulatorEndpoints, final.emulatorEndpoints);
});
test('recreated child UI proof requires five checks, four exact images and its primary transfer', () => {
  validateEmergencyIdentityDevice(marker(), receipt(), runId, () => bytes);
  for (const patch of [{ physicalDevice: true }, { projectId: 'live' }, { runId: '2'.repeat(32) },
    { scope: 'child-own-account' }, { dialIntentCount: 1 }, { directCallIntentCount: 1 },
    { checks: marker().checks.slice(1) }, { checks: marker().checks.toReversed() }, { screenshots: {} }])
    assert.throws(() => validateEmergencyIdentityDevice({ ...marker(), ...patch }, receipt(), runId, () => bytes));
  for (const patch of [{ phase: 'failure-cleanup' }, { completed: false }, { status: 1 }, { errorCode: 'ETIMEDOUT' },
    { signal: 'SIGTERM' }, { runId: '2'.repeat(32) }])
    assert.throws(() => validateEmergencyIdentityDevice(marker(), { ...receipt(), ...patch }, runId, () => bytes));
  assert.throws(() => validateEmergencyIdentityDevice(marker(), receipt(), runId, () => Buffer.from('altered')));
});
test('the actual app test keeps the original open form before host recreation and fresh verification', () => {
  const native = read('android/app/src/androidTest/java/be/sportgreenmoove/app/ui/LocalEmergencyIdentityFlowTest.kt');
  assert(native.includes('BuildConfig.DEBUG && BuildConfig.SGM_USE_FIREBASE_EMULATOR'));
  assert(native.includes('ActivityScenario.launch(MainActivity::class.java)'));
  assert(native.indexOf('edit("Ancien formulaire QA"') < native.indexOf('checkpoint("old-form-open"'));
  assert(native.indexOf('checkpoint("old-form-open"') < native.indexOf('capture("emergency-identity-stale-denied.png")'));
  assert(native.indexOf('checkpoint("old-access-denied"') < native.indexOf('capture("emergency-identity-fresh-empty.png")'));
  for (const text of ['activity.recreate()', 'assertEquals(0, dial.hits)', 'assertEquals(0, direct.hits)',
    'providers.auth.signOut()', 'pending.renameTo']) assert(native.includes(text));
});
test('host verification checks identities, unchanged baseline, claims, old contact and no denied write', () => {
  const fixture = read('scripts/qa/emergency-identity-fixture.mjs');
  for (const text of ['before.createTime.isEqual(after.createTime)', 'fixture.originalContact', 'operations.length, 2',
    "current.revision, 1", "decision.get('revision'), 5", 'assert.deepEqual(await claims(), fixture.claims)',
    "getDatabase().ref('liveTrips')", 'exclude(name, fixture.baseline[name])']) assert(fixture.includes(text), text);
  assert(!fixture.includes('setCustomUserClaims')); assert(!fixture.includes("status: 'verified'"));
  const host = read('scripts/qa/local-emergency-identity-ui.mjs');
  for (const text of ['assertInstrumentationPassed(transcript, 1)', "phase: 'emergency-identity'",
    'validateEmergencyIdentityDevice', 'verifyEmergencyIdentityStoredState(fixture)', 'await deleteApp(getApp())']) assert(host.includes(text));
  assert(host.indexOf('if (failure) throw failure') < host.indexOf("'emergency-identity-app-results.json'"));
  const owner = read('scripts/qa/run-isolated-ride-ui.mjs');
  assert(owner.includes("'emergency-identity': 'local-emergency-identity-ui.mjs'"));
  assert(owner.indexOf('runtime.cleanup()') < owner.indexOf('`${name}-results.json`'));
});
test('the additional trial cannot hide any preceding command failure and is enforced by smoke and native checks', () => {
  const shell = read('scripts/run-focused-android-ui.sh');
  assert(shell.includes('run-local-emergency-identity-ui.mjs'));
  assert(shell.includes('if [[ "$emergency_identity_status" -ne 0 ]]; then exit "$emergency_identity_status"; fi'));
  for (const name of ['observation', 'startup'])
    assert(shell.includes(`if [[ "$${name}_status" -ne 0 ]]; then exit "$${name}_status"; fi`));
  assert(shell.includes('exit "$remote_stop_status"'));
  for (const name of ['native-ci.yml', 'web-integration-smoke.yml']) {
    const workflow = parseDocument(read('.github/workflows/' + name)).toJSON();
    for (const event of ['push', 'pull_request']) assert(workflow.on[event].paths.includes('tests/emergency-identity-ui.test.mjs'));
    assert(Object.values(workflow.jobs).some((job) => job.steps?.some((step) => step.run?.includes('tests/emergency-identity-ui.test.mjs'))));
  }
});
