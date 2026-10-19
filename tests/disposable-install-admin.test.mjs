import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { prepareDisposableInstallAdmin, removeDisposableInstallAdmin, assertDisposableInstallAdmin,
  installAdminPackage, installAdminComponent } from '../scripts/qa/disposable-install-admin.mjs';
import { restoreDisposableAndroid } from '../scripts/qa/restore-disposable-android.mjs';
import { createHash } from 'node:crypto';
import { XMLParser } from 'fast-xml-parser';

function phone(t, options = {}) {
  const temp = mkdtempSync(join(tmpdir(), 'sgm-test-admin-unit-'));
  t.after(() => rmSync(temp, { recursive: true, force: true }));
  const apk = join(temp, 'unit-fixture-not-device-apk'); writeFileSync(apk, 'fixture');
  const state = { installed: false, owner: 'none', blocked: false, ...options };
  const calls = [], mutations = [];
  const shell = (...args) => {
    const cmd = args.join(' '); calls.push(cmd);
    if (cmd === 'getprop ro.kernel.qemu') return state.qemu ?? '1';
    if (cmd === 'getprop ro.build.version.sdk') return state.sdk ?? '35';
    if (cmd === 'am get-current-user') return state.user ?? '0';
    if (cmd === 'pm get-user-restriction --user 0 no_install_apps') return state.malformed ?? String(state.blocked);
    if (cmd === 'dpm list-owners') return state.owner === 'none' ? 'no owners' :
      `1 owner:\nUser  0: admin=${state.owner === 'ours' ? installAdminComponent : 'other.owner/.Admin'},DeviceOwner`;
    if (cmd === `pm list packages --user 0 ${installAdminPackage}`) return state.installed ? `package:${installAdminPackage}` : '';
    if (cmd === 'dumpsys package installs') return state.installs ?? 'Active install sessions:\nHistorical install sessions:\n';
    mutations.push(cmd);
    if (cmd.startsWith('dpm set-device-owner ')) {
      if (state.ownerDenied) throw new Error('device owner denied'); state.owner = 'ours'; return 'Success';
    }
    if (cmd.startsWith('dpm remove-active-admin ')) { state.owner = 'none'; state.blocked = false; return 'Success'; }
    if (cmd.startsWith('am broadcast ')) {
      if (state.bridgeRefused) return 'Broadcast completed: result=0, data="SGM_INSTALL_POLICY_REFUSED"';
      const selected = args.at(-1) === 'true'; if (!state.ignored) state.blocked = selected;
      return `Broadcast completed: result=-1, data="SGM_INSTALL_BLOCKED=${selected}"`;
    }
    throw new Error('Unexpected device command: ' + cmd);
  };
  const command = (...args) => {
    mutations.push(args.join(' '));
    if (args[0] === 'install') { state.installed = true; return 'Performing Streamed Install\nSuccess'; }
    if (args[0] === 'uninstall') {
      if (state.uninstallFailed) throw new Error('uninstall failed');
      state.installed = false; return 'Success';
    }
    throw new Error('Unexpected host command');
  };
  return { state, calls, mutations, shell, command, apk };
}
test('approved setup proves real policy authority and removes its own test-only administration afterward', (t) => {
  const device = phone(t), receipt = prepareDisposableInstallAdmin(device, { approved: true, apk: device.apk });
  assert.deepEqual(receipt, { packageName: installAdminPackage, originalBlocked: false });
  assert.equal(device.state.owner, 'ours'); assert.equal(device.state.installed, true); assert.equal(device.state.blocked, false);
  assert.deepEqual(device.mutations.filter((line) => line.startsWith('am broadcast')).map((line) => line.split(' ').at(-1)), ['true', 'false']);
  assert(device.mutations.some((line) => line.includes('set-device-owner --device-owner-only --user 0')));
  device.state.blocked = true;
  assert.deepEqual(removeDisposableInstallAdmin(device, receipt), {
    authorizationRemoved: true, componentRemoved: true, originalPolicyRestored: true });
  assert.equal(device.state.owner, 'none'); assert.equal(device.state.installed, false); assert.equal(device.state.blocked, false);
});
test('no approval, absent build, physical device, other user, owner, existing helper or restriction refuses mutation', (t) => {
  const unapproved = phone(t);
  assert.throws(() => prepareDisposableInstallAdmin(unapproved, { apk: unapproved.apk }));
  assert.deepEqual(unapproved.calls, []); assert.deepEqual(unapproved.mutations, []);
  const absent = phone(t);
  assert.throws(() => prepareDisposableInstallAdmin(absent, { approved: true, apk: absent.apk + '.missing' }));
  assert.deepEqual(absent.calls, []);
  for (const options of [{ qemu: '0' }, { sdk: '34' }, { user: '10' }, { owner: 'other' }, { installed: true }, { blocked: true },
    { malformed: 'unknown' }, { installs: 'Active install sessions:\n  Session 12:\n    mDestroyed=false\nHistorical install sessions:\n' }]) {
    const device = phone(t, options);
    assert.throws(() => prepareDisposableInstallAdmin(device, { approved: true, apk: device.apk }));
    assert.deepEqual(device.mutations, [], JSON.stringify(options));
  }
});
test('denied authority, rejected commands and ignored policy writes roll back instead of retrying without protection', (t) => {
  for (const options of [{ ownerDenied: true }, { bridgeRefused: true }, { ignored: true }]) {
    const device = phone(t, options);
    assert.throws(() => prepareDisposableInstallAdmin(device, { approved: true, apk: device.apk }), /cleanup attempted/);
    assert.equal(device.state.owner, 'none'); assert.equal(device.state.installed, false); assert.equal(device.state.blocked, false);
    assert.equal(device.mutations.filter((line) => line.startsWith('install ')).length, 1);
    assert.equal(device.mutations.filter((line) => line.startsWith('dpm set-device-owner')).length, 1);
  }
});
test('restoration can remove the owner without relying on a working policy receiver', (t) => {
  const device = phone(t), receipt = prepareDisposableInstallAdmin(device, { approved: true, apk: device.apk });
  device.state.bridgeRefused = true; device.state.blocked = true;
  const before = device.mutations.length;
  assert.equal(removeDisposableInstallAdmin(device, receipt).originalPolicyRestored, true);
  assert(!device.mutations.slice(before).some((line) => line.startsWith('am broadcast')));
});
test('a failed component removal or an unexpected replacement owner never becomes a clean restoration', (t) => {
  const device = phone(t), receipt = prepareDisposableInstallAdmin(device, { approved: true, apk: device.apk });
  device.state.uninstallFailed = true;
  assert.throws(() => removeDisposableInstallAdmin(device, receipt), /uninstall failed/);
  assert.equal(device.state.installed, true);
  device.state.owner = 'other'; const before = device.mutations.length;
  assert.throws(() => removeDisposableInstallAdmin(device, receipt)); assert.equal(device.mutations.length, before);
});
test('owner confirmation rejects profile owners, additional owners and missing authority', () => {
  for (const value of ['no owners', `1 owner:\nUser  0: admin=${installAdminComponent},ProfileOwner`,
    `2 owners:\nUser  0: admin=${installAdminComponent},DeviceOwner`, `1 owner:\nUser 10: admin=${installAdminComponent},DeviceOwner`])
    assert.throws(() => assertDisposableInstallAdmin(() => value));
});
test('admin cleanup still runs after failed store verification, retaining the original failure', () => {
  const original = Object.assign(new Error('runtime changed'), { receipt: { restored: true, verified: false } });
  let removed = false;
  assert.throws(() => restoreDisposableAndroid({}, { storePause: {}, installAdmin: {} }, {
    restoreStore: () => { throw original; }, removeAdmin: () => {
      removed = true; return { authorizationRemoved: true, componentRemoved: true, originalPolicyRestored: true };
    },
  }), (error) => {
    assert(error.errors.includes(original)); assert.equal(error.receipt.verified, false);
    assert.equal(error.receipt.installAdmin.authorizationRemoved, true); return true;
  });
  assert.equal(removed, true);
});
test('failed admin cleanup cannot overwrite a failed test/store result or produce a verified receipt', () => {
  assert.throws(() => restoreDisposableAndroid({}, { storePause: {}, installAdmin: {} }, {
    restoreStore: () => ({ restored: true, verified: true }), removeAdmin: () => { throw new Error('remove failed'); },
  }), (error) => { assert.equal(error.receipt.restored, false); assert.equal(error.receipt.verified, false); return true; });
});
test('the helper is test-only, without network/destructive capabilities, and protected from normal app broadcasts', () => {
  const read = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
  const base = 'android/qa-install-guard/src/main/';
  const manifest = read(base + 'AndroidManifest.xml');
  assert(manifest.includes('android:testOnly="true"')); assert(manifest.includes('android:allowBackup="false"'));
  assert(manifest.includes('android.permission.BIND_DEVICE_ADMIN')); assert(manifest.includes('android.permission.DUMP'));
  assert(!manifest.includes('INTERNET')); assert(!manifest.includes('<uses-permission'));
  const receiver = read(base + 'java/be/sportgreenmoove/qa/installguard/InstallationPolicyReceiver.kt');
  for (const required of ['users.isSystemUser', 'policy.isDeviceOwnerApp', 'policy.isAdminActive', 'Build.HARDWARE',
    'policy.addUserRestriction(admin, UserManager.DISALLOW_INSTALL_APPS)', 'policy.clearUserRestriction(admin, UserManager.DISALLOW_INSTALL_APPS)'])
    assert(receiver.includes(required));
  for (const disallowed of ['wipeData', 'reboot(', 'setCameraDisabled', 'setLocationEnabled', 'HttpClient', 'Socket(']) assert(!receiver.includes(disallowed));
  assert(read('android/qa-install-guard/build.gradle.kts').includes('withBuildType("release")'));
  for (const name of ['native-ci.yml', 'web-integration-smoke.yml'])
    assert(read('.github/workflows/' + name).includes('tests/disposable-install-admin.test.mjs'));
});

