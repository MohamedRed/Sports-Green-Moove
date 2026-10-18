import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { collectAdbHostHealth, summarizeAdbHost } from '../scripts/qa/adb-host-health.mjs';

test('host observations retain only version numbers, emulator-state counts and bounded signal counts', () => {
  const result = summarizeAdbHost('Android Debug Bridge version 1.0.41\nVersion 37.0.1-12345\nInstalled as /private/secret/adb',
    'List of devices attached\nemulator-5554 offline transport_id:2\nemulator-5556 device product:private\nreal-phone-secret device\n',
    'private-token kill-server\ntransport device offline\nconnection terminated: write failed\nprivate-key-data');
  assert.equal(result.bridgeVersion, '1.0.41'); assert.equal(result.platformToolsVersion, '37.0.1-12345');
  assert.deepEqual(result.emulatorStates, { device: 1, offline: 1, unauthorized: 0, other: 0 });
  assert.deepEqual(result.daemonLog.signals, { killServer: 1, serverRestart: 0, transportOffline: 1, writeFailure: 1 });
  assert.doesNotMatch(JSON.stringify(result), /secret|private|5554|real-phone/);
});
test('missing logs and failed inventory remain explicitly unobserved without a retry or device command', () => {
  const calls = [];
  const result = collectAdbHostHealth('component-transfer', (args) => {
    calls.push(args); return { status: null, signal: 'SIGTERM', error: { code: 'ETIMEDOUT' }, stdout: 'private', stderr: 'secret' };
  }, null);
  assert.deepEqual(calls, [['version'], ['devices', '-l']]);
  assert(result.observations.every((row) => !row.completed && row.errorCode === 'ETIMEDOUT'));
  assert.equal(result.daemonLog.available, false); assert.equal(result.daemonLog.signals.killServer, null);
  assert.equal(result.emulatorStates, null);
  assert.equal(result.bridgeVersion, null); assert.equal(result.retryPerformed, false); assert.equal(result.deviceMutationRequested, false);
  assert.doesNotMatch(JSON.stringify(result), /secret|private/);
  assert.throws(() => collectAdbHostHealth('unknown', () => assert.fail(), null));
});
test('CI gates cover the observation collector and neither accept a missing log nor publish its raw contents', () => {
  const read = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
  const source = read('scripts/qa/adb-host-health.mjs');
  for (const required of ['constants.O_NOFOLLOW', 'stat.uid !== process.getuid()', 'Math.min(stat.size, 65536)',
    "flag: 'wx'", 'timeout: 3000', 'rawLogsRetained: false']) assert(source.includes(required));
  for (const workflow of ['native-ci.yml', 'web-integration-smoke.yml'])
    assert.equal(read('.github/workflows/' + workflow).split('"tests/adb-host-health.test.mjs"').length - 1, 2);
});
