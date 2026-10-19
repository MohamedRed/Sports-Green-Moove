import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { readInstallBlocked, setInstallBlocked, assertNoActiveInstall } from './disposable-installations.mjs';
import { waitForDisposablePolicyReadiness } from './disposable-policy-readiness.mjs';

export const installAdminPackage = 'be.sportgreenmoove.qa.installguard';
export const installAdminComponent = `${installAdminPackage}/.GuardAdminReceiver`;
export const installAdminApk = resolve(import.meta.dirname, '../../android/qa-install-guard/build/outputs/apk/debug/qa-install-guard-debug.apk');
const packageCommand = ['pm', 'list', 'packages', '--user', '0', installAdminPackage];
export function assertDisposableInstallAdmin(shell) {
  assert.match(shell('dpm', 'list-owners'), new RegExp(`^1 owner:\\s*User\\s+0: admin=${installAdminComponent.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')},DeviceOwner(?:,Affiliated)?$`),
    'The only device owner must be this run\'s disposable installation guard');
}
export function removeDisposableInstallAdmin({ shell, command }, receipt) {
  assert.equal(receipt?.packageName, installAdminPackage);
  assert.equal(receipt.originalBlocked, false);
  const installed = shell(...packageCommand);
  assert(['', `package:${installAdminPackage}`].includes(installed));
  const owners = shell('dpm', 'list-owners');
  if (owners !== 'no owners') assertDisposableInstallAdmin(shell);
  if (installed) {
    // Removing our test-only admin also clears its restrictions if its receiver cannot run.
    shell('dpm', 'remove-active-admin', '--user', '0', installAdminComponent);
    assert.equal(shell('dpm', 'list-owners'), 'no owners', 'Test administration was not removed');
    assert.equal(command('uninstall', installAdminPackage), 'Success', 'Temporary installation guard was not removed');
  }
  assert.equal(shell('dpm', 'list-owners'), 'no owners', 'Test administration was not removed');
  assert.equal(shell(...packageCommand), '', 'Temporary installation guard remains installed');
  assert.equal(readInstallBlocked(shell), receipt.originalBlocked, 'Original installation policy was not restored');
  return { authorizationRemoved: true, componentRemoved: true, originalPolicyRestored: true };
}
export function prepareDisposableInstallAdmin(device, { approved, apk = installAdminApk, readiness } = {}) {
  assert.equal(approved, true, 'Temporary test-phone administration requires explicit approval');
  assert(existsSync(apk), 'Build the disposable test administrator before starting the phone');
  const { shell, command } = device;
  assert.equal(shell('getprop', 'ro.kernel.qemu'), '1');
  assert.equal(shell('getprop', 'ro.build.version.sdk'), '35');
  assert.equal(shell('am', 'get-current-user'), '0');
  assert.equal(shell('dpm', 'list-owners'), 'no owners', 'Do not replace an existing device/profile owner');
  assert.equal(shell(...packageCommand), '', 'Do not reuse an existing installation guard');
  assert.equal(readInstallBlocked(shell), false, 'Do not clear an existing installation restriction');
  assertNoActiveInstall(shell);
  const receipt = { packageName: installAdminPackage, originalBlocked: false, policyReady: false, noAccounts: false };
  let installAttempted = false;
  let stage = 'policy-readiness';
  try {
    waitForDisposablePolicyReadiness(shell, readiness);
    receipt.policyReady = true; receipt.noAccounts = true;
    stage = 'active-install-verification';
    assertNoActiveInstall(shell);
    stage = 'helper-installation';
    installAttempted = true;
    assert.equal(command('install', '-t', apk).split(/\r?\n/).at(-1), 'Success');
    stage = 'device-owner-provisioning';
    shell('dpm', 'set-device-owner', '--device-owner-only', '--user', '0', installAdminComponent);
    assertDisposableInstallAdmin(shell);
    stage = 'installation-policy-verification';
    // Validate the actual authority before app installation/instrumentation, not just a readable flag.
    setInstallBlocked(shell, true); setInstallBlocked(shell, false);
    assertNoActiveInstall(shell);
    return receipt;
  } catch (failure) {
    const errors = [failure];
    let cleanup = null;
    if (installAttempted) try { cleanup = removeDisposableInstallAdmin(device, receipt); } catch (error) { errors.push(error); }
    throw Object.assign(installAttempted ? new AggregateError(errors, 'Temporary test administration setup failed; cleanup attempted') : failure, {
      receipt: { scope: 'failed-disposable-admin-setup-not-flow-proof', stage, installAttempted, cleanup, verified: false },
    });
  }
}
