import test from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { parseDocument } from 'yaml';
import { focusedCases } from '../scripts/qa/preinstalled-disposable-apks.mjs';

const read = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
function run(t, phase, overrides = {}) {
  const root = mkdtempSync(join(tmpdir(), 'sgm-focused-status-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  for (const dir of ['scripts', 'bin']) mkdirSync(join(root, dir));
  cpSync(new URL('../scripts/run-focused-android-ui.sh', import.meta.url), join(root, 'scripts/run.sh'));
  const commands = [
    '*configure-continuous-disposable.mjs) echo setup >> "$CALL_LOG"; echo "{}"; exit "$SETUP_STATUS";;',
    '*restore-continuous-disposable.mjs) echo restore >> "$CALL_LOG"; echo "{}"; exit "$RESTORE_STATUS";;',
    ...focusedCases.map((name) => `*run-local-${name}-ui.mjs) test -f "$SGM_PREINSTALLED_TEST_APKS_RECEIPT" || exit 97; test "$SGM_FOCUSED_UI_CASE" = ${name} || exit 98; echo ${name} >> "$CALL_LOG"; exit "$FLOW_STATUS";;`),
  ];
  writeFileSync(join(root, 'bin/node'), '#!/bin/bash\ncase "$1" in\n' + commands.join('\n') + '\n*) exit 99;;\nesac\n', { mode: 0o700 });
  const log = join(root, 'calls');
  const result = spawnSync('bash', [join(root, 'scripts/run.sh'), ...(phase == null ? [] : [phase])], {
    encoding: 'utf8', env: { ...process.env, PATH: join(root, 'bin') + ':' + process.env.PATH,
      CALL_LOG: log, SETUP_STATUS: '0', RESTORE_STATUS: '0', FLOW_STATUS: '0', ...overrides },
  });
  assert.equal(result.error, undefined);
  const output = join(root, 'android/app/build/outputs/focused-safety-ui', phase ?? '');
  const path = join(output, phase + '-suite-status.json');
  return { ...result, calls: existsSync(log) ? readFileSync(log, 'utf8').trim().split('\n') : [],
    outcome: existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : null };
}
for (const phase of focusedCases) {
  for (const [name, env, expected] of [
    ['passes', {}, 0], ['retains its failure', { FLOW_STATUS: '41' }, 41],
    ['requires cleanup', { RESTORE_STATUS: '13' }, 13],
    ['retains failure when cleanup also fails', { FLOW_STATUS: '41', RESTORE_STATUS: '13' }, 41],
  ]) test(phase + ' ' + name + ' on a dedicated phone', (t) => {
    const result = run(t, phase, env);
    assert.equal(result.status, expected, result.stderr);
    assert.deepEqual(result.calls, ['setup', phase, 'restore']);
    assert.deepEqual(result.outcome, { scope: phase + '-command-status-not-flow-verification', status: Number(env.FLOW_STATUS ?? 0) });
  });
}
test('unsafe setup executes no flow and owns its rollback', (t) => {
  const result = run(t, 'emergency-identity', { SETUP_STATUS: '3' });
  assert.equal(result.status, 1); assert.deepEqual(result.calls, ['setup']); assert.equal(result.outcome, null);
});
test('missing, unknown or compound case selection changes no phone', (t) => {
  for (const phase of [undefined, 'all', 'emergency-identity; echo unsafe']) {
    const result = run(t, phase); assert.equal(result.status, 2); assert.deepEqual(result.calls, []);
  }
});
test('every independent case remains scheduled when another case fails', (t) => {
  const results = focusedCases.map((phase, index) => run(t, phase, { FLOW_STATUS: String(index === 0 ? 41 : 0) }));
  assert.deepEqual(results.map((result) => result.status), [41, 0, 0, 0]);
  assert.deepEqual(results.map((result) => result.calls), focusedCases.map((phase) => ['setup', phase, 'restore']));
});
test('all four dedicated jobs and cleanup remain mandatory under the existing release gate', () => {
  const native = parseDocument(read('.github/workflows/native-ci.yml')).toJSON();
  const focused = parseDocument(read('.github/workflows/native-focused-ui.yml')).toJSON();
  assert.equal(native.jobs['android-focused-safety-ui'].uses, './.github/workflows/native-focused-ui.yml');
  assert(Object.values(native.jobs).some((job) => job.steps?.some((step) => JSON.stringify(step).includes('run-android-ui-tests-and-collect-screenshots.sh'))));
  const job = focused.jobs['focused-case'], gate = focused.jobs['focused-safety-ui'];
  assert.equal(job.strategy['fail-fast'], false); assert.deepEqual(job.strategy.matrix.case, focusedCases);
  assert(job.steps.some((step) => step.with?.script === 'bash scripts/run-focused-android-ui.sh ${{ matrix.case }}'));
  assert(job.steps.some((step) => step.if === '${{ always() }}' && step.with?.name === 'android-focused-safety-ui-${{ matrix.case }}'));
  const build = job.steps.findIndex((step) => step.name === 'Compile isolated app before starting the device');
  const device = job.steps.findIndex((step) => step.uses === 'reactivecircus/android-emulator-runner@v2');
  assert(build >= 0 && build < device); assert(job.steps[build].run.includes('-PSGM_USE_FIREBASE_EMULATOR=true'));
  for (const key of ['SGM_LOCAL_DISPOSABLE_EMULATOR', 'SGM_PAUSE_TEST_PHONE_STORE', 'SGM_BLOCK_TEST_PHONE_INSTALLS', 'SGM_TEST_PHONE_ADMIN_APPROVED'])
    assert.equal(job.steps[device].env[key], 'true');
  assert.equal(gate.name, 'Isolated safety flows'); assert.equal(gate.if, '${{ always() }}'); assert.equal(gate.needs, 'focused-case');
  assert.equal(gate.steps[0].env.FOCUSED_RESULT, '${{ needs.focused-case.result }}');
  for (const result of ['success', 'failure', 'cancelled', 'skipped', '']) {
    const status = spawnSync('bash', ['-c', gate.steps[0].run], { env: { ...process.env, FOCUSED_RESULT: result } }).status;
    assert.equal(status, result === 'success' ? 0 : 1);
  }
  assert(read('scripts/release-evidence-requirements.mjs').includes('Android focused safety UI tests / Isolated safety flows'));
  for (const name of ['native-ci.yml', 'web-integration-smoke.yml']) {
    const workflow = parseDocument(read('.github/workflows/' + name)).toJSON();
    for (const trigger of ['push', 'pull_request'])
      for (const path of ['scripts/run-focused-android-ui.sh', '.github/workflows/native-focused-ui.yml',
        'tests/native-focused-runner.test.mjs', 'tests/continuous-disposable-device.test.mjs'])
        assert(workflow.on[trigger].paths.includes(path), name + ': ' + path);
    for (const path of ['tests/native-focused-runner.test.mjs', 'tests/continuous-disposable-device.test.mjs'])
      assert(Object.values(workflow.jobs).some((entry) => entry.steps?.some((step) => step.run?.includes(path))));
  }
});
test('all four flows explicitly choose pinned APK preparation and still uninstall at completion', () => {
  for (const phase of focusedCases) {
    const source = read(`scripts/qa/local-${phase}-ui.mjs`);
    assert(source.includes('if (process.env.SGM_PREINSTALLED_TEST_APKS_RECEIPT === undefined) {'));
    assert(source.includes('apkPreparation = prepareDisposableTestApks({ adb, serial, android, run })'));
    assert.equal(source.split('resetDisposableLocalApps(adb, serial)').length - 1, 1);
    assert(source.includes('...disposableApkSourceFiles')); assert(source.includes('localPackagesRemoved: true'));
  }
  for (const file of ['run-isolated-ride-ui.mjs', 'run-local-ride-observation-ui.mjs']) {
    const source = read('scripts/qa/' + file);
    for (const key of ['SGM_PREINSTALLED_TEST_APKS_RECEIPT', 'SGM_FOCUSED_UI_CASE', 'SGM_TEST_PHONE_ADMIN_APPROVED']) assert(source.includes(key));
  }
});
