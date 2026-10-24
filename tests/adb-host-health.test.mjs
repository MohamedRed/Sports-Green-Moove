import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { collectAdbHostHealth, summarizeAdbHost, summarizeAdbProcesses, observeAdbHostProcesses } from '../scripts/qa/adb-host-health.mjs';

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

test('process observations select only adb executable identity and start time, not command arguments or other processes', () => {
  const output = ' 500 Thu Oct 22 12:24:02 2026 /sdk/platform-tools/adb\n' +
    ' 12 Thu Oct 22 12:23:01 2026 /private/secret/node\n' +
    ' 9 Thu Oct 22 12:22:01 2026 adb\n';
  assert.deepEqual(summarizeAdbProcesses(output), [
    { pid: 9, startedAtLocal: 'Thu Oct 22 12:22:01 2026' },
    { pid: 500, startedAtLocal: 'Thu Oct 22 12:24:02 2026' },
  ]);
  let called = 0;
  const result = observeAdbHostProcesses((command, args, options) => {
    called++; assert.equal(command, '/bin/ps'); assert.deepEqual(args, ['-axo', 'pid=,lstart=,comm=']);
    assert.equal(options.timeout, 2000); assert.equal(options.env.LC_ALL, 'C'); assert(!options.env.SGM_QA_PASSWORD);
    return { status: 0, stdout: output, stderr: 'never retain this secret' };
  });
  assert.equal(called, 1); assert.equal(result.completed, true); assert.equal(result.adbProcesses.length, 2);
  assert.equal(result.rawLogsRetained, false); assert.equal(result.deviceCommandRequested, false);
  assert.doesNotMatch(JSON.stringify(result), /private|secret|platform-tools/);
  assert.throws(() => summarizeAdbProcesses('invalid metadata adb'));
  assert.throws(() => summarizeAdbProcesses('unrecognized unrelated process'));
  assert.throws(() => summarizeAdbProcesses(''));
});

test('an unavailable or malformed process observation stays unobserved without command retries', () => {
  for (const run of [() => ({ status: 1, stdout: 'secret', stderr: 'secret' }),
    () => ({ status: 0, stdout: 'bad metadata adb' }), () => { throw new Error('secret'); }]) {
    const result = observeAdbHostProcesses(run);
    assert.equal(result.completed, false); assert.equal(result.adbProcesses, null);
    assert.doesNotMatch(JSON.stringify(result), /secret/);
  }
});
