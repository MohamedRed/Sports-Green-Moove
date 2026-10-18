import assert from 'node:assert/strict';
import { androidMapsPrerequisites } from './android-maps-prerequisites.mjs';
import { installationState } from './native-package-diagnostics.mjs';

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

export function pauseDisposableStore(shell) {
  assert.equal(shell('getprop', 'ro.build.version.sdk'), '35', 'Store pause requires the approved Android 15 test image');
  const mapsRuntime = androidMapsPrerequisites(shell);
  locationEnabled(shell);
  const wasStopped = stopped(shell);
  noStoreInstall(shell);
  try {
    shell('am', 'force-stop', '--user', '0', store);
    assert.equal(stopped(shell), true, 'Store pause was not applied');
    noStoreInstall(shell);
    assert.deepEqual(androidMapsPrerequisites(shell), mapsRuntime, 'Maps runtime changed during store pause');
    locationEnabled(shell);
  } catch (failure) {
    if (!wasStopped) {
      try { shell('pm', 'unstop', '--user', '0', store); assert.equal(stopped(shell), false); }
      catch (cleanup) { throw new AggregateError([failure, cleanup], 'Store pause and restore failed'); }
    }
    throw failure;
  }
  return { method: 'force-stop-store-only', wasStopped, mapsRuntime, locationEnabled: true };
}

export function restoreDisposableStore(shell, receipt) {
  assert.equal(receipt?.method, 'force-stop-store-only');
  assert.equal(typeof receipt.wasStopped, 'boolean');
  assert.equal(shell('getprop', 'ro.build.version.sdk'), '35');
  const stayedStopped = stopped(shell);
  if (!receipt.wasStopped) {
    shell('pm', 'unstop', '--user', '0', store);
    assert.equal(stopped(shell), false, 'Store original state was not restored');
  }
  assert.equal(stayedStopped, true, 'The store resumed unexpectedly during the test');
  assert.deepEqual(androidMapsPrerequisites(shell), receipt.mapsRuntime, 'Maps runtime changed during the test');
  locationEnabled(shell);
  return { restored: true, storeStayedStopped: true, mapsRuntimeUnchanged: true, locationEnabled: true };
}
