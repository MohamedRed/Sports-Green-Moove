import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { collectDisposableModem, parseModemStatus } from '../scripts/qa/local-modem-diagnostics.mjs';
import { collectDisposableSubscriptions, parseSubscriptionDiagnostics } from '../scripts/qa/local-subscription-diagnostics.mjs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const runId = 'a'.repeat(32);

function subscriptionDump({ mapped = true, loaded = true } = {}) {
  return `SubscriptionManagerService:
    Active modem count=1
    Logical SIM slot sub id mapping:
    ${mapped ? 'Logical SIM slot 0: subId=1' : ''}
    ICCID:
      slot 0: PRIVATE_SIM_IDENTIFIER
    defaultSubId=${mapped ? 1 : -1}
    defaultVoiceSubId=${mapped ? 1 : -1}
    defaultDataSubId=${mapped ? 1 : -1}
    activeDataSubId=${mapped ? 1 : -1}
    defaultSmsSubId=${mapped ? 1 : -1}
    areAllSubscriptionsLoaded=${loaded}
    mSimState[0]=${loaded ? 'LOADED' : 'READY'}
    All subscriptions:
      number=PRIVATE_PHONE_NUMBER iccId=PRIVATE_SIM_IDENTIFIER
    Local log:
      10-17 00:00:00 updateSimState: slot 0 READY
      10-17 00:00:00 updateSubscription: No ICCID available for phone 0
      10-17 00:00:00 updateSubscription: current mapping []
      unrecognized PRIVATE_LOG_MESSAGE
    SubscriptionDatabaseManager:
      All subscriptions: PRIVATE_DATABASE_ROW
  `;
}

test('subscription summary distinguishes service provisioning from app observations without retaining identifiers', () => {
  const parsed = parseSubscriptionDiagnostics(subscriptionDump());
  assert.equal(parsed.modemCount, 1); assert.equal(parsed.mappedSlotCount, 1);
  assert.equal(parsed.allSubscriptionsLoaded, true); assert.deepEqual(parsed.simStates, ['LOADED']);
  assert.equal(parsed.defaultSubscriptionValid.defaultDataSubId, true);
  assert.deepEqual(parsed.events, ['sim-READY', 'missing-icc-id', 'mapping-empty']);
  assert(!JSON.stringify(parsed).includes('PRIVATE'));
  const notProvisioned = parseSubscriptionDiagnostics(subscriptionDump({ mapped: false, loaded: false }));
  assert.equal(notProvisioned.mappedSlotCount, 0);
  assert.equal(notProvisioned.defaultSubscriptionValid.defaultDataSubId, false);
  assert.equal(notProvisioned.allSubscriptionsLoaded, false);
  assert.deepEqual(notProvisioned.simStates, ['READY']);
});

test('unsupported, missing, duplicated or malformed subscription fields cannot become healthy defaults', () => {
  const original = subscriptionDump();
  for (const dump of ['', 'Permission Denial: PRIVATE_ERROR',
    original.replace('SubscriptionManagerService:', 'UnknownService:'),
    original.replace('Active modem count=1', 'Active modem count=99'),
    original.replace('defaultDataSubId=1', 'defaultDataSubId=PRIVATE_ID'),
    original.replace('defaultDataSubId=1', 'defaultDataSubId=9999999999'),
    original + '\ndefaultDataSubId=1', original.replace('mSimState[0]=LOADED', ''),
    original.replace('mSimState[0]=LOADED', 'mSimState[0]=PRIVATE_STATE'),
    original.replace('Logical SIM slot 0: subId=1', 'Logical SIM slot 1: subId=1'),
    original.replace('Logical SIM slot 0: subId=1', 'Logical SIM slot 0: subId=PRIVATE_ID'),
    original + '\nLogical SIM slot 0: subId=1']) {
    assert.throws(() => parseSubscriptionDiagnostics(dump), (error) => !error.message.includes('PRIVATE'));
  }
  const many = original + '\nupdateSimState: slot 0 READY'.repeat(140);
  const bounded = parseSubscriptionDiagnostics(many);
  assert.equal(bounded.events.length, 128); assert.equal(bounded.eventsTruncated, true);
  assert.equal(bounded.recognizedEventCount, 143);
});

