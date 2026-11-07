import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { assertDisposableLauncherEnabled, disableDisposableLauncher, restoreDisposableLauncher, disposableLauncher as launcher } from '../scripts/qa/disposable-launcher.mjs';
import { restoreDisposableAndroid } from '../scripts/qa/restore-disposable-android.mjs';
import { configureDisposableAndroid } from '../scripts/qa/configure-disposable-android.mjs';
import { playServicesVersionCommand } from '../scripts/qa/android-maps-prerequisites.mjs';

function phone({ enabled = true, failedDisable = false, failedRestore = false } = {}) {
  const calls = []; let isEnabled = enabled;
  const shell = (...args) => {
    const command = args.join(' '); calls.push(command);
    if (command === `pm path ${launcher}`) return 'package:/system/launcher.apk';
    if (command === `pm list packages -e --user 0 ${launcher}`) return isEnabled ? `package:${launcher}` : '';
    if (command === `pm list packages -d --user 0 ${launcher}`) return isEnabled ? '' : `package:${launcher}`;
    if (command === `pm disable-user --user 0 ${launcher}`) {
      isEnabled = false; if (failedDisable) throw new Error('disable acknowledgement lost'); return '';
    }
    if (command === `pm enable --user 0 ${launcher}`) { if (!failedRestore) isEnabled = true; return ''; }
    if (command.startsWith('pm list packages -e --user 0 ')) return `package:${args.at(-1)}`;
    if (command === playServicesVersionCommand) return 'versionName=25.39.33';
    assert.fail('Unexpected command');
  };
  return { shell, calls, serial: 'emulator-5554', enabled: () => isEnabled };
}
const receipt = { scope: 'disposable-emulator-without-home-navigation', serial: 'emulator-5554', launcher,
  launcherDisabled: true, launcherOriginalState: 'enabled', storePause: null, installAdmin: null };
test('launcher commands restore and independently verify only the known disposable home app', () => {
  const p = phone(); assertDisposableLauncherEnabled(p.shell); disableDisposableLauncher(p.shell);
  assert.equal(p.enabled(), false); assert.equal(restoreDisposableLauncher(p.shell), true); assert.equal(p.enabled(), true);
  assert(p.calls.every(command => command.includes(launcher)));
});
test('pre-existing disabled launcher is not overwritten or silently accepted', () => {
  const p = phone({ enabled: false }); assert.throws(() => assertDisposableLauncherEnabled(p.shell));
  assert(!p.calls.some(command => /disable-user|pm enable/.test(command)));
});
test('no selected store pause still restores the owned launcher, without inventing a store operation', () => {
  const p = phone({ enabled: false });
  const result = restoreDisposableAndroid(p, receipt, { restoreStore: () => assert.fail('No store change selected') });
  assert.equal(result.launcherRestored, true); assert.equal(result.storeChanged, false);
  assert.equal(result.restored, true); assert.equal(result.verified, true); assert.equal(p.enabled(), true);
});
test('store and admin failures do not suppress launcher restoration or replace the original errors', () => {
  const p = phone({ enabled: false }), storeFailure = new Error('store'), adminFailure = new Error('admin');
  assert.throws(() => restoreDisposableAndroid(p, { ...receipt, storePause: {}, installAdmin: {} }, {
    restoreStore: () => { throw storeFailure; }, removeAdmin: () => { throw adminFailure; },
  }), error => {
    assert.deepEqual(error.errors, [storeFailure, adminFailure]); assert.equal(error.receipt.launcherRestored, true);
    assert.equal(error.receipt.restored, false); assert.equal(error.receipt.verified, false); return true;
  });
  assert.equal(p.enabled(), true);
});
test('an ignored enable command cannot produce a restored or verified receipt and is not retried', () => {
  const p = phone({ enabled: false, failedRestore: true });
  assert.throws(() => restoreDisposableAndroid(p, receipt), error => {
    assert.equal(error.receipt.launcherRestored, false); assert.equal(error.receipt.restored, false);
    assert.equal(error.receipt.verified, false); return true;
  });
  assert.equal(p.calls.filter(command => command.startsWith('pm enable ')).length, 1);
});
test('foreign or unrecorded launcher identity fails before any restoration command', () => {
  for (const patch of [{ serial: 'physical-phone' }, { serial: 'emulator-5556' }, { launcher: 'other.app' },
    { launcherOriginalState: undefined }, { launcherDisabled: false }]) {
    const p = phone(); assert.throws(() => restoreDisposableAndroid(p, { ...receipt, ...patch })); assert.deepEqual(p.calls, []);
  }
});
test('a disable command that mutates then fails is rolled back while retaining the original setup error', () => {
  const p = phone({ failedDisable: true });
  const execute = (_binary, args) => {
    if (args[0] === 'devices') return 'emulator-5554\tdevice\n';
    if (args[2] === 'wait-for-device') return '';
    if (args[2] === 'get-state') return 'device';
    if (args.slice(3).join(' ') === 'getprop ro.kernel.qemu') return '1';
    return p.shell(...args.slice(3));
  };
  assert.throws(() => configureDisposableAndroid({ SGM_LOCAL_DISPOSABLE_EMULATOR: 'true' }, execute), error => {
    assert.match(error.errors[0].message, /setup command failed \(PROCESS_ERROR/);
    assert.equal(error.receipt.launcherCleanup, true); return true;
  });
  assert.equal(p.enabled(), true);
});
test('the restore entry point no longer skips the launcher when no store pause was selected', () => {
  const script = readFileSync('scripts/qa/restore-disposable-store.mjs', 'utf8');
  assert(!script.includes('if (receipt.storePause !== null)'));
  assert(script.indexOf('assert.equal(device.serial, receipt.serial') < script.indexOf('restoreDisposableAndroid(device, receipt)'));
});
