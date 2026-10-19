import { restoreDisposableStore } from './disposable-store-pause.mjs';
import { removeDisposableInstallAdmin } from './disposable-install-admin.mjs';

export function restoreDisposableAndroid(device, receipt, { restoreStore = restoreDisposableStore, removeAdmin = removeDisposableInstallAdmin } = {}) {
  let store, admin;
  const errors = [];
  try { store = restoreStore(device.shell, receipt.storePause); }
  catch (failure) { store = failure.receipt; errors.push(failure); }
  if (receipt.installAdmin) {
    try { admin = removeAdmin(device, receipt.installAdmin); }
    catch (failure) { errors.push(failure); }
  }
  const result = { ...store, ...(admin ? { installAdmin: admin } : {}),
    restored: store?.restored === true && (!receipt.installAdmin || admin?.originalPolicyRestored === true),
    verified: errors.length === 0 && store?.verified === true };
  if (errors.length) throw Object.assign(new AggregateError(errors, 'Disposable device restoration failed'), { receipt: result });
  return result;
}
