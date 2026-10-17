import assert from 'node:assert/strict';

const uuid = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/;

export function prepareCiTestHarness(env, shell, { now = Date.now,
  pause = () => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 500) } = {}) {
  assert.equal(env.SGM_LOCAL_DISPOSABLE_EMULATOR, 'true');
  assert.equal(env.SGM_LOCAL_CI_TEST_HARNESS, 'true', 'Explicit fresh CI test-device reset is required');
  assert.equal(env.GITHUB_ACTIONS, 'true');
  assert.equal(env.RUNNER_ENVIRONMENT, 'github-hosted', 'Only a fresh hosted CI device may be reset');
  assert.match(env.GITHUB_RUN_ID ?? '', /^\d+$/);
  assert.equal(shell('getprop', 'ro.kernel.qemu'), '1');
  assert(['', '0'].includes(shell('getprop', 'persist.sys.test_harness')), 'The fresh device must not already be in test mode');
  assert.equal(shell('pm', 'list', 'packages', '-3', '--user', '0'), '', 'Reset must precede all test-app installation');
  const originalBootId = shell('cat', '/proc/sys/kernel/random/boot_id');
  assert.match(originalBootId, uuid);
  shell('cmd', 'testharness', 'enable');
  const deadline = now() + 180_000;
  let bootId;
  while (now() < deadline) {
    try {
      bootId = shell('cat', '/proc/sys/kernel/random/boot_id');
      if (uuid.test(bootId) && bootId !== originalBootId && shell('getprop', 'sys.boot_completed') === '1' &&
          shell('getprop', 'persist.sys.test_harness') === '1') break;
    } catch { /* The one requested reset temporarily removes the ADB transport. */ }
    bootId = undefined;
    pause();
  }
  assert(bootId && bootId !== originalBootId, 'The requested CI test-mode reset did not complete before its deadline');
  assert.equal(shell('getprop', 'ro.kernel.qemu'), '1');
  assert.equal(shell('settings', 'get', 'global', 'ota_disable_automatic_update'), '1');
  assert.equal(shell('pm', 'list', 'packages', '-3', '--user', '0'), '', 'Unexpected third-party apps after reset');
  return { scope: 'fresh-hosted-ci-test-mode-not-physical-device', enabled: true, resetCompleted: true,
    bootChanged: true, systemAutoUpdatesDisabled: true };
}
