import test from 'node:test';
import assert from 'node:assert/strict';
import { configureDisposableAndroid } from '../scripts/qa/configure-disposable-android.mjs';

const launcher = 'com.google.android.apps.nexuslauncher';
function device(overrides = {}) {
  const calls = [];
  const responses = { devices: 'List of devices attached\nemulator-5554\tdevice\n',
    'getprop ro.kernel.qemu': '1', [`pm path ${launcher}`]: 'package:/system/launcher.apk',
    [`pm disable-user --user 0 ${launcher}`]: 'new state: disabled-user',
    [`pm list packages -d --user 0 ${launcher}`]: `package:${launcher}`, ...overrides };
  return { calls, execute: (command, args) => {
    calls.push({ command, args });
    const key = args[0] === 'devices' ? 'devices' : args.slice(3).join(' ');
    assert(Object.hasOwn(responses, key), `Unexpected device command: ${key}`);
    return responses[key];
  } };
}
test('launcher isolation is explicit, single-device and emulator-only', () => {
  const mock = device();
  const result = configureDisposableAndroid({ SGM_LOCAL_DISPOSABLE_EMULATOR: 'true', ANDROID_HOME: '/sdk' }, mock.execute);
  assert.equal(result.launcherDisabled, true);
  assert.equal(result.scope, 'disposable-emulator-without-home-navigation');
  assert(mock.calls.every((call) => call.command === '/sdk/platform-tools/adb'));
  assert.equal(mock.calls.filter((call) => call.args.includes('disable-user')).length, 1);
});
test('unapproved, ambiguous, physical and incompatible targets fail before changes', () => {
  const unapproved = device();
  assert.throws(() => configureDisposableAndroid({}, unapproved.execute), /explicitly disposable/);
  assert.equal(unapproved.calls.length, 0);
  for (const overrides of [{ devices: 'physical-123\tdevice' },
    { devices: 'emulator-5554\tdevice\nemulator-5556\tdevice' },
    { 'getprop ro.kernel.qemu': '0' }, { [`pm path ${launcher}`]: '' }]) {
    const mock = device(overrides);
    assert.throws(() => configureDisposableAndroid({ SGM_LOCAL_DISPOSABLE_EMULATOR: 'true' }, mock.execute));
    assert(!mock.calls.some((call) => call.args.includes('disable-user')));
  }
});
test('failed isolation is not ignored or retried', () => {
  const mock = device({ [`pm list packages -d --user 0 ${launcher}`]: '' });
  assert.throws(() => configureDisposableAndroid({ SGM_LOCAL_DISPOSABLE_EMULATOR: 'true' }, mock.execute), /not applied/);
  assert.equal(mock.calls.filter((call) => call.args.includes('disable-user')).length, 1);
});
