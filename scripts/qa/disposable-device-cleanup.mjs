import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

export function waitForDisposableDevice(adb, serial, execute = execFileSync) {
  assert.equal(process.env.SGM_LOCAL_DISPOSABLE_EMULATOR, 'true');
  assert.match(serial, /^emulator-\d+$/);
  const options = { encoding: 'utf8', timeout: 30_000 };
  execute(adb, ['-s', serial, 'wait-for-device'], options);
  assert.equal(execute(adb, ['-s', serial, 'get-state'], options).trim(), 'device');
  assert.equal(execute(adb, ['-s', serial, 'shell', 'getprop', 'ro.kernel.qemu'], options).trim(), '1');
}

export function finishDisposableCleanup(primaryFailure, steps) {
  const errors = primaryFailure === undefined ? [] : [primaryFailure];
  for (const step of steps) {
    try { step(); } catch (error) { errors.push(error); }
  }
  if (errors.length === 1) throw errors[0];
  if (errors.length > 1) throw new AggregateError(errors, 'Isolated replay and cleanup failures');
}
