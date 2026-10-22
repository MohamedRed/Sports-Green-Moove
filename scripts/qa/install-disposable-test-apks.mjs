import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { disposableAndroidShell } from './disposable-android-shell.mjs';
import { withTestApkInstallWindow } from './disposable-installations.mjs';
import { preparePinnedApks, usePreinstalledTestApks } from './preinstalled-disposable-apks.mjs';
import { resetDisposableLocalApps } from './reset-disposable-local-apps.mjs';
export { usePreinstalledTestApks };

export const disposableTestRunner = 'be.sportgreenmoove.app.ui.DisposableAndroidJUnitRunner';
export const disposableApkSourceFiles = ['scripts/qa/install-disposable-test-apks.mjs',
  'scripts/qa/android-case-apks.mjs',
  'scripts/qa/preinstalled-disposable-apks.mjs', 'scripts/qa/continuous-disposable-device.mjs',
  'scripts/qa/configure-continuous-disposable.mjs', 'scripts/qa/restore-continuous-disposable.mjs',
  'scripts/qa/reset-disposable-local-apps.mjs', 'scripts/qa/disposable-installations.mjs',
  'scripts/qa/disposable-install-admin.mjs', 'scripts/run-focused-android-ui.sh', '.github/workflows/native-focused-ui.yml',
  'android/app/src/androidTest/java/be/sportgreenmoove/app/ui/DisposableAndroidJUnitRunner.kt'];
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

export function prepareDisposableTestApks(options) {
  const env = options.env ?? process.env;
  if (usePreinstalledTestApks(env)) return preparePinnedApks({ ...options, env });
  resetDisposableLocalApps(options.adb, options.serial);
  installDisposableTestApks({ ...options, env });
  return { method: 'fresh-install-for-replay' };
}
