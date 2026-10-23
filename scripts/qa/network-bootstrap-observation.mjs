import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';
import { disposableAndroidShell } from './disposable-android-shell.mjs';
import { collectDisposableModem } from './local-modem-diagnostics.mjs';
import { collectDisposableSubscriptions } from './local-subscription-diagnostics.mjs';
import { collectDefaultSelectionDiagnostics } from './local-default-selection-diagnostics.mjs';
import { collectCarrierDiagnostics } from './local-carrier-diagnostics.mjs';

export const defaultSelectionLogProperties = ['log.tag.MultiSimSettingController',
  'persist.log.tag.MultiSimSettingController', 'log.tag', 'persist.log.tag'];

export function parseLogEmissionProperty(value) {
  assert.equal(typeof value, 'string');
  assert(value.length <= 16, 'Unexpected log emission property; raw value withheld');
  const result = value.trim();
  assert(['', 'V', 'D', 'I', 'W', 'E', 'F', 'S', 'VERBOSE', 'DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL', 'SUPPRESS']
    .includes(result.toUpperCase()), 'Unexpected log emission property; raw value withheld');
  return result ? result.toUpperCase() : null;
}

export function observeNetworkBootstrap(output, env = process.env, execute = execFileSync, {
  deviceFactory = disposableAndroidShell, mkdir = mkdirSync, write = writeFileSync,
  collectors = [collectDisposableModem, collectDisposableSubscriptions, collectDefaultSelectionDiagnostics, collectCarrierDiagnostics],
  id = () => randomBytes(16).toString('hex'),
} = {}) {
  assert.equal(env.SGM_LOCAL_DISPOSABLE_EMULATOR, 'true');
  assert.equal(env.SGM_FOCUSED_UI_CASE, 'full-matrix');
  assert(isAbsolute(output ?? ''), 'Bootstrap observation requires an absolute evidence directory');
  const { serial, shell } = deviceFactory(env, execute);
  assert.match(serial, /^emulator-\d+$/);
  assert.equal(shell('getprop', 'ro.kernel.qemu'), '1');
  assert.equal(shell('getprop', 'ro.build.version.sdk'), '35');
  assert.equal(shell('am', 'get-current-user'), '0');
  for (const name of ['be.sportgreenmoove.app', 'be.sportgreenmoove.app.local', 'be.sportgreenmoove.qa.installguard'])
    assert.equal(shell('pm', 'list', 'packages', '--user', '0', name), '', 'Bootstrap observation must precede test-app installation');
  const runId = id(); assert.match(runId, /^[a-f0-9]{32}$/);
  mkdir(output, { mode: 0o700 });
  const save = (file, data) => write(resolve(output, file), JSON.stringify(data, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
  const base = { projectId: 'demo-sgm-local-qa', runId, recordedAt: new Date().toISOString(),
    scope: 'read-only-disposable-network-bootstrap-before-test-apps-not-flow-or-root-cause-proof',
    testAppsAbsent: true, radioOrLoggingSettingsChanged: false, flowCompleted: false };
  save('started.json', { ...base, completed: false });
  const properties = Object.fromEntries(defaultSelectionLogProperties.map(name => [name, parseLogEmissionProperty(shell('getprop', name))]));
  save('log-emission-properties.json', { ...base, properties,
    limitation: 'Properties are not proof that debug events were emitted or retained, nor a measurement of the application minimum priority.' });
  const adb = env.ANDROID_HOME ? `${env.ANDROID_HOME}/platform-tools/adb` : 'adb';
  const receipts = collectors.map(collect => collect(adb, serial, runId, 'before', output, execute, write));
  assert.equal(receipts.length, 4); assert(receipts.every(receipt => receipt.runId === runId));
  const result = { ...base, completed: true, diagnosticScopes: receipts.map(receipt => receipt.scope) };
  save('complete.json', result); return result;
}
