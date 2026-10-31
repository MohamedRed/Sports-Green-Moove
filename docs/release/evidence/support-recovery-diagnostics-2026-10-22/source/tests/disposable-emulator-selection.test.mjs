import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { selectDisposableEmulator } from '../scripts/qa/disposable-emulator-selection.mjs';
import { disposableAndroidShell } from '../scripts/qa/disposable-android-shell.mjs';

const env = { SGM_LOCAL_DISPOSABLE_EMULATOR: 'true', ANDROID_HOME: '/sdk' };
test('a uniquely identified offline emulator remains the selected target until its existing bounded readiness gate completes', () => {
  const calls = [];
  const execute = (command, args, options) => {
    calls.push(args); assert.equal(command, '/sdk/platform-tools/adb'); assert.equal(options.timeout, 30_000);
    if (args[0] === 'devices') return 'List of devices attached\nemulator-5554\toffline\nphysical-123\tdevice\n';
    assert.equal(args[1], 'emulator-5554');
    if (args[2] === 'wait-for-device') return '';
    if (args[2] === 'get-state') return 'device';
    if (args.slice(2).join(' ') === 'shell getprop ro.kernel.qemu') return '1';
    throw new Error('Unexpected command');
  };
  assert.equal(disposableAndroidShell(env, execute).serial, 'emulator-5554');
  assert.deepEqual(calls, [['devices'], ['-s', 'emulator-5554', 'wait-for-device'],
    ['-s', 'emulator-5554', 'get-state'], ['-s', 'emulator-5554', 'shell', 'getprop', 'ro.kernel.qemu']]);
});
test('selection preserves explicit targets without silently choosing another emulator', () => {
  const inventory = 'emulator-5554 offline\nemulator-5556 device';
  assert.equal(selectDisposableEmulator(inventory, 'emulator-5554'), 'emulator-5554');
  assert.throws(() => selectDisposableEmulator(inventory));
  assert.throws(() => selectDisposableEmulator(inventory, 'emulator-5558'));
});
for (const inventory of ['', 'physical-123 device', 'emulator-5554 unauthorized', 'emulator-5554 unknown',
  'emulator-5554 offline\nemulator-5556 offline', 'emulator-5554 offline\nemulator-5554 device', 'emulator-bad offline'])
  test('unsafe or ambiguous inventory remains refused: ' + JSON.stringify(inventory), () => {
    assert.throws(() => selectDisposableEmulator(inventory));
  });
test('a readiness timeout or lost identity never produces a device handle or another command attempt', () => {
  for (const failure of ['timeout', 'offline', 'physical']) {
    const calls = [];
    const execute = (_command, args) => {
      calls.push(args);
      if (args[0] === 'devices') return 'emulator-5554 offline';
      if (args[2] === 'wait-for-device') { if (failure === 'timeout') throw { code: 'ETIMEDOUT', status: null }; return ''; }
      if (args[2] === 'get-state') return failure === 'offline' ? 'offline' : 'device';
      return '0';
    };
    assert.throws(() => disposableAndroidShell(env, execute));
    assert.equal(calls.filter(args => args[2] === 'wait-for-device').length, 1);
    assert(!calls.some(args => /kill-server|reconnect|start-server/.test(args.join(' '))));
  }
});
test('replay binds readiness before creating a runtime or changing a device', () => {
  const source = readFileSync('scripts/qa/run-local-android-flows.mjs', 'utf8');
  assert(source.indexOf('selectDisposableEmulator(devices.stdout') < source.indexOf('waitForDisposableDevice(adb, serial)'));
  assert(source.indexOf('waitForDisposableDevice(adb, serial)') < source.indexOf('const runtime = prepareLocalRuntime()'));
});
