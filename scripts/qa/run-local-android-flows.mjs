#!/usr/bin/env node
import assert from 'node:assert/strict';
import { resolve, isAbsolute } from 'node:path';
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { prepareLocalRuntime, runEmulatorEntry, root } from './local-runtime.mjs';
import { selectDisposableEmulator } from './disposable-emulator-selection.mjs';
import { waitForDisposableDevice } from './disposable-device-cleanup.mjs';

assert.equal(process.env.SGM_LOCAL_DISPOSABLE_EMULATOR, 'true',
  'Ride UI tests inject synthetic positions: explicitly select a disposable emulator with no real accounts');
const adb = process.env.ANDROID_HOME ? `${process.env.ANDROID_HOME}/platform-tools/adb` : 'adb';
const devices = spawnSync(adb, ['devices'], { encoding: 'utf8', timeout: 30_000 });
assert.equal(devices.status, 0, 'Android device inventory unavailable');
const serial = selectDisposableEmulator(devices.stdout, process.argv[2]);
waitForDisposableDevice(adb, serial);
const runtime = prepareLocalRuntime();
try {
  const output = process.env.SGM_LOCAL_UI_OUTPUT || resolve(root, 'android/app/build/outputs/local-ui-evidence', runtime.env.SGM_LOCAL_RUN_ID);
  assert(isAbsolute(output) && !existsSync(output), 'UI evidence output must be a fresh absolute directory');
  runtime.env.SGM_LOCAL_ANDROID_SERIAL = serial;
  runtime.env.SGM_LOCAL_UI_SESSION_FILE = resolve(runtime.temp, 'ui-session.json');
  runtime.env.SGM_LOCAL_UI_OUTPUT = output;
  runtime.env.SGM_LOCAL_DISPOSABLE_EMULATOR = 'true';
  if (process.env.SGM_BLOCK_TEST_PHONE_INSTALLS === 'true') {
    assert.equal(process.env.SGM_PAUSE_TEST_PHONE_STORE, 'true');
    runtime.env.SGM_BLOCK_TEST_PHONE_INSTALLS = 'true';
    runtime.env.SGM_PAUSE_TEST_PHONE_STORE = 'true';
  }
  runEmulatorEntry(runtime, 'local-android-session.mjs');
}
finally { runtime.cleanup(); }
