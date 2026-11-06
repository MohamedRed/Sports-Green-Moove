import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync, cpSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { buildAndroidMatrixApks } from '../scripts/qa/build-android-matrix-apks.mjs';
import { matrixPackages, ordinaryPackages, pinnedPackages, assertMatrixApkMetadata } from '../scripts/qa/android-case-apks.mjs';
import { preparePinnedApks, usePreinstalledTestApks } from '../scripts/qa/preinstalled-disposable-apks.mjs';
import { prepareMatrixReplay, usePreinstalledMatrixReplay } from '../scripts/qa/prepare-matrix-replay.mjs';
import { restoreContinuousDevice } from '../scripts/qa/continuous-disposable-device.mjs';
import { continuousFixture, assertNoGuardedInstallOrUnlock } from './fixtures/continuous-disposable-device.mjs';
import { resetDisposableTestApps } from '../scripts/qa/reset-disposable-local-apps.mjs';
import YAML from 'yaml';
import { validatePreinstalledMatrixEvidence } from '../scripts/qa/native-preinstalled-matrix-evidence.mjs';
import { nativeRechecks } from '../partner-portal/native-rechecks.mjs';
import {matrix964Folder, validateMatrix964Evidence} from '../scripts/qa/native-matrix-964-evidence.mjs';
import {createHash} from 'node:crypto';
import {nativeMatrix964Progress} from '../partner-portal/native-matrix-964.mjs';
import {content} from '../partner-portal/content.mjs';
import {partitionUpdates} from '../partner-portal/src/render.js';

const ordinary = f => preparePinnedApks({ android: f.android, serial: f.device.serial, env: f.env, device: f.device });
const replay = f => prepareMatrixReplay({ android: f.android, serial: f.device.serial, env: f.env, device: f.device });
const fixture = t => continuousFixture(t, { case: 'full-matrix', storeWakes: true });
const clearNames = f => f.events.filter(row => row.command.startsWith('pm clear ')).map(row => row.args[2]);

test('the later completed 37-group native replay is distinct from its cancelled workflow and newer source', () => {
  const report = validateMatrix964Evidence(process.cwd());
  assert.equal(report.nativeJobPassed, true); assert.equal(report.localFlowGroupsPassed, 37);
  assert.equal(report.nativeReplayCasesPassed, 40); assert.equal(report.wholeWorkflowPassed, false);
  assert.equal(report.ordinaryStopCandidateAccepted, false); assert.equal(report.physicalDeviceAccepted, false);
  assert.equal(content.nativeMatrix964.source, matrix964Folder + '/summary.json');
  const {recent, previous} = partitionUpdates(content.updates);
  assert(recent.some(row => row.source === nativeMatrix964Progress.source));
  assert(recent.some(row => row.source.includes('ios-fixture-gate-0fb9968')));
  assert(previous.some(row => row.source.includes('ios-fixture-recheck-9640d8b')));
  assert(previous.some(row => row.source.includes('native-copy-376addb')));
  assert.doesNotMatch(nativeMatrix964Progress.title + nativeMatrix964Progress.text, /Firebase|BrowserStack|Android|SDK|Swift|CI\b/i);
});
for (const [file, mutate] of [
  ['summary.json', row => { row.wholeWorkflowPassed = true; }],
  ['summary.json', row => { row.currentHeadAccepted = true; }],
  ['summary.json', row => { row.ordinaryStopCandidateAccepted = true; }],
  ['summary.json', row => { row.physicalDeviceAccepted = true; }],
  ['suite-status.json', row => { row.localReplay = 1; }],
  ['replay-results.json', row => { row.steps[0].status = 'failed'; }],
  ['replay-results.json', row => { delete row.tripChangeInputs; }],
  ['device-restoration.json', row => { row.restoration.launcher = false; }],
  ['copies/adb-pull-trip-change-parent-confirmation.json', row => { row.stdout = ''; row.stderr = ''; }],
  ['artifact-metadata.json', row => { row.digest = 'sha256:' + '0'.repeat(64); }],
]) test('completed native evidence rejects resealed unsupported claims: ' + file + ' ' + mutate, t => {
  const root = mkdtempSync(resolve(tmpdir(), 'sgm-matrix964-unit-')); t.after(() => rmSync(root, {recursive: true, force: true}));
  const base = resolve(root, matrix964Folder); cpSync(resolve(process.cwd(), matrix964Folder), base, {recursive: true});
  const path = resolve(base, file), value = JSON.parse(readFileSync(path)); mutate(value); writeFileSync(path, JSON.stringify(value));
  const sha = file => createHash('sha256').update(readFileSync(resolve(base, file))).digest('hex');
  const hashes = JSON.parse(readFileSync(resolve(base, 'artifact-sha256.json'))); hashes[file] = sha(file);
  const archive = JSON.parse(readFileSync(resolve(base, 'original-archive.json'))), member = archive.members.find(row => row.file === file);
  if (member) { member.sha256 = sha(file); member.bytes = readFileSync(path).length;
    writeFileSync(resolve(base, 'original-archive.json'), JSON.stringify(archive)); hashes['original-archive.json'] = sha('original-archive.json'); }
  writeFileSync(resolve(base, 'artifact-sha256.json'), JSON.stringify(hashes));
  assert.throws(() => validateMatrix964Evidence(root));
});

