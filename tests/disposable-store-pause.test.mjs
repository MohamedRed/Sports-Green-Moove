import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pauseDisposableStore, restoreDisposableStore, storeStateCommand } from '../scripts/qa/disposable-store-pause.mjs';
import { playServicesVersionCommand } from '../scripts/qa/android-maps-prerequisites.mjs';
import { configureDisposableAndroid } from '../scripts/qa/configure-disposable-android.mjs';
import { readStoreBackgroundMode, storeBackgroundRestrictions } from '../scripts/qa/disposable-store-background.mjs';

test('a pre-install admin readiness failure survives outer cleanup without claiming a prepared device', () => {
  const mock = device(), commands = []; let attempted = false;
  const execute = (_command, args) => {
    if (args[0] === 'devices') return 'List of devices attached\nemulator-5554\tdevice\n';
    if (args[2] === 'wait-for-device') return '';
    if (args[2] === 'get-state') return 'device';
    const shell = args.slice(3), command = shell.join(' '); commands.push(command);
    if (command === 'getprop ro.kernel.qemu') return '1';
    if (command === 'pm path com.google.android.apps.nexuslauncher') return 'package:/system/launcher.apk';
    if (command === 'pm disable-user --user 0 com.google.android.apps.nexuslauncher') return 'disabled-user';
    if (command === 'pm list packages -d --user 0 com.google.android.apps.nexuslauncher') return 'package:com.google.android.apps.nexuslauncher';
    return mock.shell(...shell);
  };
  assert.throws(() => configureDisposableAndroid({ SGM_LOCAL_DISPOSABLE_EMULATOR: 'true', SGM_PAUSE_TEST_PHONE_STORE: 'true',
    SGM_BLOCK_TEST_PHONE_INSTALLS: 'true', SGM_TEST_PHONE_ADMIN_APPROVED: 'true' }, execute, {
      prepareAdmin: (_device, { approved }) => {
        assert.equal(approved, true); attempted = true;
        throw Object.assign(new Error('Policy observation unavailable'), { receipt: {
          scope: 'failed-disposable-admin-setup-not-flow-proof', stage: 'policy-readiness',
          installAttempted: false, cleanup: null, verified: false } });
      },
    }), (error) => {
    assert.deepEqual(error.receipt.adminSetupFailure, { scope: 'failed-disposable-admin-setup-not-flow-proof',
      stage: 'policy-readiness', installAttempted: false, cleanup: null, verified: false });
    assert.equal(error.receipt.adminCleanup, null); assert.equal(error.receipt.storeCleanup.restored, true);
    assert.equal(error.receipt.storeCleanup.verified, false); return true;
  });
  assert.equal(attempted, true);
  assert(!commands.some((command) => /install -t|set-device-owner/.test(command)));
});

function device(options = {}) {
  const calls = [];
  let stopped = options.wasStopped ?? false;
  let mutated = false;
  let installBlocked = options.installBlocked ?? false;
  const background = { RUN_IN_BACKGROUND: options.backgroundMode ?? 'allow', RUN_ANY_IN_BACKGROUND: options.backgroundMode ?? 'allow' };
  const shell = (...args) => {
    const command = args.join(' '); calls.push(command);
    if (command === 'getprop ro.build.version.sdk') return options.sdk ?? '35';
    if (command === 'pm get-user-restriction --user 0 no_install_apps') return String(installBlocked);
    if (command.startsWith('am broadcast --user 0 --receiver-foreground ')) {
      installBlocked = args.at(-1) === 'true';
      return `Broadcast completed: result=-1, data="SGM_INSTALL_BLOCKED=${installBlocked}"`;
    }
    if (command.startsWith('pm list packages -e --user 0 ')) return `package:${args.at(-1)}`;
    if (command === playServicesVersionCommand) return `versionName=${mutated && options.versionChanged ? '26.0.0' : '25.39.33'}`;
    if (command === 'cmd location is-location-enabled --user 0') return options.location ?? 'true';
    if (command === storeStateCommand) return options.stateMalformed ? 'unknown' :
      `  User 0: installed=true stopped=${stopped} enabled=0` + (options.bareUserHeader ? '\n  User 0:\n' : '') +
      (options.duplicateState ? '\n  User 0: installed=true stopped=false enabled=0' : '');
    if (command === 'dumpsys package installs') return options.installs ?? 'Active install sessions:\nHistorical install sessions:\n';
    if (args[0] === 'cmd' && args[1] === 'appops') {
      const operation = args[6];
      if (args[2] === 'get') return options.backgroundMalformed ? 'unavailable' : `${operation}: ${background[operation]}`;
      if (args[2] === 'set') { if (!options.policyIgnored) background[operation] = args[7]; return ''; }
    }
    if (command === 'am force-stop --user 0 com.android.vending') { mutated = true; stopped = !options.stopIgnored; return ''; }
    if (command === 'pm unstop --user 0 com.android.vending') { stopped = false; return ''; }
    throw new Error('Unexpected device command: ' + command);
  };
  return { shell, calls, background, stopped: () => stopped, resumeUnexpectedly: () => { stopped = false; },
    installBlocked: () => installBlocked, activateInstallGuard: () => { installBlocked = true; } };
}

