import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { collectDisposableModem, parseModemStatus } from '../scripts/qa/local-modem-diagnostics.mjs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const runId = 'a'.repeat(32);
test('modem diagnostics retain only voice/data registration states, never arbitrary console data', () => {
  assert.deepEqual(parseModemStatus('gsm voice state: home\r\ngsm data state: unregistered\r\nOK\r\n'),
    { voice: 'home', data: 'unregistered' });
  for (const value of ['', 'OK', 'gsm data state: home',
    'gsm voice state: home\ngsm data state: unknown',
    'gsm voice state: home\ngsm data state: home\ngsm data state: home',
    'gsm voice state: home\ngsm data state: home\nsubscriber: private']) {
    assert.throws(() => parseModemStatus(value));
  }
});

test('read-only modem collection is run-bound, bounded, emulator-only and fail-closed', () => {
  const inherited = process.env.SGM_LOCAL_DISPOSABLE_EMULATOR;
  const calls = [], writes = [];
  const execute = (adb, args, options) => {
    assert.equal(adb, '/sdk/adb'); assert.equal(options.timeout, 30_000); calls.push(args);
    if (args.includes('get-state')) return 'device';
    if (args.includes('getprop')) return '1';
    return args.includes('status') ? 'gsm voice state: home\ngsm data state: home\nOK' : '';
  };
  const collect = (serial = 'emulator-5554', phase = 'before', id = runId) =>
    collectDisposableModem('/sdk/adb', serial, id, phase, '/tmp/evidence', execute, (...args) => writes.push(args));
  try {
    delete process.env.SGM_LOCAL_DISPOSABLE_EMULATOR;
    assert.throws(() => collect()); assert.equal(calls.length, 0);
    process.env.SGM_LOCAL_DISPOSABLE_EMULATOR = 'true';
    assert.throws(() => collect('physical')); assert.throws(() => collect('emulator-5554', 'other'));
    assert.throws(() => collect('emulator-5554', 'before', 'invalid')); assert.equal(calls.length, 0);
    assert.equal(collect().runId, runId);
    assert.deepEqual(calls.at(-1), ['-s', 'emulator-5554', 'emu', 'gsm', 'status']);
    assert.equal(writes[0][0], '/tmp/evidence/chat-modem-before.json');
    assert.equal(JSON.parse(writes[0][1]).scope, 'read-only-disposable-modem-registration');
    const timeout = new Error('modem deadline');
    assert.throws(() => collectDisposableModem('/sdk/adb', 'emulator-5554', runId, 'after', '/tmp/evidence',
      () => { throw timeout; }, () => assert.fail('must not write after failure')), (error) => error === timeout);
  } finally {
    if (inherited === undefined) delete process.env.SGM_LOCAL_DISPOSABLE_EMULATOR;
    else process.env.SGM_LOCAL_DISPOSABLE_EMULATOR = inherited;
  }
});

test('device snapshots retain terminal preparation diagnostics without new permissions or phone identifiers', () => {
  const control = read('android/app/src/androidTest/java/be/sportgreenmoove/app/ui/LocalEmulatorNetwork.kt');
  for (const value of ['telephony.dataState', 'telephony.simState', 'getDefaultDataSubscriptionId()',
    'availableCallbacks.get()', 'lostCallbacks.get()', 'unavailableCallbacks.get()']) assert(control.includes(value));
  assert(!/getSubscriberId|getImei|simSerialNumber|line1Number|adoptShellPermissionIdentity|putInt/.test(control));
  const replay = read('android/app/src/androidTest/java/be/sportgreenmoove/app/ui/LocalChatNetworkFlowTest.kt');
  assert.match(replay, /control.snapshot\("preparation-failed"\)/);
  assert.match(replay, /failure.addSuppressed\(diagnosticFailure\)/);
  const host = read('scripts/qa/local-network-replay.mjs');
  assert(host.indexOf("collectModem('before')") < host.indexOf("instrument(['LocalChatNetworkFlowTest']"));
  assert.match(host, /finishDisposableCleanup\(failure, \[\(\) => collectModem\('after'\)/);
  for (const workflow of ['native-ci', 'web-integration-smoke']) {
    assert.equal(read(`.github/workflows/${workflow}.yml`).split('"tests/local-modem-diagnostics.test.mjs"').length - 1, 2);
  }
  assert(read('package.json').includes('tests/local-modem-diagnostics.test.mjs'));
});