function ordinaryWorkers(t, { stubborn = false, inventory } = {}) {
  const f = fixture(t), names = Object.keys(ordinaryPackages);
  f.prepareAndSave(); ordinary(f); const setupEvents = f.events.splice(0);
  const live = new Set([...names, names[0] + ':worker', 'be.sportgreenmoove.app.local', 'unrelated.process']);
  const original = f.device.shell;
  f.device.shell = (...args) => {
    if (args[0] === 'pm' && args[1] === 'clear')
      assert(![...live].some(name => names.some(pkg => name === pkg || name.startsWith(pkg + ':'))),
        'The next stage must not start while ordinary workers are alive');
    const value = original(...args);
    if (args.join(' ') === 'ps -A -w -o NAME') {
      if (inventory instanceof Error) throw inventory;
      return inventory ?? 'NAME\ninit\n' + [...live].join('\n');
    }
    if (args[0] === 'am' && args[1] === 'force-stop' && !stubborn)
      for (const name of live) if (name === args[2] || name.startsWith(args[2] + ':')) live.delete(name);
    return value;
  };
  return { f, live, names, setupEvents };
}

test('the full replay stops and verifies only owned ordinary workers before clearing local data', t => {
  const { f, live, names, setupEvents } = ordinaryWorkers(t);
  const result = replay(f);
  assert.deepEqual([...live].sort(), ['be.sportgreenmoove.app.local', 'unrelated.process']);
  const stops = f.events.filter(row => row.command.startsWith('am force-stop '));
  assert.deepEqual(stops.map(row => row.args[2]), [...names].reverse());
  assert(stops.every(row => row.blocked));
  const stopReceipt = JSON.parse(readFileSync(f.env.SGM_PREINSTALLED_TEST_APKS_RECEIPT + '.replay-stopped.json'));
  assert.equal(stopReceipt.scope, 'ordinary-matrix-process-stop-not-flow-proof');
  assert(!JSON.stringify(stopReceipt).includes('unrelated.process'));
  assert(!JSON.stringify(stopReceipt).includes('be.sportgreenmoove.app.local'));
  assert.deepEqual(stopReceipt.packages, names.map((packageName, index) => ({
    packageName, beforeCount: index === 0 ? 2 : 1, afterCount: 0,
  })));
  assert.deepEqual(result.ordinaryProcessStop, stopReceipt);
  assertNoGuardedInstallOrUnlock([...setupEvents, ...f.events]);
  assert.deepEqual(clearNames(f), Object.keys(pinnedPackages));
});

for (const [label, options] of [
  ['surviving ordinary worker', { stubborn: true }], ['empty inventory', { inventory: '' }],
  ['wrong inventory header', { inventory: 'PID NAME\n12 unrelated.process' }],
  ['malformed inventory', { inventory: 'NAME\npermission denied' }],
  ['oversized inventory', { inventory: 'NAME\n' + 'x'.repeat(65536) }],
  ['inventory transport error', { inventory: new Error('synthetic inventory error') }],
]) test('full replay refuses to continue after ' + label, t => {
  const { f } = ordinaryWorkers(t, options);
  assert.throws(() => replay(f)); assert.deepEqual(clearNames(f), []);
  assert(!existsSync(f.env.SGM_PREINSTALLED_TEST_APKS_RECEIPT + '.replay-stopped.json'));
  const stops = () => f.events.filter(row => row.command.startsWith('am force-stop ')).length;
  const before = stops();
  assert.throws(() => replay(f), { code: 'EEXIST' }); assert.equal(stops(), before);
  assert.deepEqual(clearNames(f), []);
});

