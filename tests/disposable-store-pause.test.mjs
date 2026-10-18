import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pauseDisposableStore, restoreDisposableStore, storeStateCommand } from '../scripts/qa/disposable-store-pause.mjs';
import { playServicesVersionCommand } from '../scripts/qa/android-maps-prerequisites.mjs';
import { configureDisposableAndroid } from '../scripts/qa/configure-disposable-android.mjs';

function device(options = {}) {
  const calls = [];
  let stopped = options.wasStopped ?? false;
  let mutated = false;
  const shell = (...args) => {
    const command = args.join(' '); calls.push(command);
    if (command === 'getprop ro.build.version.sdk') return options.sdk ?? '35';
    if (command.startsWith('pm list packages -e --user 0 ')) return `package:${args.at(-1)}`;
    if (command === playServicesVersionCommand) return `versionName=${mutated && options.versionChanged ? '26.0.0' : '25.39.33'}`;
    if (command === 'cmd location is-location-enabled --user 0') return options.location ?? 'true';
    if (command === storeStateCommand) return options.stateMalformed ? 'unknown' :
      `  User 0: installed=true stopped=${stopped} enabled=0` + (options.bareUserHeader ? '\n  User 0:\n' : '') +
      (options.duplicateState ? '\n  User 0: installed=true stopped=false enabled=0' : '');
    if (command === 'dumpsys package installs') return options.installs ?? 'Active install sessions:\nHistorical install sessions:\n';
    if (command === 'am force-stop --user 0 com.android.vending') { mutated = true; stopped = !options.stopIgnored; return ''; }
    if (command === 'pm unstop --user 0 com.android.vending') { stopped = false; return ''; }
    throw new Error('Unexpected device command: ' + command);
  };
  return { shell, calls, stopped: () => stopped, resumeUnexpectedly: () => { stopped = false; } };
}

test('approved store-only stop preserves enabled maps/location and restores original state', () => {
  const mock = device();
  const receipt = pauseDisposableStore(mock.shell);
  assert.equal(mock.stopped(), true); assert.equal(receipt.wasStopped, false);
  assert.deepEqual(restoreDisposableStore(mock.shell, receipt), {
    restored: true, storeStayedStopped: true, mapsRuntimeUnchanged: true, locationEnabled: true,
  });
  assert.equal(mock.stopped(), false);
  assert.deepEqual(mock.calls.filter((line) => /force-stop|unstop|disable|enable |settings put|svc /.test(line)),
    ['am force-stop --user 0 com.android.vending', 'pm unstop --user 0 com.android.vending']);
});

test('already-stopped store remains stopped after cleanup', () => {
  const mock = device({ wasStopped: true }); const receipt = pauseDisposableStore(mock.shell);
  restoreDisposableStore(mock.shell, receipt);
  assert.equal(mock.stopped(), true); assert(!mock.calls.some((line) => line.startsWith('pm unstop')));
});

test('bare AOSP permission/changed-package user headings are not a second package state', () => {
  const mock = device({ bareUserHeader: true }); const receipt = pauseDisposableStore(mock.shell);
  assert.equal(mock.stopped(), true); restoreDisposableStore(mock.shell, receipt); assert.equal(mock.stopped(), false);
  const ambiguous = device({ duplicateState: true });
  assert.throws(() => pauseDisposableStore(ambiguous.shell), /Exactly one store user state/);
  assert(!ambiguous.calls.some((line) => /force-stop|unstop/.test(line)));
});

test('unsafe or incompatible preconditions refuse mutation without retrying', () => {
  for (const options of [{ sdk: '34' }, { location: 'false' }, { stateMalformed: true }, { installs: 'unavailable' },
    { installs: 'Active install sessions:\n  Session 123:\n    installInitiatingPackageName=com.android.vending mCommitted=true\nHistorical install sessions:\n' }]) {
    const mock = device(options); assert.throws(() => pauseDisposableStore(mock.shell));
    assert(!mock.calls.some((line) => /force-stop|unstop/.test(line)));
  }
});

test('failed pause or changed runtime rolls back without hiding the failure', () => {
  for (const options of [{ stopIgnored: true }, { versionChanged: true }]) {
    const mock = device(options); assert.throws(() => pauseDisposableStore(mock.shell));
    assert.equal(mock.stopped(), false);
    assert.equal(mock.calls.filter((line) => line.startsWith('am force-stop')).length, 1);
    assert.equal(mock.calls.filter((line) => line.startsWith('pm unstop')).length, 1);
  }
});

test('unexpected store resumption fails verification rather than pretending isolation held', () => {
  const mock = device(); const receipt = pauseDisposableStore(mock.shell); mock.resumeUnexpectedly();
  assert.throws(() => restoreDisposableStore(mock.shell, receipt), /resumed unexpectedly/);
  assert.equal(mock.stopped(), false);
});

test('setup refuses physical and unapproved targets before any store operation', () => {
  for (const env of [{ SGM_PAUSE_TEST_PHONE_STORE: 'true' },
    { SGM_LOCAL_DISPOSABLE_EMULATOR: 'true', SGM_PAUSE_TEST_PHONE_STORE: 'true' }]) {
    const calls = [];
    assert.throws(() => configureDisposableAndroid(env, (_command, args) => { calls.push(args); return 'physical-123\tdevice\n'; }));
    assert(calls.length <= 1);
  }
});

test('both CI entry points run store-pause guards and only the disposable native image opts in', () => {
  const workflow = readFileSync(new URL('../.github/workflows/native-ci.yml', import.meta.url), 'utf8');
  assert(workflow.includes('SGM_PAUSE_TEST_PHONE_STORE: "true"'));
  for (const name of ['native-ci.yml', 'web-integration-smoke.yml']) {
    const text = readFileSync(new URL('../.github/workflows/' + name, import.meta.url), 'utf8');
    assert(text.includes('tests/disposable-store-pause.test.mjs'));
  }
});
