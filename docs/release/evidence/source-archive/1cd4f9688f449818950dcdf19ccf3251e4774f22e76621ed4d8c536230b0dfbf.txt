import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';
import { disposableAndroidShell } from './disposable-android-shell.mjs';
import { assertDisposableInstallAdmin, installAdminPackage } from './disposable-install-admin.mjs';
import { assertNoActiveInstall, readInstallBlocked } from './disposable-installations.mjs';
import { androidMapsPrerequisites } from './android-maps-prerequisites.mjs';
import { readStoreBackground, storeBackgroundRestrictions } from './disposable-store-background.mjs';

export const pinnedPackages = {
  'be.sportgreenmoove.app.local': 'apk/debug/app-debug.apk',
  'be.sportgreenmoove.app.local.test': 'apk/androidTest/debug/app-debug-androidTest.apk',
};
export const focusedCases = ['emergency-identity', 'ride-observation', 'native-startup', 'remote-ride-stop', 'session-restoration'];
export function requireFocusedDeviceApproval(env) {
  for (const key of ['SGM_LOCAL_DISPOSABLE_EMULATOR', 'SGM_PAUSE_TEST_PHONE_STORE',
    'SGM_BLOCK_TEST_PHONE_INSTALLS', 'SGM_TEST_PHONE_ADMIN_APPROVED']) assert.equal(env[key], 'true', key);
  assert(focusedCases.includes(env.SGM_FOCUSED_UI_CASE), 'Select exactly one approved focused case');
}
export function usePreinstalledTestApks(env = process.env) {
  if (env.SGM_FOCUSED_UI_CASE === undefined && env.SGM_PREINSTALLED_TEST_APKS_RECEIPT === undefined) return false;
  requireFocusedDeviceApproval(env);
  assert(env.SGM_PREINSTALLED_TEST_APKS_RECEIPT && isAbsolute(env.SGM_PREINSTALLED_TEST_APKS_RECEIPT),
    'A focused case requires its absolute preinstalled-device receipt; legacy installation is forbidden');
  return true;
}
export function pinnedApkHashes(android) {
  return Object.fromEntries(Object.entries(pinnedPackages).map(([name, path]) => [name,
    createHash('sha256').update(readFileSync(resolve(android, 'app/build/outputs', path))).digest('hex')]));
}
export function assertPinnedApks(shell, hashes) {
  assert.deepEqual(Object.keys(hashes).sort(), Object.keys(pinnedPackages).sort());
  for (const [name, expected] of Object.entries(hashes)) {
    assert.match(expected, /^[a-f0-9]{64}$/);
    const match = /^package:(\/data\/app\/[A-Za-z0-9_~=.\/-]+\/base\.apk)$/.exec(shell('pm', 'path', name));
    assert(match, 'Exactly one non-split local APK must be installed');
    const digest = /^([a-f0-9]{64})\s+(.+)$/.exec(shell('sha256sum', match[1]));
    assert(digest && digest[2] === match[1], 'Installed APK digest unavailable');
    assert.equal(digest[1], expected, 'Installed APK differs from the compiled test binary');
  }
}
export function assertContinuousDevice(device, receipt) {
  assert.equal(receipt.scope, 'single-case-continuous-installation-guard-not-flow-proof');
  assert(focusedCases.includes(receipt.case));
  assert.equal(receipt.installAdmin?.packageName, installAdminPackage);
  assert.equal(receipt.installAdmin.originalBlocked, false);
  assert.equal(receipt.installAdmin.policyReady, true); assert.equal(receipt.installAdmin.noAccounts, true);
  assert.equal(device.serial, receipt.serial, 'Refuse a different test phone');
  assertDisposableInstallAdmin(device.shell);
  assert.equal(readInstallBlocked(device.shell), true, 'Installation guard must stay active throughout the case');
  assertNoActiveInstall(device.shell);
  assert.deepEqual(androidMapsPrerequisites(device.shell), receipt.mapsRuntime);
  assert.equal(device.shell('cmd', 'location', 'is-location-enabled', '--user', '0'), 'true');
  assert.deepEqual(readStoreBackground(device.shell), storeBackgroundRestrictions);
}
export function preparePinnedApks({ android, serial, env = process.env, device = disposableAndroidShell(env) }) {
  requireFocusedDeviceApproval(env);
  const path = env.SGM_PREINSTALLED_TEST_APKS_RECEIPT;
  assert(path && isAbsolute(path), 'A specific preinstalled-device receipt is required');
  const bytes = readFileSync(path), receipt = JSON.parse(bytes);
  assert.equal(receipt.case, env.SGM_FOCUSED_UI_CASE); assert.equal(serial, device.serial);
  assertContinuousDevice(device, receipt);
  assert.deepEqual(pinnedApkHashes(android), receipt.apkHashes, 'Compiled APK changed after phone preparation');
  assertPinnedApks(device.shell, receipt.apkHashes);
  // One receipt belongs to one case, even if a later preparation operation fails.
  writeFileSync(path + '.claimed', receipt.case + '\n', { flag: 'wx', mode: 0o600 });
  for (const name of Object.keys(pinnedPackages)) assert.equal(device.shell('pm', 'clear', name), 'Success');
  assertContinuousDevice(device, receipt); assertPinnedApks(device.shell, receipt.apkHashes);
  return { method: receipt.scope, case: receipt.case, receiptSha256: createHash('sha256').update(bytes).digest('hex'),
    apkHashes: receipt.apkHashes, installationsRemainedBlocked: true };
}
