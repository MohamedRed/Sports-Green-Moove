import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

export function disposableAndroidShell(env = process.env, execute = execFileSync) {
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
  return { serial, shell: (...args) => run(['-s', serial, 'shell', ...args]) };
}
