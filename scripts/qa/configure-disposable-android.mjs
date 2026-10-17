import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { androidMapsPrerequisites } from './android-maps-prerequisites.mjs';

const launcher = 'com.google.android.apps.nexuslauncher';

export function configureDisposableAndroid(env = process.env, execute = execFileSync) {
  assert.equal(env.SGM_LOCAL_DISPOSABLE_EMULATOR, 'true', 'Select an explicitly disposable test emulator');
  const adb = env.ANDROID_HOME ? `${env.ANDROID_HOME}/platform-tools/adb` : 'adb';
  const run = (args) => {
    try { return execute(adb, args, { encoding: 'utf8', timeout: 30_000 }).trim(); }
    catch (failure) {
      const code = /^[A-Z0-9_]{1,40}$/.test(failure.code) ? failure.code : 'PROCESS_ERROR';
      const status = Number.isInteger(failure.status) ? failure.status : 'unknown';
      throw new Error(`Disposable Android setup command failed (${code}; exit ${status}).`);
    }
  };
  const serials = run(['devices']).split('\n')
    .filter((line) => /^emulator-\d+\s+device\s*$/.test(line)).map((line) => line.split(/\s/)[0]);
  assert.equal(serials.length, 1, 'Exactly one disposable emulator must be connected');
  const serial = serials[0];
  assert.equal(run(['-s', serial, 'shell', 'getprop', 'ro.kernel.qemu']), '1', 'Emulator identity required');
  const shell = (...args) => run(['-s', serial, 'shell', ...args]);
  const mapsRuntime = androidMapsPrerequisites(shell);
  assert.equal(shell('pm', 'path', launcher).startsWith('package:'), true, 'Expected Google APIs launcher missing');
  // This suite launches activities directly; exclude the independently crashing home app before execution.
  shell('pm', 'disable-user', '--user', '0', launcher);
  assert(shell('pm', 'list', 'packages', '-d', '--user', '0', launcher).split('\n')
    .includes(`package:${launcher}`), 'Launcher isolation was not applied');
  return { serial, launcher, launcherDisabled: true, mapsRuntime, scope: 'disposable-emulator-without-home-navigation' };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  console.log(JSON.stringify(configureDisposableAndroid()));
}