test('approved store-only stop preserves enabled maps/location and restores original state', () => {
  assert.deepEqual(storeBackgroundRestrictions, { RUN_IN_BACKGROUND: 'ignore', RUN_ANY_IN_BACKGROUND: 'deny' });
  const mock = device();
  const receipt = pauseDisposableStore(mock.shell);
  assert.equal(mock.stopped(), true); assert.equal(receipt.wasStopped, false);
  assert.deepEqual(mock.background, storeBackgroundRestrictions);
  assert.deepEqual(restoreDisposableStore(mock.shell, receipt), {
    method: 'restricted-store-background', restored: true, verified: true,
    observed: { storeStopped: true, background: storeBackgroundRestrictions, mapsRuntime: receipt.mapsRuntime,
      locationEnabled: true, noActiveStoreInstall: true },
  });
  assert.deepEqual(mock.background, receipt.originalBackground);
  assert.equal(mock.stopped(), false);
  assert.deepEqual(mock.calls.filter((line) => /force-stop|unstop|disable|enable |settings put|svc /.test(line)),
    ['am force-stop --user 0 com.android.vending', 'pm unstop --user 0 com.android.vending']);
  assert(mock.calls.filter((line) => line.startsWith('cmd appops set')).every((line) => line.includes('--user 0 com.android.vending RUN_')));
});

test('already-stopped store remains stopped after cleanup', () => {
  const mock = device({ wasStopped: true }); const receipt = pauseDisposableStore(mock.shell);
  restoreDisposableStore(mock.shell, receipt);
  assert.equal(mock.stopped(), true); assert(!mock.calls.some((line) => line.startsWith('pm unstop')));
});

test('the approved installation guard records the actual baseline and restores it after a guarded run', () => {
  const mock = device();
  const receipt = pauseDisposableStore(mock.shell, { blockInstallations: true });
  assert.deepEqual(receipt.installationPolicy, { originalBlocked: false });
  assert.equal(mock.installBlocked(), false, 'Gradle must install its test APKs before the runner locks installations');
  mock.activateInstallGuard();
  const result = restoreDisposableStore(mock.shell, receipt);
  assert.equal(result.verified, true); assert.equal(result.restored, true);
  assert.equal(result.observed.installationsBlocked, true); assert.equal(mock.installBlocked(), false);
});

test('an unactivated guard fails verification but still restores the exact original policy', () => {
  const mock = device(); const receipt = pauseDisposableStore(mock.shell, { blockInstallations: true });
  assert.throws(() => restoreDisposableStore(mock.shell, receipt), (error) => {
    assert.equal(error.receipt.verified, false); assert.equal(error.receipt.restored, true); return true;
  });
  assert.equal(mock.installBlocked(), false); assert.equal(mock.stopped(), false);
});

test('the approved preparation never clears a pre-existing install prohibition', () => {
  const mock = device({ installBlocked: true });
  assert.throws(() => pauseDisposableStore(mock.shell, { blockInstallations: true }), /existing installation restriction/);
  assert.equal(mock.installBlocked(), true);
  assert(!mock.calls.some((line) => /force-stop|set-user-restriction|appops set/.test(line)));
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
    { backgroundMalformed: true },
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
    assert.deepEqual(mock.background, { RUN_IN_BACKGROUND: 'allow', RUN_ANY_IN_BACKGROUND: 'allow' });
  }
});
test('failed initial stop retains its actual false observation and successful rollback without claiming verification', () => {
  const mock = device({ stopIgnored: true });
  assert.throws(() => pauseDisposableStore(mock.shell), (error) => {
    assert.equal(error.errors[0].message.split('\n')[0], 'Store pause was not applied');
    assert.equal(error.receipt.stage, 'stopped-verification'); assert.equal(error.receipt.observed.storeStopped, false);
    assert.deepEqual(error.receipt.observed.background, storeBackgroundRestrictions);
    assert.equal(error.receipt.original.wasStopped, false);
    assert.deepEqual(error.receipt.restoration, { background: true, stopped: true });
    assert.equal(error.receipt.restored, true); assert.equal(error.receipt.verified, false);
    assert.equal(error.receipt.diagnostics.status, 'unavailable'); return true;
  });
  assert.equal(mock.calls.filter((line) => line.startsWith('am force-stop')).length, 1);
});

