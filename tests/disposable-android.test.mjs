import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { configureDisposableAndroid } from '../scripts/qa/configure-disposable-android.mjs';
import { androidMapsPrerequisites, playServicesVersionCommand } from '../scripts/qa/android-maps-prerequisites.mjs';

const launcher = 'com.google.android.apps.nexuslauncher';
function device(overrides = {}) {
  const calls = [];
  const responses = { devices: 'List of devices attached\nemulator-5554\tdevice\n', 'wait-for-device': '', 'get-state': 'device',
    'getprop ro.kernel.qemu': '1', [`pm path ${launcher}`]: 'package:/system/launcher.apk',
    'pm list packages -e --user 0 com.android.vending': 'package:com.android.vending',
    'pm list packages -e --user 0 com.google.android.gms': 'package:com.google.android.gms',
    [playServicesVersionCommand]: 'Packages:\n  Package [com.google.android.gms]:\n    versionName=25.39.33 (190400-test)\n',
    [`pm disable-user --user 0 ${launcher}`]: 'new state: disabled-user',
    [`pm list packages -d --user 0 ${launcher}`]: `package:${launcher}`, ...overrides };
  return { calls, execute: (command, args) => {
    calls.push({ command, args });
    const key = args[0] === 'devices' ? 'devices' : args[2] === 'shell' ? args.slice(3).join(' ') : args[2];
    assert(Object.hasOwn(responses, key), `Unexpected device command: ${key}`);
    return responses[key];
  } };
}
test('launcher isolation is explicit, single-device and emulator-only', () => {
  const mock = device();
  const result = configureDisposableAndroid({ SGM_LOCAL_DISPOSABLE_EMULATOR: 'true', ANDROID_HOME: '/sdk' }, mock.execute);
  assert.equal(result.launcherDisabled, true);
  assert.equal(result.scope, 'disposable-emulator-without-home-navigation');
  assert.deepEqual(result.mapsRuntime, { playStoreEnabled: true, playServicesEnabled: true, playServicesVersion: '25.39.33' });
  assert(mock.calls.every((call) => call.command === '/sdk/platform-tools/adb'));
  assert.equal(mock.calls.filter((call) => call.args.includes('disable-user')).length, 1);
});

test('Maps runtime prerequisites fail closed before changing the disposable launcher', () => {
  for (const overrides of [
    { 'pm list packages -e --user 0 com.android.vending': '' },
    { 'pm list packages -e --user 0 com.google.android.gms': '' },
    { [playServicesVersionCommand]: 'versionName=21.39.13' },
    { [playServicesVersionCommand]: 'versionName=unavailable' },
    { [playServicesVersionCommand]: 'versionName=25.39.33\nversionName=25.40.00' },
  ]) {
    const mock = device(overrides);
    assert.throws(() => configureDisposableAndroid({ SGM_LOCAL_DISPOSABLE_EMULATOR: 'true' }, mock.execute));
    assert(!mock.calls.some((call) => call.args.includes('disable-user')));
  }
});

test('package diagnostics are filtered on the device and child failures cannot print raw output', () => {
  const mock = device();
  const fail = (command, args, options) => {
    if (args.includes(playServicesVersionCommand)) throw Object.assign(new Error('private package output'), {
      code: 'ENOBUFS', status: null, stdout: 'private-stdout', stderr: 'private-stderr',
    });
    return mock.execute(command, args, options);
  };
  assert.throws(() => configureDisposableAndroid({ SGM_LOCAL_DISPOSABLE_EMULATOR: 'true' }, fail), (error) => {
    assert.match(error.message, /ENOBUFS/); assert.doesNotMatch(String(error), /private/);
    assert.equal(error.cause, undefined); assert.equal(error.stdout, undefined);
    return true;
  });
  assert(playServicesVersionCommand.includes('| grep -E "versionName=|Hidden system packages:"'));
  assert(!mock.calls.some((call) => call.args.includes('disable-user')));
});

test('Maps prerequisite version boundaries use the active package, not an inactive factory version', () => {
  for (const version of ['21.39.14', '21.40.0', '22.0.0', '25.39.33']) {
    const shell = (...args) => args[0] === 'pm' ? `package:${args.at(-1)}` :
      `Packages:\n  versionName=${version} (test)\nHidden system packages:\n  versionName=20.0.0\n`;
    assert.equal(androidMapsPrerequisites(shell).playServicesVersion, version);
  }
  const workflow = readFileSync(new URL('../.github/workflows/native-ci.yml', import.meta.url), 'utf8');
  assert(workflow.includes('target: google_apis_playstore'));
  assert(workflow.includes('api-level: 35'));
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
