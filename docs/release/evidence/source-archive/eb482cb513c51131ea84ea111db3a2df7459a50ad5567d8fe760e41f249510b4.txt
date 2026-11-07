import assert from 'node:assert/strict';
import { androidMapsPrerequisites } from './android-maps-prerequisites.mjs';
import { installationState } from './native-package-diagnostics.mjs';
import { readStoreBackground, setStoreBackground, storeBackgroundRestrictions } from './disposable-store-background.mjs';
import { assertNoActiveInstall, readInstallBlocked, setInstallBlocked } from './disposable-installations.mjs';

export const storeStateCommand = 'dumpsys package com.android.vending | sed \'/Hidden system packages:/,$d\' | grep -E "^[[:space:]]*User 0:"';
const store = 'com.android.vending';

function stopped(shell) {
  // AOSP also emits bare User 0: headings for permissions/changed-package lists.
  const lines = shell(storeStateCommand).split('\n').filter((line) => /^\s*User 0:\s*\S/.test(line));
  assert.equal(lines.length, 1, 'Exactly one store user state is required');
  assert.match(lines[0], /\binstalled=true\b/, 'Store must remain installed');
  const match = lines[0].match(/\bstopped=(true|false)\b/);
  assert(match, 'Store stopped state unavailable');
  return match[1] === 'true';
}
function locationEnabled(shell) {
  const result = shell('cmd', 'location', 'is-location-enabled', '--user', '0');
  assert.equal(result, 'true', 'The disposable location runtime must remain enabled');
  return true;
}
function noStoreInstall(shell) {
  const state = JSON.parse(installationState(shell('dumpsys', 'package', 'installs')));
  const active = state.sections.filter(({ kind }) => kind === 'active').flatMap(({ sessions }) => sessions);
  assert(!active.some((session) => session.mDestroyed !== true &&
    [session.appPackageName, session.installerPackageName, session.installInitiatingPackageName].includes(store)),
  'A store installation is already active; do not interrupt it or start the app replay');
}

function restoreStoppedState(shell, wasStopped) {
  shell(wasStopped ? 'am' : 'pm', wasStopped ? 'force-stop' : 'unstop', '--user', '0', store);
  assert.equal(stopped(shell), wasStopped, 'Store original stopped state was not restored');
}

export function pauseDisposableStore(shell, { blockInstallations = false } = {}) {
  assert.equal(shell('getprop', 'ro.build.version.sdk'), '35', 'Store pause requires the approved Android 15 test image');
  const mapsRuntime = androidMapsPrerequisites(shell);
  locationEnabled(shell);
  const wasStopped = stopped(shell);
  noStoreInstall(shell);
  const originalBackground = readStoreBackground(shell);
  let installationPolicy;
  if (blockInstallations) {
    const originalBlocked = readInstallBlocked(shell);
    assert.equal(originalBlocked, false, 'Do not clear an existing installation restriction to prepare tests');
    assertNoActiveInstall(shell);
    installationPolicy = { originalBlocked };
  }
  try {
    setStoreBackground(shell, storeBackgroundRestrictions);
    shell('am', 'force-stop', '--user', '0', store);
    assert.equal(stopped(shell), true, 'Store pause was not applied');
    noStoreInstall(shell);
    assert.deepEqual(androidMapsPrerequisites(shell), mapsRuntime, 'Maps runtime changed during store pause');
    locationEnabled(shell);
  } catch (failure) {
    const errors = [failure];
    for (const restore of [() => setStoreBackground(shell, originalBackground), () => restoreStoppedState(shell, wasStopped)])
      try { restore(); } catch (cleanup) { errors.push(cleanup); }
    throw new AggregateError(errors, 'Store pause failed; original settings restoration attempted');
  }
  return { method: 'restricted-store-background', wasStopped, originalBackground, mapsRuntime, locationEnabled: true,
    ...(installationPolicy ? { installationPolicy } : {}) };
}

export function restoreDisposableStore(shell, receipt) {
  assert.equal(receipt?.method, 'restricted-store-background');
  assert.equal(typeof receipt.wasStopped, 'boolean');
  assert.equal(shell('getprop', 'ro.build.version.sdk'), '35');
  const observed = {}, errors = [];
  const inspect = (name, check) => {
    try { observed[name] = check(); } catch (failure) { errors.push(failure); }
  };
  inspect('storeStopped', () => stopped(shell));
  inspect('background', () => {
    const value = readStoreBackground(shell);
    assert.deepEqual(value, storeBackgroundRestrictions, 'The store background restriction changed during the test');
    return value;
  });
  inspect('mapsRuntime', () => {
    const value = androidMapsPrerequisites(shell);
    assert.deepEqual(value, receipt.mapsRuntime, 'Maps runtime changed during the test'); return value;
  });
  inspect('locationEnabled', () => locationEnabled(shell));
  inspect('noActiveStoreInstall', () => { noStoreInstall(shell); return true; });
  if (receipt.installationPolicy) {
    assert.equal(receipt.installationPolicy.originalBlocked, false);
    inspect('installationsBlocked', () => {
      assert.equal(readInstallBlocked(shell), true, 'The installation guard changed during the replay');
      assertNoActiveInstall(shell); return true;
    });
  }
  let restored = true;
  for (const restore of [
    ...(receipt.installationPolicy ? [() => setInstallBlocked(shell, receipt.installationPolicy.originalBlocked)] : []),
    () => setStoreBackground(shell, receipt.originalBackground), () => restoreStoppedState(shell, receipt.wasStopped)]) {
    try { restore(); } catch (failure) { restored = false; errors.push(failure); }
  }
  const result = { method: receipt.method, restored, verified: errors.length === 0, observed };
  if (errors.length) throw Object.assign(new AggregateError(errors, 'Store background verification or restoration failed'), { receipt: result });
  return result;
}
