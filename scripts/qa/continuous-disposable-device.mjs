import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { androidMapsPrerequisites } from './android-maps-prerequisites.mjs';
import { disposableAndroidShell } from './disposable-android-shell.mjs';
import { prepareDisposableInstallAdmin, removeDisposableInstallAdmin } from './disposable-install-admin.mjs';
import { assertNoActiveInstall, readInstallBlocked, setInstallBlocked } from './disposable-installations.mjs';
import { readStoreBackground, setStoreBackground, storeBackgroundRestrictions } from './disposable-store-background.mjs';
import { readStoreStopped, restoreStoreStopped } from './disposable-store-pause.mjs';
import { resetDisposableTestApps } from './reset-disposable-local-apps.mjs';
import { packagesForCase, matrixCases, manualComponentCases, assertMatrixApkMetadata } from './android-case-apks.mjs';
import { pinnedApkHashes, assertPinnedApks, requireFocusedDeviceApproval, assertContinuousDevice, focusedCases } from './preinstalled-disposable-apks.mjs';

const launcher = 'com.google.android.apps.nexuslauncher';
const root = resolve(import.meta.dirname, '../..');
const resetCaseApps = (adb, serial, execute, names) => resetDisposableTestApps(adb, serial, [...names].reverse(), execute);
export function prepareContinuousDevice(env = process.env, execute = execFileSync,
  { device = disposableAndroidShell(env, execute), prepareAdmin = prepareDisposableInstallAdmin,
    removeAdmin = removeDisposableInstallAdmin, hashes = pinnedApkHashes, reset = resetCaseApps,
    verifyMetadata = assertMatrixApkMetadata } = {}) {
  requireFocusedDeviceApproval(env);
  const { shell, command, serial } = device;
  const packages = packagesForCase(env.SGM_FOCUSED_UI_CASE);
  if ([...matrixCases, ...manualComponentCases].includes(env.SGM_FOCUSED_UI_CASE)) verifyMetadata(resolve(root, 'android'), env.SGM_FOCUSED_UI_CASE);
  assert.equal(shell('getprop', 'ro.build.version.sdk'), '35');
  assert.equal(shell('am', 'get-current-user'), '0');
  assert.equal(readInstallBlocked(shell), false);
  assertNoActiveInstall(shell);
  assert.equal(shell('pm', 'list', 'packages', '--user', '0', Object.keys(packages)[0]), '',
    'A fresh phone cannot reuse a prior test app');
  const receipt = { scope: 'single-case-continuous-installation-guard-not-flow-proof', case: env.SGM_FOCUSED_UI_CASE,
    serial, mapsRuntime: androidMapsPrerequisites(shell), originalBackground: readStoreBackground(shell),
    originalStoreStopped: readStoreStopped(shell), apkHashes: hashes(resolve(root, 'android'), packages), installAdmin: null };
  assert.equal(shell('cmd', 'location', 'is-location-enabled', '--user', '0'), 'true');
  assert.equal(shell('pm', 'list', 'packages', '-e', '--user', '0', launcher), `package:${launcher}`);
  let appsAttempted = false, backgroundAttempted = false, launcherAttempted = false;
  try {
    receipt.installAdmin = prepareAdmin(device, { approved: true });
    backgroundAttempted = true; setStoreBackground(shell, storeBackgroundRestrictions);
    shell('am', 'force-stop', '--user', '0', 'com.android.vending');
    for (const [name, path] of Object.entries(packages)) {
      assertNoActiveInstall(shell); appsAttempted = true;
      assert.equal(command('install', '-t', resolve(root, 'android/app/build/outputs', path)).split(/\r?\n/).at(-1), 'Success');
      assert(shell('pm', 'path', name).startsWith('package:'));
    }
    assertPinnedApks(shell, receipt.apkHashes, packages);
    setInstallBlocked(shell, true);
    launcherAttempted = true; shell('pm', 'disable-user', '--user', '0', launcher);
    assert.equal(shell('pm', 'list', 'packages', '-d', '--user', '0', launcher), `package:${launcher}`);
    assertContinuousDevice(device, receipt);
    // A system service may wake the store; the continuous installation policy, not this observation, is the safety invariant.
    receipt.storeStoppedAfterLock = readStoreStopped(shell);
    return receipt;
  } catch (failure) {
    const errors = [failure], cleanup = {};
    const attempt = (name, action) => { try { action(); cleanup[name] = true; } catch (error) { errors.push(error); cleanup[name] = false; } };
    if (appsAttempted) attempt('localPackagesRemoved', () => reset(env.ANDROID_HOME ? `${env.ANDROID_HOME}/platform-tools/adb` : 'adb', serial, execute, Object.keys(packages)));
    if (backgroundAttempted) attempt('backgroundRestored', () => setStoreBackground(shell, receipt.originalBackground));
    if (backgroundAttempted) attempt('stoppedRestored', () => restoreStoreStopped(shell, receipt.originalStoreStopped));
    if (launcherAttempted) attempt('launcherRestored', () => restoreLauncher(shell));
    if (receipt.installAdmin) attempt('adminRemoved', () => removeAdmin(device, receipt.installAdmin));
    throw Object.assign(new AggregateError(errors, 'Single-case device setup failed; independent cleanup attempted'), {
      receipt: { scope: 'failed-single-case-device-preparation-not-flow-proof', case: receipt.case, serial,
        cleanup, ...(failure.receipt ? { nestedFailure: failure.receipt } : {}), verified: false },
    });
  }
}
export function continuousSetupFailureReceipt(failure, env = process.env) {
  if (failure.receipt) return failure.receipt;
  return { scope: 'failed-single-case-device-preflight-not-flow-proof', stage: 'read-only-preflight',
    case: [...focusedCases, ...matrixCases, ...manualComponentCases].includes(env.SGM_FOCUSED_UI_CASE) ? env.SGM_FOCUSED_UI_CASE : null, verified: false };
}
function restoreLauncher(shell) {
  shell('pm', 'enable', '--user', '0', launcher);
  assert.equal(shell('pm', 'list', 'packages', '-e', '--user', '0', launcher), `package:${launcher}`);
}
export function restoreContinuousDevice(device, receipt, execute = execFileSync,
  { removeAdmin = removeDisposableInstallAdmin, reset = resetCaseApps } = {}) {
  assert.equal(receipt.scope, 'single-case-continuous-installation-guard-not-flow-proof');
  assert.equal(device.serial, receipt.serial);
  const { shell } = device, errors = [], observed = {}, restored = {};
  const check = (target, name, action) => {
    try { target[name] = action() ?? true; } catch (error) { target[name] = false; errors.push(error); }
  };
  check(observed, 'continuousGuardVerified', () => { assertContinuousDevice(device, receipt); });
  check(observed, 'storeStopped', () => readStoreStopped(shell));
  check(restored, 'localPackagesRemoved', () => reset(process.env.ANDROID_HOME ? `${process.env.ANDROID_HOME}/platform-tools/adb` : 'adb', device.serial, execute, Object.keys(packagesForCase(receipt.case))));
  check(restored, 'background', () => setStoreBackground(shell, receipt.originalBackground));
  check(restored, 'stopped', () => restoreStoreStopped(shell, receipt.originalStoreStopped));
  check(restored, 'launcher', () => restoreLauncher(shell));
  check(restored, 'installAdmin', () => removeAdmin(device, receipt.installAdmin));
  const result = { scope: 'single-case-device-restoration-not-flow-proof', case: receipt.case, observed,
    restored: Object.values(restored).every(Boolean), verified: errors.length === 0, restoration: restored };
  if (errors.length) throw Object.assign(new AggregateError(errors, 'Single-case device verification or restoration failed'), { receipt: result });
  return result;
}