test('subscription collection is bounded, read-only and guarded before any device command', () => {
  const inherited = process.env.SGM_LOCAL_DISPOSABLE_EMULATOR;
  const calls = [], writes = [];
  const execute = (_adb, args, options) => {
    calls.push(args); assert.equal(options.timeout, 30_000);
    if (args.includes('wait-for-device')) return '';
    if (args.includes('get-state')) return 'device';
    if (args.includes('getprop')) return '1';
    assert.deepEqual(args, ['-s', 'emulator-5554', 'shell', 'dumpsys', 'isub']);
    assert.equal(options.maxBuffer, 2 * 1024 * 1024);
    assert.deepEqual(options.stdio, ['ignore', 'pipe', 'pipe']);
    return subscriptionDump();
  };
  const collect = (serial = 'emulator-5554', phase = 'before', id = runId) =>
    collectDisposableSubscriptions('/sdk/adb', serial, id, phase, '/tmp/evidence', execute, (...args) => writes.push(args));
  try {
    delete process.env.SGM_LOCAL_DISPOSABLE_EMULATOR;
    assert.throws(() => collect()); assert.equal(calls.length, 0);
    process.env.SGM_LOCAL_DISPOSABLE_EMULATOR = 'true';
    assert.throws(() => collect('physical')); assert.throws(() => collect('emulator-5554', 'unknown'));
    assert.throws(() => collect('emulator-5554', 'before', 'bad')); assert.equal(calls.length, 0);
    const result = collect(); assert.equal(result.runId, runId);
    assert.equal(result.scope, 'read-only-disposable-subscription-summary');
    assert.equal(writes[0][0], '/tmp/evidence/chat-subscriptions-before.json');
    assert(!writes[0][1].includes('PRIVATE'));
    assert.throws(() => collectDisposableSubscriptions('/sdk/adb', 'emulator-5554', runId, 'after', '/tmp/evidence',
      () => { throw new Error('transport deadline'); }, () => assert.fail('must not write after failure')));
    assert.throws(() => collectDisposableSubscriptions('/sdk/adb', 'emulator-5554', runId, 'after', '/tmp/evidence',
      (_adb, args, options) => {
        if (!args.includes('dumpsys')) return execute(_adb, args, options);
        throw Object.assign(new Error('PRIVATE_ERROR'), { stdout: 'PRIVATE_SIM_IDENTIFIER' });
      }, () => assert.fail('must not write raw failure')), (error) => {
      assert(!JSON.stringify(error).includes('PRIVATE')); assert(!error.message.includes('PRIVATE'));
      assert.equal(error.cause, undefined); return true;
    });
    const host = read('scripts/qa/local-network-replay.mjs');
    assert(host.indexOf("collectSubscriptions('before')") < host.indexOf("instrument(['LocalChatNetworkFlowTest']"));
    assert.match(host, /\(\) => collectModem\('after'\), \(\) => collectSubscriptions\('after'\)/);
  } finally {
    if (inherited === undefined) delete process.env.SGM_LOCAL_DISPOSABLE_EMULATOR;
    else process.env.SGM_LOCAL_DISPOSABLE_EMULATOR = inherited;
  }
});
test('modem diagnostics retain only voice/data registration states, never arbitrary console data', () => {
  assert.deepEqual(parseModemStatus('gsm voice state: home\r\ngsm data state:  home\r\nOK\r\n'),
    { voice: 'home', data: 'home' });
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

test('the emulator delimiter regression has retained red/green evidence without promoting a network pass', () => {
  const base = 'docs/release/evidence/local-app-scheduling-2026-10-16/diagnostic-reader-interrupted/';
  assert.match(read(base + 'sgm-modem-parser-before-20261016.xml'), /<failure[\s>]/);
  assert(!read(base + 'sgm-modem-parser-after-20261016.xml').includes('<failure'));
  assert.match(read(base + 'sgm-modem-reader-failed-20261016.txt'), /Unexpected modem status/);
});
