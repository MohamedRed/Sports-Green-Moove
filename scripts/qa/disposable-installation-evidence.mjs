import assert from 'node:assert/strict';
import { installAdminPackage } from './disposable-install-admin.mjs';
import { storeBackgroundRestrictions } from './disposable-store-background.mjs';

export function validateDisposableInstallationReceipts(setup, locked, restored) {
  assert.equal(setup.scope, 'disposable-emulator-without-home-navigation');
  assert.match(setup.serial, /^emulator-\d+$/);
  assert.equal(setup.installAdmin.packageName, installAdminPackage);
  assert.equal(setup.installAdmin.originalBlocked, false);
  assert.equal(setup.installAdmin.policyReady, true); assert.equal(setup.installAdmin.noAccounts, true);
  assert.equal(setup.storePause.method, 'restricted-store-background');
  assert.equal(setup.storePause.installationPolicy.originalBlocked, false);
  const maps = setup.mapsRuntime;
  assert.equal(maps.playStoreEnabled, true); assert.equal(maps.playServicesEnabled, true);
  assert.match(maps.playServicesVersion, /^\d+\.\d+\.\d+$/);
  assert.deepEqual(setup.storePause.mapsRuntime, maps);
  assert.equal(setup.storePause.locationEnabled, true);
  assert.equal(locked.scope, 'disposable-test-phone');
  assert.equal(locked.installationsBlocked, true); assert.equal(locked.mapsRuntimeUnchanged, true);
  assert.equal(restored.method, setup.storePause.method);
  assert.equal(restored.restored, true); assert.equal(restored.verified, true);
  assert.equal(restored.observed.installationsBlocked, true);
  assert.deepEqual(restored.observed.background, storeBackgroundRestrictions);
  assert.deepEqual(restored.observed.mapsRuntime, maps);
  assert.equal(restored.observed.locationEnabled, true); assert.equal(restored.observed.noActiveStoreInstall, true);
  assert.deepEqual(restored.installAdmin, {
    authorizationRemoved: true, componentRemoved: true, originalPolicyRestored: true,
  });
  return { scope: 'disposable-installation-policy-only-not-flow-or-release-proof', status: 'passed' };
}