test('the original admin trial proves cleanup, not a completed instrumentation replay', () => {
  const base = 'docs/release/evidence/disposable-installation-guard-2026-10-18/admin-startup-failure/';
  const read = (path) => readFileSync(new URL('../' + base + path, import.meta.url));
  const hashes = JSON.parse(read('artifact-sha256.json')); assert.equal(Object.keys(hashes).length, 6);
  for (const [path, expected] of Object.entries(hashes)) assert.equal(createHash('sha256').update(read(path)).digest('hex'), expected);
  const setup = JSON.parse(read('disposable-device-setup.json')), after = JSON.parse(read('disposable-store-restore.json'));
  assert.equal(setup.installAdmin.packageName, installAdminPackage);
  assert.equal(setup.installAdmin.originalBlocked, false);
  assert.equal(after.restored, true); assert.equal(after.verified, false);
  assert.deepEqual(after.installAdmin, { authorizationRemoved: true, componentRemoved: true, originalPolicyRestored: true });
  assert.deepEqual(after.observed.mapsRuntime, setup.mapsRuntime); assert.equal(after.observed.locationEnabled, true);
  assert.equal(read('disposable-installations-verified.json').length, 0);
  const suite = new XMLParser({ ignoreAttributes: false }).parse(read('ordinary-tests.xml').toString('utf8')).testsuite;
  assert.equal(Number(suite['@_tests']), 0);
  assert(read('ordinary-tests.xml').toString('utf8').includes('no tests were started'));
});
