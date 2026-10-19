import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { disposableAndroidShell } from './disposable-android-shell.mjs';
import { withTestApkInstallWindow } from './disposable-installations.mjs';

export const disposableTestRunner = 'be.sportgreenmoove.app.ui.DisposableAndroidJUnitRunner';
export function installationGuardArguments(env = process.env) {
  assert(env.SGM_BLOCK_TEST_PHONE_INSTALLS === undefined || ['true', 'false'].includes(env.SGM_BLOCK_TEST_PHONE_INSTALLS));
  return env.SGM_BLOCK_TEST_PHONE_INSTALLS === 'true' ? ['-e', 'sgmBlockInstallations', 'true'] : [];
}
export function installDisposableTestApks({ adb, serial, android, run, env = process.env }) {
  const install = () => {
    for (const apk of ['apk/debug/app-debug.apk', 'apk/androidTest/debug/app-debug-androidTest.apk'])
      run(adb, ['-s', serial, 'install', '-r', resolve(android, 'app/build/outputs', apk)]);
  };
  if (installationGuardArguments(env).length) {
    assert.equal(env.SGM_PAUSE_TEST_PHONE_STORE, 'true');
    const device = disposableAndroidShell(env);
    assert.equal(device.serial, serial, 'Installation window refuses a different test phone');
    withTestApkInstallWindow(device.shell, install);
  } else install();
}
