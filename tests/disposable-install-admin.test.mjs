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
import { validateDisposableInstallationReceipts } from '../scripts/qa/disposable-installation-evidence.mjs';
import { accountCountCommand, policyReadinessMarker, waitForDisposablePolicyReadiness } from '../scripts/qa/disposable-policy-readiness.mjs';

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
    if (cmd === accountCountCommand) return state.accounts ?? 'Accounts: 0';
    if (args[0] === 'logcat') return state.policyPending ? '' : policyReadinessMarker;
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
  assert.deepEqual(receipt, { packageName: installAdminPackage, originalBlocked: false, policyReady: true, noAccounts: true });
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
    { malformed: 'unknown' }, { accounts: 'Accounts: 1' }, { accounts: 'unavailable' },
    { installs: 'Active install sessions:\n  Session 12:\n    mDestroyed=false\nHistorical install sessions:\n' }]) {
    const device = phone(t, options);
    assert.throws(() => prepareDisposableInstallAdmin(device, { approved: true, apk: device.apk }));
    assert.deepEqual(device.mutations, [], JSON.stringify(options));
  }
});
test('denied authority, rejected commands and ignored policy writes roll back instead of retrying without protection', (t) => {
  for (const options of [{ ownerDenied: true }, { bridgeRefused: true }, { ignored: true }]) {
    const device = phone(t, options);
    assert.throws(() => prepareDisposableInstallAdmin(device, { approved: true, apk: device.apk }), (error) => {
      assert.match(error.message, /cleanup attempted/);
      assert.equal(error.receipt.scope, 'failed-disposable-admin-setup-not-flow-proof');
      assert.equal(error.receipt.cleanup.authorizationRemoved, true);
      assert.equal(error.receipt.cleanup.componentRemoved, true); return true;
    });
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

test('installation-policy evidence requires observed protection and verified removal, without claiming user-flow success', () => {
  const maps = { playStoreEnabled: true, playServicesEnabled: true, playServicesVersion: '24.23.35' };
  const receipts = [{ scope: 'disposable-emulator-without-home-navigation', serial: 'emulator-5554',
    mapsRuntime: maps, installAdmin: { packageName: installAdminPackage, originalBlocked: false, policyReady: true, noAccounts: true },
    storePause: { method: 'restricted-store-background', mapsRuntime: maps, locationEnabled: true, installationPolicy: { originalBlocked: false } } },
  { scope: 'disposable-test-phone', installationsBlocked: true, mapsRuntimeUnchanged: true },
  { method: 'restricted-store-background', restored: true, verified: true,
    observed: { installationsBlocked: true, background: { RUN_IN_BACKGROUND: 'ignore', RUN_ANY_IN_BACKGROUND: 'deny' },
      mapsRuntime: maps, locationEnabled: true, noActiveStoreInstall: true },
    installAdmin: { authorizationRemoved: true, componentRemoved: true, originalPolicyRestored: true } }];
  assert.deepEqual(validateDisposableInstallationReceipts(...receipts), {
    scope: 'disposable-installation-policy-only-not-flow-or-release-proof', status: 'passed' });
  for (const alter of [
    (r) => { r[0].serial = 'physical-device'; }, (r) => { r[0].installAdmin.originalBlocked = true; },
    (r) => { r[1].installationsBlocked = false; }, (r) => { r[2].verified = false; },
    (r) => { r[2].observed.installationsBlocked = false; }, (r) => { r[2].observed.mapsRuntime = { ...maps, playServicesVersion: '26.40.32' }; },
    (r) => { r[2].installAdmin.authorizationRemoved = false; }, (r) => { r[2].installAdmin.componentRemoved = false; },
    (r) => { r[2].installAdmin.originalPolicyRestored = false; },
  ]) { const changed = structuredClone(receipts); alter(changed); assert.throws(() => validateDisposableInstallationReceipts(...changed)); }
});

test('an unfinished boot policy scan is awaited read-only before the one provisioning attempt', (t) => {
  const device = phone(t, { policyPending: true }); let time = 0;
  const receipt = prepareDisposableInstallAdmin(device, { approved: true, apk: device.apk,
    readiness: { now: () => time, sleep: (ms) => { time += ms; device.state.policyPending = time < 2000; }, timeoutMs: 5000 } });
  assert.equal(receipt.policyReady, true); assert.equal(time, 2000);
  assert.equal(device.calls.filter((line) => line.startsWith('logcat ')).length, 3);
  assert.equal(device.mutations.filter((line) => line.startsWith('dpm set-device-owner')).length, 1);
  removeDisposableInstallAdmin(device, receipt);
});
test('unknown boot readiness times out without installing a helper or attempting device ownership', (t) => {
  const device = phone(t, { policyPending: true }); let time = 0;
  assert.throws(() => prepareDisposableInstallAdmin(device, { approved: true, apk: device.apk,
    readiness: { now: () => time, sleep: (ms) => { time += ms; }, timeoutMs: 2000 } }), (error) => {
      assert.match(error.message, /boot validation has not finished/);
      assert.deepEqual(error.receipt, { scope: 'failed-disposable-admin-setup-not-flow-proof',
        stage: 'policy-readiness', installAttempted: false, cleanup: null, verified: false });
      return true;
    });
  assert.deepEqual(device.mutations, []);
  assert.equal(device.calls.filter((line) => line.startsWith('logcat ')).length, 3);
});
test('account-count diagnostics exclude private account fields and unknown formats never imply an empty device', () => {
  for (const output of ['', 'Error: unavailable', 'Accounts: 2', 'Accounts: 0\nAccounts: 1'])
    assert.throws(() => waitForDisposablePolicyReadiness(() => output, { timeoutMs: 0 }));
  assert(accountCountCommand.includes("grep -E '^[[:space:]]*Accounts: [0-9]+[[:space:]]*$'"));
});

test('the first boot-readiness refusal keeps its original pre-suite failure rather than becoming a flow pass', () => {
  const base = 'docs/release/evidence/disposable-installation-guard-2026-10-18/policy-readiness-failure/';
  const read = (path) => readFileSync(new URL('../' + base + path, import.meta.url));
  const hashes = JSON.parse(read('artifact-sha256.json')); assert.equal(Object.keys(hashes).length, 3);
  for (const [path, expected] of Object.entries(hashes)) assert.equal(createHash('sha256').update(read(path)).digest('hex'), expected);
  assert.equal(read('disposable-device-setup.json').length, 0);
  assert.equal(JSON.parse(read('native-build-status.json')).status, 0);
  assert(read('native-job.log').toString('utf8').includes('there are already some accounts on the device'));
});
