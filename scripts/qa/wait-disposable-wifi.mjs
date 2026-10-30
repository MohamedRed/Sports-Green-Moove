import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import {existsSync, mkdirSync, writeFileSync} from 'node:fs';
import {isAbsolute, resolve} from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
import {disposableAndroidShell} from './disposable-android-shell.mjs';
import {parseDisposableWifiReadiness} from './disposable-wifi-readiness.mjs';
import {collectNetworkValidationDiagnostics} from './local-network-validation-diagnostics.mjs';

export async function waitForDisposableWifi(output, env = process.env, {
  execute = execFileSync, deviceFactory = disposableAndroidShell, exists = existsSync, mkdir = mkdirSync, write = writeFileSync,
  now = () => performance.now(), sleep = delay, id = () => randomBytes(16).toString('hex'),
  collectHistory = collectNetworkValidationDiagnostics, budgetMs = 180_000, intervalMs = 3_000,
} = {}) {
  assert.equal(env.SGM_LOCAL_DISPOSABLE_EMULATOR, 'true'); assert.equal(env.SGM_FOCUSED_UI_CASE, 'chat-network-recovery');
  assert(isAbsolute(output ?? '') && !exists(output), 'Use a fresh pre-installation readiness directory');
  assert(Number.isSafeInteger(budgetMs) && budgetMs > 0 && budgetMs <= 180_000);
  assert(Number.isSafeInteger(intervalMs) && intervalMs > 0 && intervalMs <= 3_000);
  const {serial, shell} = deviceFactory(env, execute);
  assert.match(serial, /^emulator-\d+$/); assert.equal(shell('getprop', 'ro.kernel.qemu'), '1');
  assert.equal(shell('getprop', 'ro.build.version.sdk'), '35'); assert.equal(shell('am', 'get-current-user'), '0');
  for (const name of ['be.sportgreenmoove.app', 'be.sportgreenmoove.app.local', 'be.sportgreenmoove.qa.installguard'])
    assert.equal(shell('pm', 'list', 'packages', '--user', '0', name), '', 'Readiness must precede all test-app installation');
  const runId = id(); assert.match(runId, /^[a-f0-9]{32}$/);
  mkdir(output, {mode: 0o700});
  const save = (file, value) => write(resolve(output, file), JSON.stringify(value, null, 2) + '\n', {mode: 0o600, flag: 'wx'});
  const base = {runId, projectId: 'demo-sgm-local-qa', scope: 'bounded-passive-disposable-wifi-prerequisite-not-user-flow-or-repair',
    testAppsAbsent: true, settingsChanged: false, radioChanged: false, loggingChanged: false, newProbesIssued: false,
    flowCompleted: false, physicalDevice: false, rootCauseFixed: false, budgetMs, intervalMs};
  save('started.json', {...base, recordedAt: new Date().toISOString(), completed: false});
  const start = now(), deadline = start + budgetMs, samples = [];
  const adb = env.ANDROID_HOME ? `${env.ANDROID_HOME}/platform-tools/adb` : 'adb';
  const boundedExecute = (command, args, options) => {
    const remaining = Math.floor(deadline - now());
    assert(remaining > 0, 'Disposable readiness budget exhausted');
    return execute(command, args, {...options, timeout: Math.max(1, Math.min(options?.timeout ?? 5_000, remaining))});
  };
  let completed = false, failureKind = null, historyBeforeCaptured = false, historyAfterCaptured = false;
  try {
    while (now() < deadline && samples.length < Math.ceil(budgetMs / intervalMs) + 1) {
      let raw;
      try {raw = boundedExecute(adb, ['-s', serial, 'shell', 'dumpsys', 'connectivity'], {encoding: 'utf8',
        timeout: Math.max(1, Math.min(5_000, Math.floor(deadline - now()))), maxBuffer: 2 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe']});}
      catch {failureKind = 'capability-command-unavailable'; throw new Error('Disposable readiness observation failed; raw output withheld');}
      const sample = {index: samples.length, elapsedMs: Math.round(now() - start), recordedAt: new Date().toISOString(),
        ...parseDisposableWifiReadiness(raw)};
      raw = undefined; samples.push(sample);
      save('sample-' + String(sample.index).padStart(3, '0') + '.json', {...base, ...sample});
      if (samples.length === 1 && !sample.ready && now() < deadline) {
        collectHistory(adb, serial, runId, 'before', output, boundedExecute, write); historyBeforeCaptured = true;
      }
      if (sample.ready && now() <= deadline) {
        if (samples.length > 1) {
          collectHistory(adb, serial, runId, 'after', output, boundedExecute, write); historyAfterCaptured = true;
        }
        completed = now() <= deadline;
        if (completed) break;
      }
      if (now() < deadline) await sleep(Math.min(intervalMs, deadline - now()));
    }
    if (!completed) {
      failureKind = 'wifi-prerequisite-deadline';
      throw new Error('Validated default Wi-Fi prerequisite not observed within its fixed budget; no app flow was run');
    }
  } catch (error) {
    failureKind ??= 'readiness-observation-invalid';
    throw new Error(failureKind === 'wifi-prerequisite-deadline' ? error.message : 'Disposable readiness observation failed; raw output withheld');
  } finally {
    save('outcome.json', {...base, recordedAt: new Date().toISOString(), elapsedMs: Math.round(now() - start),
      completed, ready: completed, failureKind, sampleCount: samples.length, initialReady: samples[0]?.ready ?? null,
      historyBeforeCaptured, historyAfterCaptured});
  }
  return {runId, completed, sampleCount: samples.length, initialReady: samples[0].ready};
}

if (process.argv[1] === import.meta.filename) {
  assert.equal(process.argv.length, 3);
  await waitForDisposableWifi(process.argv[2]);
  console.log('Default Wi-Fi prerequisite observed before app installation; no flow or repair is accepted.');
}
