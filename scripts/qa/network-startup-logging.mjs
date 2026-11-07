import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {existsSync, mkdirSync, writeFileSync} from 'node:fs';
import {dirname, isAbsolute, resolve} from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
import {disposableAndroidShell} from './disposable-android-shell.mjs';
import {parseLogEmissionProperty} from './network-bootstrap-observation.mjs';
import {collectDisposableModem} from './local-modem-diagnostics.mjs';
import {collectDisposableSubscriptions} from './local-subscription-diagnostics.mjs';
import {collectDefaultSelectionDiagnostics} from './local-default-selection-diagnostics.mjs';
import {collectCarrierDiagnostics} from './local-carrier-diagnostics.mjs';

export const startupLogProperty = 'persist.log.tag.MultiSimSettingController';
export function loggingPropertyArgument(value) {
  parseLogEmissionProperty(value);
  // adb shell joins remote arguments; an empty argv element otherwise disappears.
  return value === '' ? '""' : value;
}
const packages = ['be.sportgreenmoove.app', 'be.sportgreenmoove.app.local', 'be.sportgreenmoove.qa.installguard'];
const scope = 'approved-temporary-network-startup-logging-not-flow-or-repair';

export async function observeNetworkStartupLogging(output, env = process.env, {
  deviceFactory = disposableAndroidShell, execute, mkdir = mkdirSync, write = writeFileSync,
  sleep = (ms, signal) => delay(ms, undefined, {signal}), now = () => Date.now(),
  id = () => randomBytes(16).toString('hex'), signal,
  collectors = [collectDisposableModem, collectDisposableSubscriptions, collectDefaultSelectionDiagnostics, collectCarrierDiagnostics],
} = {}) {
  assert.equal(env.SGM_LOCAL_DISPOSABLE_EMULATOR, 'true');
  assert.equal(env.SGM_NETWORK_STARTUP_LOGGING_APPROVED, 'true');
  assert.equal(env.SGM_NETWORK_DIAGNOSTIC_DEVICE_OWNED, 'true');
  assert.equal(env.GITHUB_ACTIONS, 'true');
  assert.equal(env.RUNNER_OS, 'Linux');
  assert.equal(env.RUNNER_ENVIRONMENT, 'github-hosted');
  assert(isAbsolute(output ?? ''));
  const {serial, shell, command} = deviceFactory(env, execute);
  assert.match(serial, /^emulator-\d+$/);
  assert.equal(shell('getprop', 'ro.kernel.qemu'), '1');
  assert.equal(shell('getprop', 'ro.build.version.sdk'), '35');
  assert.equal(shell('getprop', 'ro.product.cpu.abi'), 'x86_64');
  assert.equal(shell('am', 'get-current-user'), '0');
  const assertAbsent = () => {
    for (const name of packages) assert.equal(shell('pm', 'list', 'packages', '--user', '0', name), '');
  };
  assertAbsent();
  const original = shell('getprop', startupLogProperty);
  parseLogEmissionProperty(original);
  const initialBoot = shell('cat', '/proc/sys/kernel/random/boot_id');
  const validBoot = value => typeof value === 'string' && /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/.test(value);
  assert(validBoot(initialBoot), 'Unexpected boot identity; raw value withheld');
  const runId = id(); assert.match(runId, /^[a-f0-9]{32}$/);
  assert(!existsSync(output), 'Keep original diagnostic results unchanged');
  mkdir(dirname(output), {recursive: true, mode: 0o700});
  mkdir(output, {mode: 0o700});
  const save = (file, data) => write(resolve(output, file), JSON.stringify(data, null, 2) + '\n', {mode: 0o600, flag: 'wx'});
  const receipt = {scope, projectId: 'demo-sgm-local-qa', runId, property: startupLogProperty,
    originalValue: original, enabledValue: 'D', testAppsAbsent: true, rebootRequests: 0, bootTransitionObserved: false,
    loggingSettingsChanged: false, radioSettingsChanged: false, rawLogsRetained: false,
    flowExecuted: false, rootCauseConfirmed: false, releaseAccepted: false, restored: false, completed: false};
  save('started.json', receipt);
  let attempted = false, failed = false, phase = 'enable-logging';
  try {
    signal?.throwIfAborted();
    attempted = true;
    shell('setprop', startupLogProperty, loggingPropertyArgument('D'));
    assert.equal(shell('getprop', startupLogProperty), 'D');
    receipt.loggingSettingsChanged = original !== 'D';
    // One cold restart is necessary to observe selection decisions made during boot.
    phase = 'restart'; receipt.rebootRequests = 1; command('reboot');
    const deadline = now() + 120_000;
    while (!receipt.bootTransitionObserved) {
      signal?.throwIfAborted(); assert(now() < deadline, 'Diagnostic boot did not complete within its bound');
      let nextBoot, completed;
      try {
        command('wait-for-device');
        nextBoot = shell('cat', '/proc/sys/kernel/random/boot_id');
        completed = shell('getprop', 'sys.boot_completed');
      } catch { await sleep(1000, signal); continue; }
      assert(validBoot(nextBoot), 'Unexpected boot identity; raw value withheld');
      receipt.bootTransitionObserved = nextBoot !== initialBoot && completed === '1';
      if (!receipt.bootTransitionObserved) await sleep(1000, signal);
    }
    assert.equal(shell('getprop', 'ro.kernel.qemu'), '1');
    assert.equal(shell('getprop', startupLogProperty), 'D');
    assertAbsent();
    const adb = env.ANDROID_HOME ? `${env.ANDROID_HOME}/platform-tools/adb` : 'adb';
    const started = now();
    for (const [index, offset] of [0, 15_000, 45_000].entries()) {
      phase = 'collect-sample-' + index;
      signal?.throwIfAborted();
      const remaining = started + offset - now(); if (remaining > 0) await sleep(remaining, signal);
      assertAbsent();
      assert.equal(shell('getprop', startupLogProperty), 'D');
      const sample = resolve(output, `sample-${index}`); mkdir(sample, {mode: 0o700});
      const observations = collectors.map(collect => collect(adb, serial, runId, 'before', sample, execute, write));
      assert.equal(observations.length, 4); assert(observations.every(row => row.runId === runId));
      assert.equal(shell('getprop', startupLogProperty), 'D');
      save(`sample-${index}.json`, {scope, runId, elapsedMs: now() - started, testAppsAbsent: true,
        propertiesVerified: true, diagnosticScopes: observations.map(row => row.scope)});
    }
    receipt.completed = true;
  } catch {
    failed = true; receipt.failureStage = signal?.aborted ? 'cancelled' : phase;
  } finally {
    if (attempted) {
      try {
        command('wait-for-device');
        if (shell('getprop', startupLogProperty) !== original) shell('setprop', startupLogProperty, loggingPropertyArgument(original));
        assert.equal(shell('getprop', startupLogProperty), original);
        assertAbsent(); receipt.restored = true;
      } catch { failed = true; receipt.restorationFailure = true; }
    }
    receipt.failed = failed;
    if (failed) receipt.completed = false;
    save('restoration.json', {...receipt, finishedAt: new Date().toISOString()});
  }
  return receipt;
}
