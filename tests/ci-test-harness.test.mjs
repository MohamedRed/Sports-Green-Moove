import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { prepareCiTestHarness } from '../scripts/qa/prepare-ci-test-harness.mjs';

const env = { SGM_LOCAL_DISPOSABLE_EMULATOR: 'true', SGM_LOCAL_CI_TEST_HARNESS: 'true',
  GITHUB_ACTIONS: 'true', RUNNER_ENVIRONMENT: 'github-hosted', GITHUB_RUN_ID: '1234' };
const oldBoot = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', newBoot = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
function device(overrides = {}) {
  const calls = []; let enabled = false, bootReads = 0, elapsed = 0;
  const shell = (...args) => {
    const key = args.join(' '); calls.push(key);
    if (Object.hasOwn(overrides, key)) return overrides[key];
    if (key === 'getprop ro.kernel.qemu') return '1';
    if (key === 'getprop persist.sys.test_harness') return enabled ? '1' : '';
    if (key === 'getprop sys.boot_completed') return '1';
    if (key === 'pm list packages -3 --user 0') return '';
    if (key === 'cat /proc/sys/kernel/random/boot_id') {
      if (!enabled) return oldBoot;
      if (++bootReads === 1) throw new Error('temporary private ADB output');
      return bootReads === 2 ? oldBoot : newBoot;
    }
    if (key === 'cmd testharness enable') { enabled = true; return ''; }
    if (key === 'settings get global ota_disable_automatic_update') return '1';
    throw new Error('Unexpected command: ' + key);
  };
  return { calls, shell, clock: { now: () => elapsed, pause: () => { elapsed += 60_000; } } };
}

test('one explicit fresh-CI reset waits for a different completed boot, without replaying the reset', () => {
  const d = device(); const result = prepareCiTestHarness(env, d.shell, d.clock);
  assert.equal(result.resetCompleted, true); assert.equal(result.bootChanged, true);
  assert.equal(d.calls.filter((key) => key === 'cmd testharness enable').length, 1);
  assert(!d.calls.some((key) => /disable-user|uninstall|force-stop|settings put/.test(key)));
});

test('missing approval, local hosts, self-hosted and physical targets cannot reset', () => {
  for (const change of [{ SGM_LOCAL_DISPOSABLE_EMULATOR: 'false' }, { SGM_LOCAL_CI_TEST_HARNESS: '' },
    { GITHUB_ACTIONS: '' }, { RUNNER_ENVIRONMENT: 'self-hosted' }, { GITHUB_RUN_ID: '' }]) {
    const d = device(); assert.throws(() => prepareCiTestHarness({ ...env, ...change }, d.shell, d.clock));
    assert.equal(d.calls.length, 0);
  }
  for (const override of [{ 'getprop ro.kernel.qemu': '0' },
    { 'pm list packages -3 --user 0': 'package:be.sportgreenmoove.app.local' },
    { 'getprop persist.sys.test_harness': '1' }, { 'cat /proc/sys/kernel/random/boot_id': 'unknown' }]) {
    const d = device(override); assert.throws(() => prepareCiTestHarness(env, d.shell, d.clock));
    assert(!d.calls.includes('cmd testharness enable'));
  }
});

test('a reset timeout, old boot or incomplete setup fails closed, never falling back to the ordinary device', () => {
  for (const override of [{ 'cat /proc/sys/kernel/random/boot_id': oldBoot },
    { 'getprop sys.boot_completed': '0' }, { 'settings get global ota_disable_automatic_update': '0' }]) {
    const d = device(override); assert.throws(() => prepareCiTestHarness(env, d.shell, d.clock));
    assert.equal(d.calls.filter((key) => key === 'cmd testharness enable').length, 1);
  }
});

test('only the CI workflow opts into reset and both CI checks cover the implementation', () => {
  const read = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
  const workflow = read('.github/workflows/native-ci.yml');
  assert(workflow.includes('SGM_LOCAL_CI_TEST_HARNESS: "true"'));
  assert(workflow.includes('tests/ci-test-harness.test.mjs'));
  assert(read('package.json').includes('tests/ci-test-harness.test.mjs'));
  assert(read('.github/workflows/web-integration-smoke.yml').includes('tests/ci-test-harness.test.mjs'));
  const setup = read('scripts/qa/configure-disposable-android.mjs');
  assert(setup.indexOf('prepareCiTestHarness(env, shell)') < setup.indexOf('androidMapsPrerequisites(shell)'));
});
