import assert from 'node:assert/strict';
import { androidMapsPrerequisites } from './android-maps-prerequisites.mjs';
import { installationState } from './native-package-diagnostics.mjs';

export function readInstallBlocked(shell) {
  const value = shell('pm', 'get-user-restriction', '--user', '0', 'no_install_apps');
  assert(['true', 'false'].includes(value), 'Installation restriction is unavailable; do not infer a default');
  return value === 'true';
}
export function setInstallBlocked(shell, blocked) {
  assert.equal(typeof blocked, 'boolean');
  shell('pm', 'set-user-restriction', '--user', '0', 'no_install_apps', blocked ? '1' : '0');
  assert.equal(readInstallBlocked(shell), blocked, 'Installation restriction was not applied');
}
export function assertNoActiveInstall(shell) {
  const state = JSON.parse(installationState(shell('dumpsys', 'package', 'installs')));
  assert(!state.sections.filter(({ kind }) => kind === 'active').flatMap(({ sessions }) => sessions)
    .some((session) => session.mDestroyed !== true), 'An installation is active; do not interrupt it');
}
export function withTestApkInstallWindow(shell, install) {
  assert.equal(shell('getprop', 'ro.build.version.sdk'), '35');
  assert.equal(shell('getprop', 'ro.kernel.qemu'), '1');
  assert.equal(shell('am', 'get-current-user'), '0');
  assert.equal(readInstallBlocked(shell), true, 'The replay must start with the installation guard active');
  const maps = androidMapsPrerequisites(shell);
  assertNoActiveInstall(shell);
  shell('am', 'force-stop', '--user', '0', 'com.android.vending');
  let failure;
  try { setInstallBlocked(shell, false); install(); }
  catch (error) { failure = error; }
  const errors = failure ? [failure] : [];
  for (const check of [() => setInstallBlocked(shell, true), () => assertNoActiveInstall(shell),
    () => assert.deepEqual(androidMapsPrerequisites(shell), maps, 'Maps runtime changed during test APK installation')]) {
    try { check(); } catch (error) { errors.push(error); }
  }
  if (errors.length) throw new AggregateError(errors, 'Test APK installation or re-lock failed');
}