test('ordinary instrumentation has no class, package, annotation or sharding filter and both CI gates cover this contract', () => {
  const source = readFileSync(new URL('../scripts/qa/run-ordinary-android-ui.mjs', import.meta.url), 'utf8');
  assert(source.includes("'instrument', '-w', '-r'")); assert(source.includes('be.sportgreenmoove.app.test/${disposableTestRunner}'));
  for (const name of ['class', 'package', 'annotation', 'notAnnotation', 'numShards', 'shardIndex', 'log'])
    assert(!source.includes(`'-e', '${name}'`));
  assert(source.includes('requireOrdinaryInstrumentation(result, transcript'));
  const validation = readFileSync(new URL('../scripts/qa/ordinary-process-observation.mjs', import.meta.url), 'utf8');
  assert(validation.includes('return parseAndroidJUnitTranscript(transcript)'));
  for (const name of ['native-ci.yml', 'web-integration-smoke.yml']) {
    const text = readFileSync(new URL('../.github/workflows/' + name, import.meta.url), 'utf8');
    assert.equal(text.split('"tests/android-matrix-preparation.test.mjs"').length - 1, 2);
    assert(text.includes('node --test tests/android-junit-transcript.test.mjs tests/android-matrix-preparation.test.mjs'));
  }
  const steps = YAML.parse(readFileSync(new URL('../.github/workflows/native-ci.yml', import.meta.url), 'utf8')).jobs['android-native-ui'].steps;
  const wait = steps.findIndex(step => step.run === 'node scripts/qa/observe-emulator-shutdown.mjs wait full-matrix');
  assert(wait > steps.findIndex(step => step.uses === 'reactivecircus/android-emulator-runner@v2'));
  assert(wait < steps.findIndex(step => step.uses === 'actions/upload-artifact@v7'));
  assert(steps[wait].if.includes('always()'));
  const retained = steps.find(step => step.uses === 'actions/upload-artifact@v7').with.path;
  assert(retained.includes('matrix-apks/manifest.json')); assert(retained.includes('matrix-apks/**/output-metadata.json'));
  assert(!retained.includes('matrix-apks/**\n')); assert(!retained.includes('*.apk'));
});

test('four exact APKs install before a continuous lock across ordinary and complete replay stages', t => {
  const f = fixture(t), receipt = f.prepareAndSave();
  assert.deepEqual(Object.keys(receipt.apkHashes), Object.keys(matrixPackages));
  assert.equal(f.events.filter(row => row.kind === 'command').length, 4);
  ordinary(f); const result = replay(f);
  assert.equal(result.installationsRemainedBlocked, true);
  assert.deepEqual(clearNames(f), [...Object.keys(matrixPackages), ...Object.keys(pinnedPackages)]);
  assert.equal(result.method, 'preinstalled-full-matrix-replay-without-install-window');
  assertNoGuardedInstallOrUnlock(f.events);
  const restoration = restoreContinuousDevice(f.device, receipt, f.execute, f.deps);
  assert.equal(restoration.verified, true); assert.equal(restoration.restored, true);
  assert.equal(f.state.installed.size, 0); assert.equal(f.state.owner, false); assert.equal(f.state.launcher, true);
});

for (const [label, mutate] of [
  ['not CI', f => { delete f.env.GITHUB_ACTIONS; }], ['not Linux', f => { f.env.RUNNER_OS = 'macOS'; }],
  ['no receipt', f => { delete f.env.SGM_PREINSTALLED_TEST_APKS_RECEIPT; }],
  ['different serial', f => { f.device.serial = 'emulator-5556'; }],
  ['guard lost', f => { f.state.blocked = false; }],
  ['ordinary APK changed', f => { f.state.digests = { 'be.sportgreenmoove.app': '0'.repeat(64) }; }],
  ['local test APK lost', f => { f.state.installed.delete('be.sportgreenmoove.app.local.test'); }],
]) test(`full replay rejects ${label} without clearing or reinstalling`, t => {
  const f = fixture(t); f.prepareAndSave(); ordinary(f); mutate(f); f.events.length = 0;
  assert.throws(() => replay(f)); assert.deepEqual(clearNames(f), []);
  assert(!f.events.some(row => row.command.startsWith('am force-stop ')));
  assert(!f.events.some(row => row.kind === 'command' || row.command.includes('SET_BLOCKED --ez blocked false')));
});

