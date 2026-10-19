import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { waitForDisposableDevice } from './disposable-device-cleanup.mjs';

export function resetDisposableLocalApps(adb, serial, execute = execFileSync) {
  waitForDisposableDevice(adb, serial, execute);
  const options = { encoding: 'utf8', timeout: 30_000 };
  const output = execute(adb, ['-s', serial, 'shell', 'pm', 'list', 'packages', '--user', '0', 'be.sportgreenmoove.app.local'], options);
  const allowed = ['be.sportgreenmoove.app.local.test', 'be.sportgreenmoove.app.local'];
  const installed = new Set(output.trim().split('\n').filter(Boolean).map((line) => {
    const match = /^package:(be\.sportgreenmoove\.app\.local(?:\.test)?)$/.exec(line.trim());
    assert(match, 'Only the two explicitly disposable local packages may be reset');
    return match[1];
  }));
  for (const name of allowed.filter((name) => installed.has(name))) {
    assert.equal(execute(adb, ['-s', serial, 'uninstall', name], options).trim(), 'Success', 'Disposable reset must be confirmed');
  }
}
