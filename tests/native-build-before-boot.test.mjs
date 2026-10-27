import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';
import { createHash } from 'node:crypto';
import { validateSdkImagePreparation } from '../scripts/qa/sdk-image-preparation-evidence.mjs';
import { renderNetworkGateFolder, validateRenderNetworkGate } from '../scripts/qa/render-network-gate-evidence.mjs';
import { matrixRendererConfiguration } from '../scripts/qa/select-matrix-renderer.mjs';

test('latest capture and cellular precondition failures remain distinct from successful copying and safety lanes', () => {
  assert(read('.gitattributes').includes(renderNetworkGateFolder + '** -text -whitespace'));
  const result = validateRenderNetworkGate(new URL('..', import.meta.url).pathname);
  assert.equal(result.ordinaryPassed, 176); assert.equal(result.ordinaryFailed, 1);
  assert.equal(result.allPrimaryCopiesPassed, true); assert.equal(result.networkFailedPhase, 'network-preparation');
  assert.equal(result.primaryCopyCount, 16); assert.equal(result.failureCleanupCopyPassed, true);
  for (const key of ['fullGatePassed', 'imageRootCauseEstablished', 'networkRootCauseEstablished',
    'phoneFlowAccepted', 'releaseAccepted']) assert.equal(result[key], false);
  assert.deepEqual(result.publicMedia, []);
});

test('failed system-image preparation cannot be accepted as a session-disconnect UI or cleanup pass', () => {
  const result = validateSdkImagePreparation(new URL('..', import.meta.url).pathname);
  assert.equal(result.compilationPassed, true);
  for (const key of ['preparationPassed', 'flowAssertionsAccepted', 'emulatorLaunchObserved',
    'archiveBytesRetained', 'downloadFailureRootCauseEstablished', 'releaseAccepted']) assert.equal(result[key], false);
});

