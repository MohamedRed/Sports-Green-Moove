import test from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { parseDocument } from 'yaml';

const phases = ['emergency-identity', 'ride-observation', 'native-startup', 'remote-ride-stop'];
function run(t, overrides = {}) {
  const root = mkdtempSync(join(tmpdir(), 'sgm-focused-status-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  for (const dir of ['scripts', 'bin']) mkdirSync(join(root, dir));
  cpSync(new URL('../scripts/run-focused-android-ui.sh', import.meta.url), join(root, 'scripts/run.sh'));
  const commands = [
    '*configure-disposable-android.mjs) echo setup >> "$CALL_LOG"; echo "{}"; exit "$SETUP_STATUS";;',
    '*activate-disposable-installations.mjs) echo activate >> "$CALL_LOG"; echo "{}"; exit "$ACTIVATE_STATUS";;',
    '*restore-disposable-store.mjs) echo restore >> "$CALL_LOG"; echo "{}"; exit "$RESTORE_STATUS";;',
    ...phases.map((phase, i) => `*run-local-${phase}-ui.mjs) echo ${phase} >> "$CALL_LOG"; exit "$FLOW_${i}";;`),
  ];
  writeFileSync(join(root, 'bin/node'), '#!/bin/bash\ncase "$1" in\n' + commands.join('\n') + '\n*) exit 99;;\nesac\n', { mode: 0o700 });
  const log = join(root, 'calls');
  const result = spawnSync('bash', [join(root, 'scripts/run.sh')], { encoding: 'utf8', env: { ...process.env,
    PATH: join(root, 'bin') + ':' + process.env.PATH, CALL_LOG: log,
    SETUP_STATUS: '0', ACTIVATE_STATUS: '0', RESTORE_STATUS: '0', FLOW_0: '0', FLOW_1: '0', FLOW_2: '0', FLOW_3: '0', ...overrides } });
  assert.equal(result.error, undefined);
  const output = join(root, 'android/app/build/outputs/focused-safety-ui');
  return { ...result, calls: readFileSync(log, 'utf8').trim().split('\n'), statuses: phases.map((phase) => {
    const name = phase === 'ride-observation' ? 'ride-observation' : phase;
    const path = join(output, name + '-suite-status.json');
    return existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')).status : null;
  }) };
}

for (const [name, env, status, statuses] of [
  ['all focused cases run', {}, 0, [0, 0, 0, 0]],
  ['identity failure retains every later case', { FLOW_0: '41' }, 41, [41, 0, 0, 0]],
  ['observation failure is required', { FLOW_1: '29' }, 29, [0, 29, 0, 0]],
  ['startup failure is required', { FLOW_2: '31' }, 31, [0, 0, 31, 0]],
  ['remote stop failure is required', { FLOW_3: '37' }, 37, [0, 0, 0, 37]],
  ['observation and startup retain both outcomes', { FLOW_1: '29', FLOW_2: '31' }, 29, [0, 29, 31, 0]],
  ['identity and startup retain both outcomes', { FLOW_0: '41', FLOW_2: '31' }, 41, [41, 0, 31, 0]],
  ['identity and stop retain both outcomes', { FLOW_0: '41', FLOW_3: '37' }, 41, [41, 0, 0, 37]],
  ['startup and stop retain both outcomes', { FLOW_2: '31', FLOW_3: '37' }, 31, [0, 0, 31, 37]],
  ['all failures remain visible', { FLOW_0: '41', FLOW_1: '29', FLOW_2: '31', FLOW_3: '37' }, 41, [41, 29, 31, 37]],
  ['restoration failure fails a passing suite', { RESTORE_STATUS: '13' }, 13, [0, 0, 0, 0]],
  ['restoration cannot overwrite a scenario failure', { FLOW_1: '29', RESTORE_STATUS: '13' }, 29, [0, 29, 0, 0]],
]) test(name, (t) => {
  const result = run(t, env);
  assert.equal(result.status, status, result.stderr);
  assert.deepEqual(result.calls, ['setup', 'activate', ...phases, 'restore']);
  assert.deepEqual(result.statuses, statuses);
});

test('unsafe setup never executes the app', (t) => {
  const result = run(t, { SETUP_STATUS: '3' });
  assert.equal(result.status, 1); assert.deepEqual(result.calls, ['setup']);
  assert.deepEqual(result.statuses, [null, null, null, null]);
});
test('failed activation restores the disposable phone without running flows', (t) => {
  const result = run(t, { ACTIVATE_STATUS: '23' });
  assert.equal(result.status, 23); assert.deepEqual(result.calls, ['setup', 'activate', 'restore']);
});

test('the focused lane supplements the full matrix and is a required release check', () => {
  const read = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
  const native = parseDocument(read('.github/workflows/native-ci.yml')).toJSON();
  const focused = parseDocument(read('.github/workflows/native-focused-ui.yml')).toJSON();
  assert.equal(native.jobs['android-focused-safety-ui'].uses, './.github/workflows/native-focused-ui.yml');
  assert(Object.values(native.jobs).some((job) => job.steps?.some((step) => JSON.stringify(step).includes('run-android-ui-tests-and-collect-screenshots.sh'))));
  const job = focused.jobs['focused-safety-ui'];
  assert.equal(job.name, 'Isolated safety flows');
  assert(job.steps.some((step) => step.with?.script === 'bash scripts/run-focused-android-ui.sh'));
  assert(job.steps.some((step) => step.if === '${{ always() }}' && step.with?.name === 'android-focused-safety-ui-results'));
  const build = job.steps.findIndex((step) => step.name === 'Compile isolated app before starting the device');
  const device = job.steps.findIndex((step) => step.uses === 'reactivecircus/android-emulator-runner@v2');
  assert(build >= 0 && build < device);
  assert(job.steps[build].run.includes('-PSGM_USE_FIREBASE_EMULATOR=true'));
  for (const key of ['SGM_LOCAL_DISPOSABLE_EMULATOR', 'SGM_PAUSE_TEST_PHONE_STORE', 'SGM_BLOCK_TEST_PHONE_INSTALLS', 'SGM_TEST_PHONE_ADMIN_APPROVED'])
    assert.equal(job.steps[device].env[key], 'true');
  assert(read('scripts/release-evidence-requirements.mjs').includes('Android focused safety UI tests / Isolated safety flows'));
  for (const name of ['native-ci.yml', 'web-integration-smoke.yml']) {
    const workflow = parseDocument(read('.github/workflows/' + name)).toJSON();
    for (const trigger of ['push', 'pull_request'])
      for (const path of ['scripts/run-focused-android-ui.sh', '.github/workflows/native-focused-ui.yml', 'tests/native-focused-runner.test.mjs'])
        assert(workflow.on[trigger].paths.includes(path), name + ': ' + path);
    assert(Object.values(workflow.jobs).some((job) => job.steps?.some((step) => step.run?.includes('tests/native-focused-runner.test.mjs'))));
  }
});
