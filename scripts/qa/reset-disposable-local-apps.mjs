import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { waitForDisposableDevice } from './disposable-device-cleanup.mjs';

export function resetDisposableLocalApps(adb, serial, execute = execFileSync) {
  return resetDisposableTestApps(adb, serial, ['be.sportgreenmoove.app.local.test', 'be.sportgreenmoove.app.local'], execute);
}
export function resetDisposableTestApps(adb, serial, packages, execute = execFileSync) {
  const variants = [['be.sportgreenmoove.app.local.test', 'be.sportgreenmoove.app.local'],
    ['be.sportgreenmoove.app.local.test', 'be.sportgreenmoove.app.local', 'be.sportgreenmoove.app.test', 'be.sportgreenmoove.app']];
  assert(variants.some(names => JSON.stringify(names) === JSON.stringify(packages)), 'Select one exact owned test APK set');
  const prefix = packages.at(-1);
  waitForDisposableDevice(adb, serial, execute);
  const options = { encoding: 'utf8', timeout: 30_000 };
  const output = execute(adb, ['-s', serial, 'shell', 'pm', 'list', 'packages', '--user', '0', prefix], options);
  const allowed = packages;
  const installed = new Set(output.trim().split('\n').filter(Boolean).map((line) => {
    const match = /^package:([a-z0-9.]+)$/.exec(line.trim());
    assert(match && allowed.includes(match[1]), 'Only the selected explicitly disposable packages may be reset');
    return match[1];
  }));
  const errors = [];
  for (const name of allowed.filter((name) => installed.has(name)))
    try { assert.equal(execute(adb, ['-s', serial, 'uninstall', name], options).trim(), 'Success', 'Disposable reset must be confirmed'); }
    catch (failure) { errors.push(failure); }
  try {
    assert.equal(execute(adb, ['-s', serial, 'shell', 'pm', 'list', 'packages', '--user', '0', prefix], options).trim(), '',
      'All selected disposable packages must be absent after cleanup');
  } catch (failure) { errors.push(failure); }
  if (errors.length) throw new AggregateError(errors, 'Disposable local package cleanup failed; all removals attempted');
}
