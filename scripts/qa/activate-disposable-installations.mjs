import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { disposableAndroidShell } from './disposable-android-shell.mjs';
import { assertDisposableInstallAdmin, installAdminPackage } from './disposable-install-admin.mjs';
import { assertNoActiveInstall, readInstallBlocked, setInstallBlocked } from './disposable-installations.mjs';
import { androidMapsPrerequisites } from './android-maps-prerequisites.mjs';
import { assertNoDisposableAccounts } from './disposable-policy-readiness.mjs';

export function activateDisposableInstallations(device, receipt, env = process.env) {
  for (const key of ['SGM_LOCAL_DISPOSABLE_EMULATOR', 'SGM_PAUSE_TEST_PHONE_STORE',
    'SGM_BLOCK_TEST_PHONE_INSTALLS', 'SGM_TEST_PHONE_ADMIN_APPROVED']) assert.equal(env[key], 'true');
  assert.equal(receipt.scope, 'disposable-emulator-without-home-navigation');
  assert.match(device.serial, /^emulator-\d+$/); assert.equal(device.serial, receipt.serial);
  assert.equal(receipt.installAdmin?.packageName, installAdminPackage);
  for (const key of ['policyReady', 'noAccounts']) assert.equal(receipt.installAdmin[key], true);
  assert.equal(receipt.installAdmin.originalBlocked, false);
  assert.equal(receipt.storePause?.installationPolicy?.originalBlocked, false);
  const { shell } = device;
  assert.equal(shell('getprop', 'ro.kernel.qemu'), '1');
  assert.equal(shell('getprop', 'ro.build.version.sdk'), '35');
  assert.equal(shell('am', 'get-current-user'), '0');
  assertDisposableInstallAdmin(shell);
  assertNoDisposableAccounts(shell);
  assert.equal(readInstallBlocked(shell), false, 'Only a newly prepared, initially unlocked test session may activate its guard');
  assertNoActiveInstall(shell);
  assert.deepEqual(androidMapsPrerequisites(shell), receipt.mapsRuntime);
  assert.equal(shell('cmd', 'location', 'is-location-enabled', '--user', '0'), 'true');
  // Standalone replays have no preceding ordinary instrumentation runner to take this step.
  setInstallBlocked(shell, true);
  assertNoActiveInstall(shell);
  assert.deepEqual(androidMapsPrerequisites(shell), receipt.mapsRuntime);
  return { scope: 'disposable-installation-activation-not-flow-verification', serial: device.serial,
    installationsBlocked: true, mapsRuntimeUnchanged: true, ownerVerified: true };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const receipt = JSON.parse(readFileSync(process.argv[2], 'utf8'));
  console.log(JSON.stringify(activateDisposableInstallations(disposableAndroidShell(), receipt)));
}
