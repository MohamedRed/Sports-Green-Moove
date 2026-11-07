import test from 'node:test';
import assert from 'node:assert/strict';
import { resetDisposableLocalApps } from '../scripts/qa/reset-disposable-local-apps.mjs';

function fixture(output, { qemu = '1', result = 'Success', removalEffective = true } = {}) {
  const commands = [];
  const installed = new Set(output.trim().split('\n').filter(Boolean));
  const execute = (_command, args) => {
    commands.push(args);
    const key = args.slice(2).join(' ');
    if (key === 'wait-for-device') return '';
    if (key === 'get-state') return 'device';
    if (key === 'shell getprop ro.kernel.qemu') return qemu;
    if (key.startsWith('shell pm list packages')) return [...installed].join('\n');
    if (key.startsWith('uninstall ')) {
      if (result === 'Success' && removalEffective) installed.delete('package:' + args[3]);
      return result;
    }
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
  run('', {}, (f) => { resetDisposableLocalApps('adb', 'emulator-5572', f.execute); assert.equal(f.commands.length, 5); });
});
test('unknown packages, physical devices and unsuccessful removals stop the trial', () => {
  for (const [output, settings] of [['package:be.sportgreenmoove.app.local.other', {}], ['', { qemu: '0' }],
    ['package:be.sportgreenmoove.app.local', { result: 'Failure' }],
    ['package:be.sportgreenmoove.app.local', { removalEffective: false }]]) {
    run(output, settings, (f) => assert.throws(() => resetDisposableLocalApps('adb', 'emulator-5572', f.execute)));
  }
});
test('failure to remove the first package cannot skip the second removal or final inventory', () => {
  run('package:be.sportgreenmoove.app.local\npackage:be.sportgreenmoove.app.local.test\n', { result: 'Failure' }, (f) => {
    assert.throws(() => resetDisposableLocalApps('adb', 'emulator-5572', f.execute), (error) => {
      assert(error instanceof AggregateError); assert.equal(error.errors.length, 3); return true;
    });
    assert.deepEqual(f.commands.filter((args) => args[2] === 'uninstall').map((args) => args[3]),
      ['be.sportgreenmoove.app.local.test', 'be.sportgreenmoove.app.local']);
    assert.equal(f.commands.filter((args) => args.includes('packages')).length, 2);
  });
});