test('explicit full-matrix mode never silently chooses legacy installation on a missing receipt', t => {
  const f = fixture(t); assert.equal(usePreinstalledMatrixReplay(f.env), true);
  assert.equal(usePreinstalledMatrixReplay({}), false);
  for (const env of [{...f.env, SGM_FOCUSED_UI_CASE: undefined}, {...f.env, SGM_FOCUSED_UI_CASE: 'native-startup'},
    {...f.env, SGM_PREINSTALLED_TEST_APKS_RECEIPT: undefined}, {...f.env, SGM_PREINSTALLED_TEST_APKS_RECEIPT: ''},
    {...f.env, GITHUB_ACTIONS: undefined}]) assert.throws(() => usePreinstalledMatrixReplay(env));
  delete f.env.SGM_PREINSTALLED_TEST_APKS_RECEIPT;
  assert.throws(() => usePreinstalledTestApks(f.env)); assert.equal(f.events.length, 0);
});
test('stale matrix metadata prevents device mutation and a partial four-APK install independently rolls back', t => {
  const stale = fixture(t), metadata = resolve(stale.android, 'app/build/outputs/matrix-apks/ordinary-test/output-metadata.json');
  const row = JSON.parse(readFileSync(metadata)); row.applicationId = 'be.sportgreenmoove.app.local.test';
  writeFileSync(metadata, JSON.stringify(row)); assert.throws(stale.prepare);
  assert.equal(stale.events.length, 0);
  const f = continuousFixture(t, { case: 'full-matrix', before: (event, state) => {
    if (event.kind === 'command' && state.installed.size === 2) throw new Error('third APK refused');
  } });
  assert.throws(f.prepare, failure => {
    assert.equal(failure.errors[0].message, 'third APK refused');
    assert.equal(failure.receipt.cleanup.localPackagesRemoved, true);
    assert.equal(failure.receipt.cleanup.adminRemoved, true); return true;
  });
  assert.equal(f.state.installed.size, 0); assert.equal(f.state.owner, false); assert.equal(f.state.blocked, false);
});
test('replay needs the ordinary claim and can be claimed once only, even if local clear fails', t => {
  const f = fixture(t); f.prepareAndSave(); assert.throws(() => replay(f), { code: 'ENOENT' });
  assert.deepEqual(clearNames(f), []); ordinary(f); replay(f);
  assert.throws(() => replay(f), { code: 'EEXIST' }); assert.equal(clearNames(f).length, 6);
  const failure = continuousFixture(t, { case: 'full-matrix', before: (row) => {
    if (row.command === 'pm clear be.sportgreenmoove.app.local' && existsSync(failure.env.SGM_PREINSTALLED_TEST_APKS_RECEIPT + '.replay.claimed'))
      throw new Error('unit clear failure');
  } });
  failure.prepareAndSave(); ordinary(failure); assert.throws(() => replay(failure), /unit clear failure/);
  assert.throws(() => replay(failure), { code: 'EEXIST' });
});

test('full cleanup removes exactly all four owned packages in test-before-app order', () => {
  const names = Object.keys(matrixPackages).reverse(), installed = new Set(names), calls = [];
  const execute = (_adb, args) => {
    calls.push(args); const command = args.slice(2).join(' ');
    if (command === 'wait-for-device') return '';
    if (command === 'get-state') return 'device';
    if (command === 'shell getprop ro.kernel.qemu') return '1';
    if (command.startsWith('shell pm list packages')) return [...installed].map(name => 'package:' + name).join('\n');
    if (args[2] === 'uninstall') { installed.delete(args[3]); return 'Success'; }
    throw new Error('Unexpected fixture command: ' + command);
  };
  const original = process.env.SGM_LOCAL_DISPOSABLE_EMULATOR;
  process.env.SGM_LOCAL_DISPOSABLE_EMULATOR = 'true';
  try { resetDisposableTestApps('adb', 'emulator-5554', names, execute); }
  finally {
    if (original === undefined) delete process.env.SGM_LOCAL_DISPOSABLE_EMULATOR;
    else process.env.SGM_LOCAL_DISPOSABLE_EMULATOR = original;
  }
  assert.deepEqual(calls.filter(args => args[2] === 'uninstall').map(args => args[3]), names);
  assert.equal(installed.size, 0);
  assert.throws(() => resetDisposableTestApps('adb', 'emulator-5554', [...names, 'foreign.package'], execute));
});