test('a failed rollback remains separate from the original stop failure', () => {
  const mock = device({ stopIgnored: true });
  const shell = (...args) => {
    if (args.join(' ') === 'cmd appops set --user 0 com.android.vending RUN_ANY_IN_BACKGROUND allow') throw Error('restore failed');
    return mock.shell(...args);
  };
  assert.throws(() => pauseDisposableStore(shell), (error) => {
    assert.equal(error.errors.length, 2); assert.equal(error.receipt.observed.storeStopped, false);
    assert.deepEqual(error.receipt.restoration, { background: false, stopped: true });
    assert.equal(error.receipt.restored, false); assert.equal(error.receipt.verified, false); return true;
  });
});
test('outer device setup retains the failed store observation rather than losing it as null cleanup', () => {
  const mock = device({ stopIgnored: true });
  const execute = (_command, args) => {
    if (args[0] === 'devices') return 'List of devices attached\nemulator-5554\tdevice\n';
    if (args[2] === 'wait-for-device') return '';
    if (args[2] === 'get-state') return 'device';
    const shell = args.slice(3), command = shell.join(' ');
    if (command === 'getprop ro.kernel.qemu') return '1';
    if (command === 'pm path com.google.android.apps.nexuslauncher') return 'package:/system/launcher.apk';
    if (command === 'pm disable-user --user 0 com.google.android.apps.nexuslauncher') return 'disabled-user';
    if (command === 'pm list packages -d --user 0 com.google.android.apps.nexuslauncher') return 'package:com.google.android.apps.nexuslauncher';
    return mock.shell(...shell);
  };
  assert.throws(() => configureDisposableAndroid({ SGM_LOCAL_DISPOSABLE_EMULATOR: 'true', SGM_PAUSE_TEST_PHONE_STORE: 'true' }, execute), (error) => {
    assert.equal(error.receipt.scope, 'failed-disposable-device-setup-not-flow-proof');
    assert.equal(error.receipt.storePauseFailure.scope, 'failed-store-pause-not-flow-proof');
    assert.equal(error.receipt.storePauseFailure.observed.storeStopped, false);
    assert.equal(error.receipt.storePauseFailure.restored, true);
    assert.equal(error.receipt.storePauseFailure.verified, false);
    assert.equal(error.receipt.storeCleanup, null); assert.equal(error.receipt.adminCleanup, null); return true;
  });
});
test('a store service waking does not release the independently verified background restriction', () => {
  const mock = device(); const receipt = pauseDisposableStore(mock.shell); mock.resumeUnexpectedly();
  assert.deepEqual(mock.background, storeBackgroundRestrictions);
  const result = restoreDisposableStore(mock.shell, receipt);
  assert.equal(result.verified, true); assert.equal(result.observed.storeStopped, false);
  assert.equal(mock.stopped(), false);
});

test('lost background policy fails verification, preserves a typed failure receipt and still restores both operations', () => {
  const mock = device(); const receipt = pauseDisposableStore(mock.shell);
  mock.background.RUN_ANY_IN_BACKGROUND = 'allow';
  assert.throws(() => restoreDisposableStore(mock.shell, receipt), (error) => {
    assert.equal(error.receipt.verified, false); assert.equal(error.receipt.restored, true); return true;
  });
  assert.deepEqual(mock.background, receipt.originalBackground); assert.equal(mock.stopped(), false);
  const ignored = device({ policyIgnored: true }); assert.throws(() => pauseDisposableStore(ignored.shell));
  assert(!ignored.calls.some((line) => line.startsWith('am force-stop')));
});

test('background-mode reads accept only declared OS defaults or exact package operations, never UID-wide policy', () => {
  assert.equal(readStoreBackgroundMode(() => 'No operations.\nDefault mode: allow', 'RUN_IN_BACKGROUND'), 'allow');
  assert.equal(readStoreBackgroundMode(() => 'RUN_IN_BACKGROUND: ignore; time=+12s', 'RUN_IN_BACKGROUND'), 'ignore');
  for (const output of ['No operations.', 'RUN_IN_BACKGROUND: unknown', 'Uid mode: RUN_IN_BACKGROUND: allow\nRUN_IN_BACKGROUND: ignore',
    'RUN_IN_BACKGROUND: allow\nRUN_IN_BACKGROUND: deny']) assert.throws(() => readStoreBackgroundMode(() => output, 'RUN_IN_BACKGROUND'));
  const mock = device({ wasStopped: true, backgroundMode: 'ignore' }); const receipt = pauseDisposableStore(mock.shell);
  mock.resumeUnexpectedly(); restoreDisposableStore(mock.shell, receipt);
  assert.equal(mock.stopped(), true); assert.deepEqual(mock.background, receipt.originalBackground);
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
