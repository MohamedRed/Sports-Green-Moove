import test from 'node:test';
import assert from 'node:assert/strict';
import { resetDisposableLocalApps } from '../scripts/qa/reset-disposable-local-apps.mjs';

function fixture(output, { qemu = '1', result = 'Success' } = {}) {
  const commands = [];
  const execute = (_command, args) => {
    commands.push(args);
    const key = args.slice(2).join(' ');
    if (key === 'wait-for-device') return '';
    if (key === 'get-state') return 'device';
    if (key === 'shell getprop ro.kernel.qemu') return qemu;
    if (key.startsWith('shell pm list packages')) return output;
    if (key.startsWith('uninstall ')) return result;
    throw Error('Unexpected command ' + key);
  };
  return { commands, execute };
}
function run(output, settings, action) {
  const original = process.env.SGM_LOCAL_DISPOSABLE_EMULATOR;
  process.env.SGM_LOCAL_DISPOSABLE_EMULATOR = 'true';
  try { const f = fixture(output, settings); action(f); }
  finally { if (original == null) delete process.env.SGM_LOCAL_DISPOSABLE_EMULATOR; else process.env.SGM_LOCAL_DISPOSABLE_EMULATOR = original; }
}
test('a new independent trial explicitly removes only its two local packages before installation', () => {
  run('package:be.sportgreenmoove.app.local\npackage:be.sportgreenmoove.app.local.test\n', {}, (f) => {
    resetDisposableLocalApps('adb', 'emulator-5572', f.execute);
    assert.deepEqual(f.commands.filter((args) => args[2] === 'uninstall').map((args) => args[3]),
      ['be.sportgreenmoove.app.local.test', 'be.sportgreenmoove.app.local']);
    assert(!f.commands.some((args) => args.includes('be.sportgreenmoove.app')));
  });
});
test('a fresh device does not fabricate an uninstall or change unrelated settings', () => {
  run('', {}, (f) => { resetDisposableLocalApps('adb', 'emulator-5572', f.execute); assert.equal(f.commands.length, 4); });
});
test('unknown packages, physical devices and unsuccessful removals stop the trial', () => {
  for (const [output, settings] of [['package:be.sportgreenmoove.app.local.other', {}], ['', { qemu: '0' }],
    ['package:be.sportgreenmoove.app.local', { result: 'Failure' }]]) {
    run(output, settings, (f) => assert.throws(() => resetDisposableLocalApps('adb', 'emulator-5572', f.execute)));
  }
});
