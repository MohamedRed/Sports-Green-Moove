import assert from 'node:assert/strict';
import { restoreDisposableStore } from './disposable-store-pause.mjs';
import { removeDisposableInstallAdmin } from './disposable-install-admin.mjs';
import { disposableLauncher, restoreDisposableLauncher } from './disposable-launcher.mjs';

export function restoreDisposableAndroid(device, receipt, { restoreStore = restoreDisposableStore, removeAdmin = removeDisposableInstallAdmin,
  restoreLauncher = restoreDisposableLauncher } = {}) {
  assert.equal(receipt.scope, 'disposable-emulator-without-home-navigation');
  assert.match(receipt.serial, /^emulator-\d+$/); assert.equal(device.serial, receipt.serial);
  assert.equal(receipt.launcher, disposableLauncher); assert.equal(receipt.launcherDisabled, true);
  assert.equal(receipt.launcherOriginalState, 'enabled', 'Original launcher state must be explicitly recorded');
  let store, admin, launcherRestored = false;
  const errors = [];
  try { store = receipt.storePause === null ? { storeChanged: false, restored: true, verified: true } : restoreStore(device.shell, receipt.storePause); }
  catch (failure) { store = failure.receipt; errors.push(failure); }
  if (receipt.installAdmin) {
    try { admin = removeAdmin(device, receipt.installAdmin); }
    catch (failure) { errors.push(failure); }
  }
  try { assert.equal(restoreLauncher(device.shell), true); launcherRestored = true; } catch (failure) { errors.push(failure); }
  const result = { ...store, ...(admin ? { installAdmin: admin } : {}), launcherRestored,
    restored: store?.restored === true && (!receipt.installAdmin || admin?.originalPolicyRestored === true) && launcherRestored,
    verified: errors.length === 0 && store?.verified === true && launcherRestored };
  if (errors.length) throw Object.assign(new AggregateError(errors, 'Disposable device restoration failed'), { receipt: result });
  return result;
}
