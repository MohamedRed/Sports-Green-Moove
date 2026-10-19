import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { resolve, isAbsolute } from 'node:path';
import { spawnSync } from 'node:child_process';
import { prepareLocalRuntime, runEmulatorEntry, root } from './local-runtime.mjs';
import { waitForDisposableDevice } from './disposable-device-cleanup.mjs';

assert.equal(process.env.SGM_LOCAL_DISPOSABLE_EMULATOR, 'true');
const adb = process.env.ANDROID_HOME ? `${process.env.ANDROID_HOME}/platform-tools/adb` : 'adb';
const devices = spawnSync(adb, ['devices'], { encoding: 'utf8' }); assert.equal(devices.status, 0);
const available = devices.stdout.split('\n').filter((line) => /^emulator-\d+\s+device\s*$/.test(line)).map((line) => line.split(/\s/)[0]);
const serial = process.argv[2] || (available.length === 1 ? available[0] : undefined);
assert(serial && available.includes(serial), 'Select one disposable Android emulator');
const boot = spawnSync(adb, ['-s', serial, 'shell', 'getprop', 'sys.boot_completed'], { encoding: 'utf8' });
assert.equal(boot.status, 0); assert.equal(boot.stdout.trim(), '1', 'Complete disposable device startup before the scenario');
waitForDisposableDevice(adb, serial);
const runtime = prepareLocalRuntime();
try {
  const output = process.env.SGM_LOCAL_UI_OUTPUT || resolve(root, 'android/app/build/outputs/local-ui-evidence', runtime.env.SGM_LOCAL_RUN_ID);
  assert(isAbsolute(output) && !existsSync(output), 'Use a fresh evidence directory');
  Object.assign(runtime.env, { SGM_LOCAL_ANDROID_SERIAL: serial, SGM_LOCAL_UI_SESSION_FILE: resolve(runtime.temp, 'ui-session.json'),
    SGM_LOCAL_UI_OUTPUT: output, SGM_LOCAL_DISPOSABLE_EMULATOR: 'true' });
  if (process.env.SGM_BLOCK_TEST_PHONE_INSTALLS === 'true') {
    assert.equal(process.env.SGM_PAUSE_TEST_PHONE_STORE, 'true');
    Object.assign(runtime.env, { SGM_BLOCK_TEST_PHONE_INSTALLS: 'true', SGM_PAUSE_TEST_PHONE_STORE: 'true' });
  }
  for (const key of ['SGM_PREINSTALLED_TEST_APKS_RECEIPT', 'SGM_FOCUSED_UI_CASE', 'SGM_TEST_PHONE_ADMIN_APPROVED'])
    if (process.env[key] !== undefined) runtime.env[key] = process.env[key];
  runEmulatorEntry(runtime, 'local-ride-observation-ui.mjs');
} finally { runtime.cleanup(); }
