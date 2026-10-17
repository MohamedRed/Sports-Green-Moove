import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { collectDefaultSelectionDiagnostics, parseDefaultSelectionDiagnostics } from '../scripts/qa/local-default-selection-diagnostics.mjs';

const runId = 'a'.repeat(32);
const line = (message) => `D/MultiSimSettingController( 1234): ${message}`;
const readiness = (initialized, configured, satellite) => line(`isReadyToReevaluate: subInfoInitialized=${initialized}, carrierConfigsLoaded=${configured}, satelliteEnabledOrBeingEnabled=${satellite}`);
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('each default selection gate remains separate from a loaded SIM or registered modem', () => {
  const history = ['--------- beginning of main', line('onAllSubscriptionsLoaded: mSubInfoInitialized=false'),
    readiness(true, false, false), line('Carrier config subId 123456789 is not loaded.'),
    line('onCarrierConfigChanged phoneId 0 subId 123456789'), readiness(true, true, false),
    line('updateDefaultValues: change: 6'), line('updateDefaultValues: to only primary sub 123456789'),
    line('onDefaultDataSettingChanged')].join('\n');
  const parsed = parseDefaultSelectionDiagnostics(history);
  assert.equal(parsed.source, 'bounded-controller-log-history-not-current-os-state');
  assert.equal(parsed.recognizedEventCount, 8); assert.equal(parsed.unrecognizedMessageCount, 0);
  assert.equal(parsed.lastReadiness.carrierConfigurationsLoaded, true);
  assert.equal(parsed.lastReadiness.subscriptionsInitialized, true);
  assert.equal(parsed.lastReadiness.satelliteEnabledOrEnabling, false);
  assert(parsed.events.some((event) => event.type === 'carrier-configuration-missing'));
  assert(parsed.events.some((event) => event.type === 'single-primary-selected'));
  assert(!JSON.stringify(parsed).includes('123456789')); assert(!JSON.stringify(parsed).includes('1234'));
  for (const [initialized, configured, satellite] of [[false, true, false], [true, false, false], [true, true, true]]) {
    const observation = parseDefaultSelectionDiagnostics(readiness(initialized, configured, satellite)).lastReadiness;
    assert.equal(observation.subscriptionsInitialized, initialized);
    assert.equal(observation.carrierConfigurationsLoaded, configured);
    assert.equal(observation.satelliteEnabledOrEnabling, satellite);
  }
});

test('missing, malformed and unrelated history cannot become readiness or leak its contents', () => {
  for (const output of ['', '--------- beginning of radio', line('PRIVATE unknown message'),
    line('isReadyToReevaluate: subInfoInitialized=PRIVATE, carrierConfigsLoaded=true, satelliteEnabledOrBeingEnabled=false')]) {
    const parsed = parseDefaultSelectionDiagnostics(output);
    assert.equal(parsed.lastReadiness, null); assert.equal(parsed.recognizedEventCount, 0);
    assert(!JSON.stringify(parsed).includes('PRIVATE'));
  }
  for (const output of ['Permission Denial: PRIVATE', 'D/OtherTag(1): PRIVATE', 'PRIVATE', 'x'.repeat(2 * 1024 * 1024 + 1)])
    assert.throws(() => parseDefaultSelectionDiagnostics(output), (error) => !error.message.includes('PRIVATE'));
  const many = parseDefaultSelectionDiagnostics(Array.from({ length: 140 }, () => readiness(true, false, false)).join('\n'));
  assert.equal(many.events.length, 128); assert.equal(many.recognizedEventCount, 140); assert.equal(many.eventsTruncated, true);
  assert.equal(many.lastReadiness.carrierConfigurationsLoaded, false);
  const radio = parseDefaultSelectionDiagnostics(line('Radio unavailable on phone 0, clearing sub info initialized flag'));
  assert.deepEqual(radio.events, [{ type: 'radio-unavailable' }]);
});

test('collection is guarded, bounded and read-only, and child errors never expose raw logs', () => {
  const inherited = process.env.SGM_LOCAL_DISPOSABLE_EMULATOR;
  const calls = [], writes = [];
  const execute = (_adb, args, options) => {
    calls.push(args); assert.equal(options.timeout, 30_000);
    if (args.includes('wait-for-device')) return '';
    if (args.includes('get-state')) return 'device';
    if (args.includes('getprop')) return '1';
    assert.deepEqual(args, ['-s', 'emulator-5554', 'logcat', '-b', 'main', '-b', 'radio', '-b', 'system',
      '-d', '-v', 'brief', '-t', '2048', 'MultiSimSettingController:D', '*:S']);
    assert.equal(options.maxBuffer, 2 * 1024 * 1024); assert.deepEqual(options.stdio, ['ignore', 'pipe', 'pipe']);
    return readiness(true, false, false);
  };
  const collect = (serial = 'emulator-5554', phase = 'before', id = runId, directory = '/tmp/evidence') =>
    collectDefaultSelectionDiagnostics('/sdk/adb', serial, id, phase, directory, execute, (...args) => writes.push(args));
  try {
    delete process.env.SGM_LOCAL_DISPOSABLE_EMULATOR;
    assert.throws(() => collect()); assert.equal(calls.length, 0);
    process.env.SGM_LOCAL_DISPOSABLE_EMULATOR = 'true';
    for (const args of [['physical'], ['emulator-5554', 'other'], ['emulator-5554', 'before', 'bad'],
      ['emulator-5554', 'before', runId, 'relative']]) assert.throws(() => collect(...args));
    assert.equal(calls.length, 0);
    const result = collect(); assert.equal(result.runId, runId);
    assert.equal(result.scope, 'read-only-disposable-default-selection-history');
    assert.equal(writes[0][0], '/tmp/evidence/chat-default-selection-before.json');
    assert.throws(() => collectDefaultSelectionDiagnostics('/sdk/adb', 'emulator-5554', runId, 'after', '/tmp/evidence',
      (_adb, args, options) => {
        if (!args.includes('logcat')) return execute(_adb, args, options);
        throw Object.assign(new Error('PRIVATE_ERROR'), { stdout: 'PRIVATE_IDENTIFIER' });
      }, () => assert.fail('must not write after failure')), (error) => {
      assert(!error.message.includes('PRIVATE')); assert(!JSON.stringify(error).includes('PRIVATE'));
      assert.equal(error.cause, undefined); return true;
    });
  } finally {
    if (inherited === undefined) delete process.env.SGM_LOCAL_DISPOSABLE_EMULATOR;
    else process.env.SGM_LOCAL_DISPOSABLE_EMULATOR = inherited;
  }
});

test('fresh native runs collect both histories while retaining the preparation deadline and strict observations', () => {
  const host = read('scripts/qa/local-network-replay.mjs');
  assert(host.indexOf("collectSelection('before')") < host.indexOf("instrument(['LocalChatNetworkFlowTest']"));
  assert(host.includes("() => collectSelection('after')"));
  const native = read('android/app/src/androidTest/java/be/sportgreenmoove/app/ui/LocalChatNetworkFlowTest.kt');
  assert.match(native, /compose.waitUntil\(30_000\) \{\s*preparedEvidence = control.preparedSnapshot\(\)/);
  for (const path of ['package.json', '.github/workflows/native-ci.yml', '.github/workflows/web-integration-smoke.yml'])
    assert(read(path).includes('tests/local-default-selection-diagnostics.test.mjs'));
  const source = read('scripts/qa/local-default-selection-diagnostics.mjs');
  assert(!/setprop|settings put|svc data|svc wifi|setDefault|force-stop|restart|logcat.*-c/.test(source));
});
