import assert from 'node:assert/strict';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, isAbsolute } from 'node:path';
import { spawnSync } from 'node:child_process';
import { prepareLocalRuntime, runEmulatorEntry, root } from './local-runtime.mjs';
import { waitForDisposableDevice } from './disposable-device-cleanup.mjs';
import { retainLocalEmulatorLogs } from './local-emulator-log-evidence.mjs';
import { assertLocalEndpointsClosed } from './local-emulator-lifecycle.mjs';

export async function runIsolatedRideUi(name) {
  const entries = { 'native-startup': 'local-native-startup-ui.mjs', 'remote-ride-stop': 'local-remote-ride-stop-ui.mjs',
    'vehicle-map': 'local-vehicle-map-ui.mjs', 'emergency-identity': 'local-emergency-identity-ui.mjs',
    'session-restoration': 'local-session-restoration-ui.mjs', 'session-disconnect': 'local-session-disconnect-ui.mjs' };
  assert(Object.hasOwn(entries, name));
  assert.equal(process.env.SGM_LOCAL_DISPOSABLE_EMULATOR, 'true');
  const adb = process.env.ANDROID_HOME ? `${process.env.ANDROID_HOME}/platform-tools/adb` : 'adb';
  const devices = spawnSync(adb, ['devices'], { encoding: 'utf8' }); assert.equal(devices.status, 0);
  const available = devices.stdout.split('\n').filter((line) => /^emulator-\d+\s+device\s*$/.test(line)).map((line) => line.split(/\s/)[0]);
  const serial = process.argv[2] || (available.length === 1 ? available[0] : undefined);
  assert(serial && available.includes(serial), 'Select one disposable Android emulator');
  const boot = spawnSync(adb, ['-s', serial, 'shell', 'getprop', 'sys.boot_completed'], { encoding: 'utf8' });
  assert.equal(boot.status, 0); assert.equal(boot.stdout.trim(), '1');
  waitForDisposableDevice(adb, serial);
  const runtime = prepareLocalRuntime();
  const config = JSON.parse(readFileSync(resolve(runtime.temp, 'firebase.json')));
  const ports = ['auth', 'firestore', 'database', 'functions'].map((key) => config.emulators[key].port);
  let output, failure, endpoints;
  try {
    await assertLocalEndpointsClosed(ports);
    output = process.env.SGM_LOCAL_UI_OUTPUT || resolve(root, 'android/app/build/outputs/local-ui-evidence', runtime.env.SGM_LOCAL_RUN_ID);
    assert(isAbsolute(output) && !existsSync(output), 'Use a fresh evidence directory');
    Object.assign(runtime.env, { SGM_LOCAL_ANDROID_SERIAL: serial, SGM_LOCAL_UI_SESSION_FILE: resolve(runtime.temp, 'ui-session.json'),
      SGM_LOCAL_UI_OUTPUT: output, SGM_LOCAL_DISPOSABLE_EMULATOR: 'true' });
    if (name === 'vehicle-map') {
      assert.equal(process.env.SGM_VEHICLE_MAP_UI, 'approved-sdk-map');
      runtime.env.SGM_VEHICLE_MAP_UI = 'approved-sdk-map';
    }
    if (process.env.SGM_BLOCK_TEST_PHONE_INSTALLS === 'true') {
      assert.equal(process.env.SGM_PAUSE_TEST_PHONE_STORE, 'true');
      Object.assign(runtime.env, { SGM_BLOCK_TEST_PHONE_INSTALLS: 'true', SGM_PAUSE_TEST_PHONE_STORE: 'true' });
    }
    for (const key of ['SGM_PREINSTALLED_TEST_APKS_RECEIPT', 'SGM_FOCUSED_UI_CASE', 'SGM_TEST_PHONE_ADMIN_APPROVED'])
      if (process.env[key] !== undefined) runtime.env[key] = process.env[key];
    runEmulatorEntry(runtime, entries[name]);
  } catch (error) { failure = error; }
  finally {
    try { if (output && existsSync(output)) retainLocalEmulatorLogs(runtime.temp, output, runtime.env.SGM_QA_PASSWORD); }
    catch { console.warn('Local diagnostics unavailable; original outcome unchanged.'); }
    try {
      runtime.cleanup(); assert(!existsSync(runtime.temp), 'The owned runtime must be completely removed');
      endpoints = await assertLocalEndpointsClosed(ports);
    } catch (error) { failure = failure ? new AggregateError([failure, error], 'Trial and disposal failed') : error; }
  }
  if (failure) throw failure;
  const report = JSON.parse(readFileSync(resolve(output, `${name}-app-results.json`)));
  assert.equal(report.runId, runtime.env.SGM_LOCAL_RUN_ID); assert.equal(report.projectId, 'demo-sgm-local-qa');
  assert.equal(report.cleanupMode, 'destroy-owned-local-environment');
  writeFileSync(resolve(output, `${name}-results.json`), JSON.stringify({ ...report,
    isolatedEnvironmentDestroyed: true, emulatorCliExitedSuccessfully: true, emulatorEndpoints: endpoints,
  }, null, 2) + '\n', { flag: 'wx' });
}
