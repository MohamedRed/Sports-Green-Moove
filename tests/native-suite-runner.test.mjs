import test from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'sgm-suite-status-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  for (const dir of ['scripts', 'android', 'bin']) mkdirSync(join(root, dir));
  cpSync(new URL('../scripts/run-android-ui-tests-and-collect-screenshots.sh', import.meta.url), join(root, 'scripts/run.sh'));
  const log = join(root, 'calls');
  const executable = (path, content) => writeFileSync(join(root, path), '#!/bin/bash\n' + content, { mode: 0o700 });
  executable('android/gradlew', 'echo ordinary >> "$CALL_LOG"\nexit "$ORDINARY_STATUS"\n');
  executable('bin/node', 'case "$1" in\n*configure-disposable-android.mjs) echo setup >> "$CALL_LOG"; exit "$SETUP_STATUS";;\n*run-local-android-flows.mjs) echo replay >> "$CALL_LOG"; exit "$REPLAY_STATUS";;\n*) exit 99;;\nesac\n');
  executable('bin/adb', 'if [[ "$1" == pull && "$2" == /sdcard/Download/sgm-session-restoration && "$CAPTURE_FAILURE" == 1 ]]; then exit 9; fi\nif [[ "$1" == pull && "$2" == /sdcard/Download/sgm-store-review && "$CAPTURE_FAILURE" == store ]]; then exit 9; fi\nexit 0\n');
  const out = join(root, 'android/app/build/outputs/store-review-screenshots');
  mkdirSync(out, { recursive: true });
  const screens = {
    'sgm-session-restoration': ['session-restoration-error.png', 'session-restoration-narrow.png'],
    'sgm-booking-review': ['booking-review-required.png', 'booking-review-narrow.png'],
    'sgm-booking-feedback': ['booking-feedback-sending-narrow.png', 'booking-feedback-confirmed-narrow.png', 'booking-feedback-width-probe.json'],
    'sgm-trip-changes': ['trip-change-driver-proposed', 'trip-change-parent-review-large-text', 'trip-change-parent-accepted',
      'trip-change-parent-declined', 'trip-change-applied-balance-due'].flatMap((name) => [name + '.png', name + '-window.png']),
  };
  for (const [directory, names] of Object.entries(screens)) {
    mkdirSync(join(out, directory));
    for (const name of names) writeFileSync(join(out, directory, name), 'shell-harness-fixture-not-device-evidence');
  }
  for (let i = 0; i < 8; i++) writeFileSync(join(out, `store-${i}.png`), 'shell-harness-fixture');
  return (env) => {
    const result = spawnSync('bash', [join(root, 'scripts/run.sh')], { encoding: 'utf8', env: { ...process.env,
      PATH: join(root, 'bin') + ':' + process.env.PATH, CALL_LOG: log, ORDINARY_STATUS: '0', REPLAY_STATUS: '0',
      SETUP_STATUS: '0', CAPTURE_FAILURE: '0', ...env } });
    assert.equal(result.error, undefined);
    const statusFile = join(out, 'native-suite-status.json');
    return { ...result, calls: readFileSync(log, 'utf8').trim().split('\n'),
      statuses: existsSync(statusFile) ? JSON.parse(readFileSync(statusFile, 'utf8')) : null };
  };
}

for (const [name, env, exit, statuses] of [
  ['both required suites pass', {}, 0, [0, 0, 0]],
  ['ordinary failure still executes the isolated replay', { ORDINARY_STATUS: '7' }, 7, [7, 0, 0]],
  ['capture failure cannot suppress the replay or produce a green job', { CAPTURE_FAILURE: '1' }, 1, [0, 1, 0]],
  ['stale store files cannot hide a failed fresh copy', { CAPTURE_FAILURE: 'store' }, 1, [0, 1, 0]],
  ['isolated replay failure is never overwritten by ordinary success', { REPLAY_STATUS: '11' }, 11, [0, 0, 11]],
  ['both failures retain both outcomes and return the first', { ORDINARY_STATUS: '7', REPLAY_STATUS: '11' }, 7, [7, 0, 11]],
]) test(name, (t) => {
  const result = fixture(t)(env);
  assert.equal(result.status, exit, result.stderr); assert.deepEqual(result.calls, ['setup', 'ordinary', 'replay']);
  assert.equal(result.statuses.scope, 'native-suite-exit-status-not-flow-verification');
  assert.deepEqual([result.statuses.ordinaryTests, result.statuses.componentEvidence, result.statuses.localReplay], statuses);
});

test('an unsafe or unavailable device stops both suites before app execution', (t) => {
  const result = fixture(t)({ SETUP_STATUS: '3' });
  assert.equal(result.status, 1); assert.deepEqual(result.calls, ['setup']); assert.equal(result.statuses, null);
});

test('both CI entry points retain independent-suite verification and upload its status metadata', () => {
  for (const name of ['native-ci.yml', 'web-integration-smoke.yml']) {
    const workflow = readFileSync(new URL('../.github/workflows/' + name, import.meta.url), 'utf8');
    assert.equal(workflow.split('"tests/native-suite-runner.test.mjs"').length - 1, 2);
  }
  const workflow = readFileSync(new URL('../.github/workflows/native-ci.yml', import.meta.url), 'utf8');
  assert(workflow.includes('android/app/build/outputs/store-review-screenshots/**'));
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  assert(pkg.scripts['test:local-flow-isolation'].includes('tests/native-suite-runner.test.mjs'));
});