const read = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
test('the full screenshot gate selects a supported rendering mode without weakening captures or collection', () => {
  const job = YAML.parse(read('.github/workflows/native-ci.yml')).jobs['android-native-ui'];
  const boot = job.steps.find(step => step.uses === 'reactivecircus/android-emulator-runner@v2');
  assert.equal(boot.with['emulator-options'], '${{ steps.matrix_renderer.outputs.emulator_options }}');
  assert.equal(matrixRendererConfiguration('software').emulatorOptions, '-no-window -gpu software -no-snapshot -noaudio -no-boot-anim');
  assert.equal(boot['continue-on-error'], undefined); assert.equal(job['continue-on-error'], undefined);
  assert.equal(boot.with.script, 'bash scripts/run-android-ui-tests-and-collect-screenshots.sh');
  const capture = read('android/app/src/androidTest/java/be/sportgreenmoove/app/ui/LocalUiCapture.kt');
  assert(capture.includes('window.captureToImage().asAndroidBitmap()'));
  assert(capture.includes('Blank test capture rejected')); assert(!capture.includes('catch'));
  const collector = read('scripts/qa/collect-local-ui-evidence.mjs');
  assert(collector.includes('throw new EvidenceCollectionError'));
  assert(collector.includes('A named evidence copy cannot be repeated or overwrite its receipt'));
});
test('renderer comparison is explicit, fail-closed and never replaces the ordinary release gate', () => {
  const workflow = YAML.parse(read('.github/workflows/native-ci.yml'));
  const input = workflow.on.workflow_dispatch.inputs.full_matrix_renderer;
  assert.deepEqual(input.options, ['software', 'swiftshader']); assert.equal(input.default, 'software');
  const job = workflow.jobs['android-native-ui'];
  assert(job.name.includes("inputs.full_matrix_renderer == 'swiftshader' && 'Android renderer comparison (not release)'"));
  const select = job.steps.findIndex(step => step.id === 'matrix_renderer');
  const boot = job.steps.findIndex(step => step.uses === 'reactivecircus/android-emulator-runner@v2');
  assert(select >= 0 && select < boot); assert.equal(job.steps[select]['continue-on-error'], undefined);
  assert.equal(job.steps[select].run, 'node scripts/qa/select-matrix-renderer.mjs');
  assert.equal(job.steps[select].env.SGM_MATRIX_RENDERER,
    "${{ github.event_name == 'workflow_dispatch' && inputs.full_matrix_renderer || 'software' }}");
  assert(workflow.jobs['android-focused-safety-ui'].if.includes("inputs.full_matrix_renderer == 'software'"));
  assert(job.steps.some(step => step.if === '${{ always() }}' && step.with?.path?.includes('outputs/matrix-renderer.json')));
  const baseline = matrixRendererConfiguration('software'), comparison = matrixRendererConfiguration('swiftshader');
  assert.equal(baseline.comparison, false); assert.equal(comparison.comparison, true);
  assert.equal(comparison.emulatorOptions, baseline.emulatorOptions.replace('-gpu software', '-gpu swiftshader'));
  for (const mode of [undefined, null, '', 'auto', 'swiftshader_indirect', 'host', 'software; touch unsafe', 'swiftshader\nsecret'])
    assert.throws(() => matrixRendererConfiguration(mode));
});
test('renderer CLI writes exact options once and refuses invalid modes without changing output', t => {
  const root = mkdtempSync(join(tmpdir(), 'sgm-renderer-')); t.after(() => rmSync(root, { recursive: true, force: true }));
  const output = join(root, 'output'); writeFileSync(output, '');
  const script = fileURLToPath(new URL('../scripts/qa/select-matrix-renderer.mjs', import.meta.url));
  const run = mode => spawnSync(process.execPath, [script], { cwd: root, encoding: 'utf8',
    env: { ...process.env, SGM_MATRIX_RENDERER: mode, GITHUB_OUTPUT: output } });
  assert.notEqual(run('swiftshader; echo unsafe').status, 0); assert.equal(readFileSync(output, 'utf8'), '');
  assert.equal(run('swiftshader').status, 0);
  const expected = matrixRendererConfiguration('swiftshader');
  assert.equal(readFileSync(output, 'utf8'), `emulator_options=${expected.emulatorOptions}\n`);
  const record = join(root, 'android/app/build/outputs/matrix-renderer.json');
  assert.deepEqual(JSON.parse(readFileSync(record)), expected);
  const bytes = readFileSync(record); assert.notEqual(run('software').status, 0);
  assert.deepEqual(readFileSync(record), bytes);
  assert.equal(readFileSync(output, 'utf8'), `emulator_options=${expected.emulatorOptions}\n`);
});
test('both APK pairs compile and stage before device boot without an in-device rebuild', () => {
  const workflow = YAML.parse(read('.github/workflows/native-ci.yml'));
  const steps = workflow.jobs['android-native-ui'].steps;
  const buildIndex = steps.findIndex((step) => step.name === 'Compile app and tests before starting the disposable device');
  const bootIndex = steps.findIndex((step) => step.uses === 'reactivecircus/android-emulator-runner@v2');
  assert(buildIndex > steps.findIndex((step) => step.uses === 'android-actions/setup-android@v4'));
  assert(buildIndex < bootIndex); assert.equal(steps[buildIndex]['continue-on-error'], undefined);
  assert.equal(steps[bootIndex].if, undefined);
  assert.equal(steps[buildIndex].env.SGM_GOOGLE_MAPS_ANDROID_API_KEY, steps[bootIndex].env.SGM_GOOGLE_MAPS_ANDROID_API_KEY);
  assert.equal(steps[bootIndex].env.SGM_PAUSE_TEST_PHONE_STORE, 'true');
  const targets = (source) => source.match(/:(?:app|qa-install-guard):[A-Za-z]+/g);
  const guardedBuild = read('scripts/run-android-ui-tests-and-collect-screenshots.sh');
  assert.equal(steps[buildIndex].run, 'node scripts/qa/build-android-matrix-apks.mjs');
  const builder = read('scripts/qa/build-android-matrix-apks.mjs');
  assert.deepEqual(targets(builder), [':app:assembleDebug', ':app:assembleDebugAndroidTest', ':qa-install-guard:assembleDebug']);
  assert(builder.includes('[[false, ordinaryPackages], [true, pinnedPackages]]'));
  assert(builder.includes('-PSGM_USE_FIREBASE_EMULATOR=${isolated}'));
  assert(!guardedBuild.includes('gradlew')); assert(!guardedBuild.includes('connectedDebugAndroidTest'));
  assert(guardedBuild.includes('configure-continuous-disposable.mjs'));
  assert(!read('scripts/qa/prepare-matrix-replay.mjs').includes('setInstallBlocked'));
  assert(!steps[buildIndex].run.includes('adb'));
});
test('both native and web gates cover build-before-boot ordering without changing the device image or permissions', () => {
  for (const name of ['native-ci.yml', 'web-integration-smoke.yml']) {
    const source = read('.github/workflows/' + name);
    assert.equal(source.split('"tests/native-build-before-boot.test.mjs"').length - 1, 2);
    assert(source.includes('node --test') && source.includes('tests/native-build-before-boot.test.mjs'));
  }
  const boot = YAML.parse(read('.github/workflows/native-ci.yml')).jobs['android-native-ui'].steps
    .find((step) => step.uses === 'reactivecircus/android-emulator-runner@v2');
  assert.equal(boot.with.target, 'google_apis_playstore'); assert.equal(boot.with['api-level'], 35);
  assert.equal(boot.with.script, 'bash scripts/run-android-ui-tests-and-collect-screenshots.sh');
  assert(!read('scripts/qa/disposable-store-pause.mjs').includes('no_install_apps'));
});
test('the original pre-suite active-install failure remains bound rather than relabelled as a replay pass', () => {
  const base = 'docs/release/evidence/local-team-enrollment-sdk-2026-10-18/build-before-pause-failure/';
  const hashes = JSON.parse(read(base + 'artifact-sha256.json')); assert.equal(Object.keys(hashes).length, 3);
  for (const [path, expected] of Object.entries(hashes))
    assert.equal(createHash('sha256').update(readFileSync(new URL('../' + base + path, import.meta.url))).digest('hex'), expected);
  assert.equal(read(base + 'disposable-device-setup.json'), '');
  assert.deepEqual(JSON.parse(read(base + 'native-build-status.json')),
    { scope: 'native-build-before-device-policy-not-flow-verification', status: 0 });
  const log = read(base + 'native-job.log');
  assert(log.includes('BUILD SUCCESSFUL in 6m 13s'));
  assert(log.includes('A store installation is already active; do not interrupt it or start the app replay'));
  assert(!log.includes('Finished 178 tests')); assert(!log.includes('Ordinary tests: 0'));
});
