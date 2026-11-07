import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { activateDisposableInstallations } from '../scripts/qa/activate-disposable-installations.mjs';
import { installAdminPackage, installAdminComponent } from '../scripts/qa/disposable-install-admin.mjs';
import { playServicesVersionCommand } from '../scripts/qa/android-maps-prerequisites.mjs';
import { accountCountCommand } from '../scripts/qa/disposable-policy-readiness.mjs';

const env = Object.fromEntries(['SGM_LOCAL_DISPOSABLE_EMULATOR', 'SGM_PAUSE_TEST_PHONE_STORE',
  'SGM_BLOCK_TEST_PHONE_INSTALLS', 'SGM_TEST_PHONE_ADMIN_APPROVED'].map((key) => [key, 'true']));
function fixture(options = {}) {
  let blocked = options.blocked ?? false; const writes = [];
  const maps = { playStoreEnabled: true, playServicesEnabled: true, playServicesVersion: '24.23.35' };
  const receipt = { scope: 'disposable-emulator-without-home-navigation', serial: 'emulator-5554', mapsRuntime: maps,
    installAdmin: { packageName: installAdminPackage, policyReady: true, noAccounts: true, originalBlocked: false },
    storePause: { installationPolicy: { originalBlocked: false } } };
  const shell = (...args) => {
    const command = args.join(' ');
    if (command === 'getprop ro.kernel.qemu') return options.qemu ?? '1';
    if (command === 'getprop ro.build.version.sdk') return '35';
    if (command === 'am get-current-user') return '0';
    if (command === accountCountCommand) return options.accounts ?? 'Accounts: 0';
    if (command === 'dpm list-owners') return options.owner ?? `1 owner:\nUser  0: admin=${installAdminComponent},DeviceOwner`;
    if (command === 'pm get-user-restriction --user 0 no_install_apps') return String(blocked);
    if (command === 'dumpsys package installs') return options.installs ?? 'Active install sessions:\nHistorical install sessions:\n';
    if (command === playServicesVersionCommand) return `versionName=${options.version ?? '24.23.35'}`;
    if (command.startsWith('pm list packages -e')) return `package:${args.at(-1)}`;
    if (command === 'cmd location is-location-enabled --user 0') return 'true';
    if (command.startsWith('am broadcast ')) {
      writes.push(command); if (!options.ignored) blocked = args.at(-1) === 'true';
      return `Broadcast completed: result=-1, data="SGM_INSTALL_BLOCKED=${args.at(-1)}"`;
    }
    throw Error('Unexpected activation command');
  };
  const device = { serial: 'emulator-5554', shell };
  return { receipt, device, writes, blocked: () => blocked, run: () => activateDisposableInstallations(device, receipt, env) };
}
test('a fresh approved standalone replay locks installations through its confirmed owner before installing APKs', () => {
  const f = fixture(); assert.equal(f.run().installationsBlocked, true); assert.equal(f.blocked(), true);
  assert.equal(f.writes.length, 1); assert(f.writes[0].endsWith('blocked true'));
});
test('every approval flag is required before any device mutation', () => {
  for (const key of Object.keys(env)) {
    const f = fixture(); assert.throws(() => activateDisposableInstallations(f.device, f.receipt, { ...env, [key]: 'false' }));
    assert.equal(f.writes.length, 0);
  }
});
test('foreign, physical, already locked, unready or busy targets are refused without changing their policy', () => {
  for (const options of [{ qemu: '0' }, { blocked: true }, { owner: 'no owners' }, { version: '26.0.0' }, { accounts: 'Accounts: 1' },
    { installs: 'Active install sessions:\n  Session 4:\n    mDestroyed=false\nHistorical install sessions:\n' }]) {
    const f = fixture(options); assert.throws(f.run); assert.equal(f.writes.length, 0);
  }
  for (const change of [(f) => { f.device.serial = 'emulator-5556'; }, (f) => { f.receipt.installAdmin.noAccounts = false; },
    (f) => { f.receipt.storePause.installationPolicy.originalBlocked = true; }]) {
    const f = fixture(); change(f); assert.throws(f.run); assert.equal(f.writes.length, 0);
  }
});
test('an ignored activation fails rather than retrying or unlocking an unexpected restriction', () => {
  const f = fixture({ ignored: true }); assert.throws(f.run); assert.equal(f.writes.length, 1); assert.equal(f.blocked(), false);
});
test('both standalone map entrypoints activate only after cleanup is registered and before app replay', () => {
  for (const name of ['vehicle-map', 'real-maps']) {
    const source = readFileSync(new URL(`../scripts/run-${name}-android-ui.sh`, import.meta.url), 'utf8');
    assert(source.indexOf('trap restore_test_') < source.indexOf('activate-disposable-installations.mjs'));
    assert(source.indexOf('activate-disposable-installations.mjs') < source.indexOf(name === 'vehicle-map'
      ? 'run-local-vehicle-map-ui.mjs' : 'run-real-maps-android.mjs'));
  }
});
test('the first map attempt retains its actual installation refusal and never becomes renderer evidence', () => {
  const root = new URL('../docs/release/evidence/vehicle-map-ui-installation-failure-2026-10-19/', import.meta.url);
  const read = (name) => readFileSync(new URL(name, root));
  const run = JSON.parse(read('run.json'));
  assert.equal(run.headSha, '9cced9ae8a21bd14eaf956f50b5c63fd25a24430'); assert.equal(run.conclusion, 'failure');
  assert(read('job-failed.txt').toString().includes('The replay must start with the installation guard active'));
  const setup = JSON.parse(read('disposable-device-setup.json'));
  assert.equal(setup.installAdmin.policyReady, true); assert.equal(setup.installAdmin.originalBlocked, false);
  const restored = JSON.parse(read('disposable-store-restore.json'));
  assert.equal(restored.restored, true); assert.equal(restored.verified, false);
  assert.deepEqual(restored.installAdmin, { authorizationRemoved: true, componentRemoved: true, originalPolicyRestored: true });
  for (const name of ['replay/vehicle-map-app-results.json', 'replay/local-vehicle-map-device.json'])
    assert.equal(existsSync(new URL(name, root)), false);
  for (const [file, hash] of Object.entries(JSON.parse(read('artifact-sha256.json'))))
    assert.equal(createHash('sha256').update(read(file)).digest('hex'), hash, file);
});
