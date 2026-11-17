import assert from 'node:assert/strict';

export const disposableLauncher = 'com.google.android.apps.nexuslauncher';
export function assertDisposableLauncherEnabled(shell) {
  assert(shell('pm', 'path', disposableLauncher).startsWith('package:'), 'Expected Google APIs launcher missing');
  assert.equal(shell('pm', 'list', 'packages', '-e', '--user', '0', disposableLauncher), `package:${disposableLauncher}`,
    'A fresh disposable launcher must initially be enabled');
}
export function disableDisposableLauncher(shell) {
  shell('pm', 'disable-user', '--user', '0', disposableLauncher);
  assert.equal(shell('pm', 'list', 'packages', '-d', '--user', '0', disposableLauncher), `package:${disposableLauncher}`,
    'Launcher isolation was not applied');
}
export function restoreDisposableLauncher(shell) {
  shell('pm', 'enable', '--user', '0', disposableLauncher);
  assert.equal(shell('pm', 'list', 'packages', '-e', '--user', '0', disposableLauncher), `package:${disposableLauncher}`,
    'Disposable launcher restoration was not verified');
  return true;
}
