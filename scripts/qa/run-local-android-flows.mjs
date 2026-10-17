#!/usr/bin/env node
import assert from 'node:assert/strict';
import { resolve, isAbsolute } from 'node:path';
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { prepareLocalRuntime, runEmulatorEntry, root } from './local-runtime.mjs';

assert.equal(process.env.SGM_LOCAL_DISPOSABLE_EMULATOR, 'true',
  'Ride UI tests inject synthetic positions: explicitly select a disposable emulator with no real accounts');
const adb = process.env.ANDROID_HOME ? `${process.env.ANDROID_HOME}/platform-tools/adb` : 'adb';
const devices = spawnSync(adb, ['devices'], { encoding: 'utf8' });
assert.equal(devices.status, 0, 'Android device inventory unavailable');
const available = devices.stdout.split('\n').filter((line) => /^emulator-\d+\s+device\s*$/.test(line)).map((line) => line.split(/\s/)[0]);
const serial = process.argv[2] || (available.length === 1 ? available[0] : undefined);
assert(serial && available.includes(serial), 'Select one available disposable Android emulator');
const runtime = prepareLocalRuntime();
try {
  const output = process.env.SGM_LOCAL_UI_OUTPUT || resolve(root, 'android/app/build/outputs/local-ui-evidence', runtime.env.SGM_LOCAL_RUN_ID);
  assert(isAbsolute(output) && !existsSync(output), 'UI evidence output must be a fresh absolute directory');
  runtime.env.SGM_LOCAL_ANDROID_SERIAL = serial;
  runtime.env.SGM_LOCAL_UI_SESSION_FILE = resolve(runtime.temp, 'ui-session.json');
  runtime.env.SGM_LOCAL_UI_OUTPUT = output;
  runtime.env.SGM_LOCAL_DISPOSABLE_EMULATOR = 'true';
  runEmulatorEntry(runtime, 'local-android-session.mjs');
}
finally { runtime.cleanup(); }