function builderFixture(t, { failBuild = 0, wrongMetadata = false } = {}) {
  const root = mkdtempSync(resolve(tmpdir(), 'sgm-matrix-build-unit-')); t.after(() => rmSync(root, { recursive: true, force: true }));
  const calls = [], output = resolve(root, 'android/app/build/outputs');
  const execute = (_command, args) => {
    calls.push(args); if (calls.length === failBuild) throw new Error('unit build failure');
    const isolated = args.includes('-PSGM_USE_FIREBASE_EMULATOR=true');
    for (const [applicationId, relative] of Object.entries(isolated ? pinnedPackages : ordinaryPackages)) {
      const path = resolve(output, relative); mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, 'synthetic bytes, never an APK: ' + applicationId);
      writeFileSync(resolve(dirname(path), 'output-metadata.json'), JSON.stringify({ applicationId: wrongMetadata ? 'wrong.app' : applicationId,
        artifactType: { type: 'APK' }, elements: [{ type: 'SINGLE', filters: [], outputFile: relative.split('/').at(-1) }] }));
    }
  };
  const run = () => buildAndroidMatrixApks({ root, execute, env: {} });
  return { root, calls, output, run };
}
test('the before-boot builder stages both explicit variants with metadata and four byte hashes', t => {
  const f = builderFixture(t); f.run(); assert.equal(f.calls.length, 2);
  assertMatrixApkMetadata(resolve(f.root, 'android'), 'full-matrix');
  const manifest = JSON.parse(readFileSync(resolve(f.output, 'matrix-apks/manifest.json')));
  assert.deepEqual(manifest.copies.map(row => row.applicationId), Object.keys(matrixPackages));
  assert(manifest.copies.every(row => /^[a-f0-9]{64}$/.test(row.sha256)));
  const first = readFileSync(resolve(f.output, matrixPackages['be.sportgreenmoove.app']), 'utf8');
  assert.equal(first, 'synthetic bytes, never an APK: be.sportgreenmoove.app');
  assert.throws(f.run, /fresh checkout/); assert.equal(f.calls.length, 2);
});
for (const options of [{ failBuild: 1 }, { failBuild: 2 }, { wrongMetadata: true }])
  test('build/identity failure retains a negative status and no complete APK manifest: ' + JSON.stringify(options), t => {
    const f = builderFixture(t, options); assert.throws(f.run);
    assert.equal(JSON.parse(readFileSync(resolve(f.output, 'store-review-screenshots/native-build-status.json'))).status, 1);
    assert(!existsSync(resolve(f.output, 'matrix-apks/manifest.json')));
  });

test('the completed remote matrix retains all original cases, four pinned APKs, copies and restoration without full-CI acceptance', () => {
  const report = validatePreinstalledMatrixEvidence(process.cwd(), nativeRechecks.nativeMatrixRecheck);
  assert.equal(report.localFlowGroupsPassed, 36); assert.equal(report.nativeReplayCasesPassed, 38);
  assert.equal(report.fullCiPassed, false); assert.equal(report.matrixHostObserverExecuted, false);
});
for (const [file, mutate] of [
  ['summary.json', row => { row.fullCiPassed = true; }],
  ['summary.json', row => { row.matrixHostObserverExecuted = true; }],
  ['disposable-device-setup.json', row => { delete row.apkHashes['be.sportgreenmoove.app']; }],
  ['disposable-store-restore.json', row => { row.restoration.launcher = false; }],
  ['replay-results.json', row => { row.matrixPreparation.receiptSha256 = '0'.repeat(64); }],
  ['ordinary-results.json', row => { row.passed = 197; }],
]) test('the retained matrix rejects unsupported acceptance: ' + file + ' ' + mutate, t => {
  const root = mkdtempSync(resolve(tmpdir(), 'sgm-preinstalled-retained-')); t.after(() => rmSync(root, {recursive: true, force: true}));
  const base = dirname(nativeRechecks.nativeMatrixRecheck.source), target = resolve(root, base);
  cpSync(resolve(process.cwd(), base), target, { recursive: true });
  const path = resolve(target, file), row = JSON.parse(readFileSync(path)); mutate(row); writeFileSync(path, JSON.stringify(row));
  assert.throws(() => validatePreinstalledMatrixEvidence(root, nativeRechecks.nativeMatrixRecheck));
});
