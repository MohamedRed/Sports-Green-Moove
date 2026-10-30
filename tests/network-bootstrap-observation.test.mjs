import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { observeNetworkBootstrap, defaultSelectionLogProperties, parseLogEmissionProperty } from '../scripts/qa/network-bootstrap-observation.mjs';
import {parseDisposableWifiReadiness} from '../scripts/qa/disposable-wifi-readiness.mjs';
import {waitForDisposableWifi} from '../scripts/qa/wait-disposable-wifi.mjs';

const env = { SGM_LOCAL_DISPOSABLE_EMULATOR: 'true', SGM_FOCUSED_UI_CASE: 'full-matrix', ANDROID_HOME: '/sdk' };
function trial(patch = {}) {
  const commands = [], writes = [], calls = [], directories = [];
  const options = {
    id: () => 'a'.repeat(32), mkdir: (...args) => directories.push(args), write: (...args) => writes.push(args),
    deviceFactory: () => ({ serial: 'emulator-5554', shell: (...args) => {
      commands.push(args); const key = args.join(' ');
      if (key === 'getprop ro.kernel.qemu') return '1';
      if (key === 'getprop ro.build.version.sdk') return '35';
      if (key === 'am get-current-user') return '0';
      if (args[0] === 'pm') return '';
      if (args[0] === 'getprop') return '';
      assert.fail('No unrecognized or mutating command is allowed');
    } }),
    collectors: Array.from({ length: 4 }, (_, index) => (...args) => {
      calls.push(args); return { runId: args[2], scope: 'diagnostic-' + index };
    }), ...patch,
  };
  return { commands, writes, calls, directories, run: (environment = env, output = '/tmp/evidence/bootstrap') =>
    observeNetworkBootstrap(output, environment, () => assert.fail('No implicit command'), options) };
}
test('pre-installation observation is independently identified and never claims a flow or repair', () => {
  const t = trial(), result = t.run();
  assert.equal(result.completed, true); assert.equal(result.flowCompleted, false);
  assert.equal(result.radioOrLoggingSettingsChanged, false); assert.equal(result.testAppsAbsent, true);
  assert.deepEqual(t.directories, [['/tmp/evidence/bootstrap', { mode: 0o700 }]]);
  assert.equal(t.calls.length, 4);
  for (const args of t.calls) assert.deepEqual(args.slice(0, 5), ['/sdk/platform-tools/adb', 'emulator-5554', 'a'.repeat(32), 'before', '/tmp/evidence/bootstrap']);
  assert.deepEqual(t.writes.map(([file]) => file.split('/').at(-1)), ['started.json', 'log-emission-properties.json', 'complete.json']);
  for (const args of t.writes) assert.deepEqual(args[2], { mode: 0o600, flag: 'wx' });
  const properties = JSON.parse(t.writes[1][1]).properties;
  assert.deepEqual(Object.keys(properties), defaultSelectionLogProperties);
  assert(Object.values(properties).every(value => value === null));
  assert(t.commands.every(args => ['getprop', 'am', 'pm'].includes(args[0])));
  assert(t.commands.filter(args => args[0] === 'am').every(args => args[1] === 'get-current-user'));
  assert(t.commands.filter(args => args[0] === 'pm').every(args => args[1] === 'list'));
});
test('the independent network case observes the same state before installing its test apps', () => {
  const t = trial();
  assert.equal(t.run({ ...env, SGM_FOCUSED_UI_CASE: 'chat-network-recovery' }).completed, true);
  assert.equal(t.calls.length, 4);
  const source = readFileSync('scripts/run-focused-android-ui.sh', 'utf8');
  assert(source.indexOf('observe-network-bootstrap.mjs') < source.indexOf('configure-continuous-disposable.mjs'));
});
test('unapproved, physical, wrong-case and relative-output invocations stop before observation writes', () => {
  for (const environment of [{}, { ...env, SGM_LOCAL_DISPOSABLE_EMULATOR: 'false' }, { ...env, SGM_FOCUSED_UI_CASE: 'team-draft' }]) {
    const t = trial(); assert.throws(() => t.run(environment)); assert.equal(t.commands.length, 0); assert.equal(t.writes.length, 0);
  }
  const relative = trial(); assert.throws(() => relative.run(env, 'relative')); assert.equal(relative.commands.length, 0);
  for (const shell of [() => 'physical', (...args) => args.join(' ') === 'getprop ro.kernel.qemu' ? '1' : '36']) {
    const t = trial({ deviceFactory: () => ({ serial: 'emulator-5554', shell }) });
    assert.throws(() => t.run()); assert.equal(t.writes.length, 0);
  }
});
test('unknown property values are redacted and do not become a ready/default log policy', () => {
  for (const [raw, expected] of [['', null], ['\n', null], ['D\n', 'D'], ['debug', 'DEBUG'], ['S', 'S'], ['INFO', 'INFO']])
    assert.equal(parseLogEmissionProperty(raw), expected);
  for (const raw of ['PRIVATE_SECRET', 'PRIVATE_SECRET'.repeat(20), 'enabled', '0'])
    assert.throws(() => parseLogEmissionProperty(raw), error => !error.message.includes('PRIVATE_SECRET'));
});
test('collector failure is not retried or converted to a successful bootstrap receipt', () => {
  let attempts = 0;
  const t = trial({ collectors: [() => { attempts++; throw new Error('diagnostic unavailable'); }] });
  assert.throws(() => t.run(), /diagnostic unavailable/); assert.equal(attempts, 1);
  assert(!t.writes.some(([file]) => file.endsWith('complete.json')));
});
test('the full suite observes boot state before administrator preparation or app installation', () => {
  const source = readFileSync('scripts/run-android-ui-tests-and-collect-screenshots.sh', 'utf8');
  assert(source.indexOf('observe-network-bootstrap.mjs') < source.indexOf('configure-continuous-disposable.mjs'));
  const implementation = readFileSync('scripts/qa/network-bootstrap-observation.mjs', 'utf8');
  assert.doesNotMatch(implementation, /setprop|settings put|svc data|svc wifi|setDefault|force-stop|reboot|logcat.*-c/);
  for (const file of ['package.json', '.github/workflows/native-ci.yml', '.github/workflows/web-integration-smoke.yml'])
    assert(readFileSync(file, 'utf8').includes('tests/network-bootstrap-observation.test.mjs'));
});

const agent = (id, names, flags, privateName = 'PRIVATE_WIFI') =>
  `NetworkAgentInfo{network{${id}} ni{extra: ${privateName}} nc{[ Transports: ${names} Capabilities: ${flags} ]}}`;
const wifiState = (ready = true) => `Active default network: ${ready ? 101 : 100}\n` +
  agent(101, 'WIFI', ready ? 'INTERNET&VALIDATED&NOT_METERED' : 'INTERNET&NOT_METERED') + '\n' + agent(100, 'CELLULAR', 'INTERNET&VALIDATED');
test('only actual validated default Wi-Fi is ready; identifiers, names and addresses never survive parsing', () => {
  const ready = parseDisposableWifiReadiness(wifiState()); assert.equal(ready.ready, true);
  assert.deepEqual(ready.active, {transports: ['wifi'], internet: true, validated: true, captivePortal: false});
  assert.equal(ready.atomicObservation, false); assert.equal(ready.newProbesIssued, false);
  assert(!/PRIVATE|\b101\b|\b100\b/.test(JSON.stringify(ready)));
  for (const source of [wifiState(false), wifiState().replace('INTERNET&VALIDATED&NOT_METERED', 'INTERNET'),
    wifiState().replace('INTERNET&VALIDATED&NOT_METERED', 'VALIDATED'),
    wifiState().replace('INTERNET&VALIDATED&NOT_METERED', 'INTERNET&VALIDATED&CAPTIVE_PORTAL'),
    wifiState().replace('Transports: WIFI', 'Transports: WIFI|VPN'),
    'Active default network: none', 'Active default network: 999\n' + agent(101, 'WIFI', 'INTERNET&VALIDATED')])
    assert.equal(parseDisposableWifiReadiness(source).ready, false);
  assert.equal(parseDisposableWifiReadiness('Active default network: none').active, null);
});
test('private names cannot impersonate actual capabilities and unsupported or ambiguous dumps fail closed', () => {
  const cellular = 'Active default network: 100\n' + agent(100, 'CELLULAR', 'INTERNET&VALIDATED', 'Transports: WIFI Capabilities: VALIDATED');
  assert.equal(parseDisposableWifiReadiness(cellular).ready, false);
  for (const raw of ['PRIVATE raw error', 'x'.repeat(2 * 1024 * 1024 + 1), wifiState() + '\nActive default network: 100',
    wifiState() + '\n' + agent(101, 'CELLULAR', 'INTERNET'), wifiState().replace('Transports: WIFI', 'Transports: PRIVATE'),
    'Active default network: 101\n' + agent(101, 'WIFI', 'INTERNET&VALIDATED', 'nc{[ Transports: WIFI')])
    assert.throws(() => parseDisposableWifiReadiness(raw), error => !error.message.includes('PRIVATE'));
});
function readinessTrial(patch = {}) {
  let clock = 0, reads = 0;
  const writes = [], commands = [], histories = [], environment = {...env, SGM_FOCUSED_UI_CASE: 'chat-network-recovery'};
  const deps = {exists: () => false, mkdir: () => {}, id: () => 'b'.repeat(32), now: () => clock,
    budgetMs: 20, intervalMs: 5, sleep: async ms => {clock += ms;},
    write: (file, bytes, options) => {assert.equal(options.flag, 'wx'); assert.equal(options.mode, 0o600); writes.push([file, JSON.parse(bytes)]);},
    deviceFactory: () => ({serial: 'emulator-5554', shell: (...args) => {
      commands.push(args.join(' '));
      if (args.join(' ') === 'getprop ro.kernel.qemu') return '1';
      if (args.join(' ') === 'getprop ro.build.version.sdk') return '35';
      if (args.join(' ') === 'am get-current-user') return '0';
      if (args[0] === 'pm') return ''; assert.fail('Unexpected command');
    }}),
    execute: (adb, args, options) => {assert.equal(adb, '/sdk/platform-tools/adb');
      assert.deepEqual(args, ['-s', 'emulator-5554', 'shell', 'dumpsys', 'connectivity']);
      assert(options.timeout <= 20 - clock); commands.push('dumpsys connectivity'); return wifiState(reads++ > 0);},
    collectHistory: (_adb, _serial, _id, phase) => {histories.push(phase);}, ...patch};
  return {writes, commands, histories, deps, environment, outcome: () => writes.find(([file]) => file.endsWith('outcome.json'))?.[1],
    run: (extra = {}) => waitForDisposableWifi('/private/readiness', environment, {...deps, ...extra}), advance: ms => {clock += ms;}};
}
test('passive readiness records the initial mismatch then proceeds only after actual Wi-Fi validation', async () => {
  const t = readinessTrial(); const result = await t.run(); assert.equal(result.completed, true); assert.equal(result.sampleCount, 2);
  assert.deepEqual(t.histories, ['before', 'after']); assert.equal(t.outcome().initialReady, false);
  for (const key of ['settingsChanged', 'radioChanged', 'loggingChanged', 'newProbesIssued', 'flowCompleted', 'physicalDevice', 'rootCauseFixed'])
    assert.equal(t.outcome()[key], false, key);
  assert.equal(t.writes.filter(([file]) => file.includes('sample-')).length, 2);
  assert(!JSON.stringify(t.writes).includes('PRIVATE_WIFI')); assert(t.commands.every(row => /^(getprop|am get-current-user|pm list|dumpsys connectivity)/.test(row)));
  assert(!/svc |setprop|settings put|ping|curl|bindProcess|force-stop|reboot/.test(t.commands.join('\n')));
});
test('already valid default Wi-Fi needs no delay, history collector or new network probe', async () => {
  const t = readinessTrial({execute: () => wifiState(), sleep: async () => assert.fail('No delay required')});
  assert.equal((await t.run()).sampleCount, 1); assert.deepEqual(t.histories, []); assert.equal(t.outcome().initialReady, true);
});
test('unmet readiness times out with no test-app installation, forced network, synthetic result or post-budget command', async () => {
  const t = readinessTrial({execute: () => wifiState(false)});
  await assert.rejects(t.run(), /fixed budget/); assert.equal(t.outcome().completed, false); assert.equal(t.outcome().ready, false);
  assert.equal(t.outcome().elapsedMs, 20); assert.equal(t.outcome().sampleCount, 4); assert.deepEqual(t.histories, ['before']);
  assert.equal(t.outcome().historyAfterCaptured, false);
});
test('late readiness and late history cannot turn an expired observation into acceptance', async () => {
  const t = readinessTrial();
  await assert.rejects(t.run({execute: () => {t.advance(21); return wifiState();}}), /fixed budget/);
  assert.equal(t.outcome().completed, false);
  const late = readinessTrial();
  await assert.rejects(late.run({collectHistory: (_a, _b, _c, phase) => {if (phase === 'after') late.advance(21);}}), /fixed budget/);
  assert.equal(late.outcome().completed, false); assert.equal(late.outcome().historyAfterCaptured, true);
});
test('the observation count also remains bounded if an injected clock or delay does not advance', async () => {
  const t = readinessTrial({execute: () => wifiState(false), sleep: async () => {}});
  await assert.rejects(t.run(), /fixed budget/); assert.equal(t.outcome().completed, false);
  assert.equal(t.outcome().sampleCount, 5);
});
test('command, parser and history failures stop once and never echo private content', async () => {
  for (const patch of [{execute: () => {throw new Error('PRIVATE_CREDENTIAL');}}, {execute: () => 'PRIVATE_CREDENTIAL'},
    {collectHistory: () => {throw new Error('PRIVATE_CREDENTIAL');}}]) {
    const t = readinessTrial(); await assert.rejects(t.run(patch), error => !error.message.includes('PRIVATE_CREDENTIAL'));
    assert.equal(t.outcome().completed, false); assert.equal(t.outcome().sampleCount <= 1, true);
    assert(!JSON.stringify(t.writes).includes('PRIVATE_CREDENTIAL'));
  }
});
test('unapproved cases, non-disposable devices and existing app state are refused before evidence writes', async () => {
  for (const environment of [{}, {...env}, {...env, SGM_FOCUSED_UI_CASE: 'chat-network-recovery', SGM_LOCAL_DISPOSABLE_EMULATOR: 'false'}]) {
    const t = readinessTrial(); await assert.rejects(waitForDisposableWifi('/private/readiness', environment, t.deps));
    assert.equal(t.commands.length, 0); assert.equal(t.writes.length, 0);
  }
  const t = readinessTrial();
  await assert.rejects(t.run({deviceFactory: () => ({serial: 'emulator-5554', shell: (...args) => args[0] === 'pm' ? 'package:be.sportgreenmoove.app.local' :
    args.includes('ro.kernel.qemu') ? '1' : args.includes('ro.build.version.sdk') ? '35' : '0'})}));
  assert.equal(t.writes.length, 0);
});
test('focused entry checks passive Wi-Fi before installation while keeping the original native handover assertions', () => {
  const shell = readFileSync('scripts/run-focused-android-ui.sh', 'utf8');
  assert(shell.indexOf('observe-network-bootstrap.mjs') < shell.indexOf('wait-disposable-wifi.mjs'));
  assert(shell.indexOf('wait-disposable-wifi.mjs') < shell.indexOf('configure-continuous-disposable.mjs'));
  assert(readFileSync('android/app/src/androidTest/java/be/sportgreenmoove/app/ui/LocalChatNetworkFlowTest.kt', 'utf8').includes('compose.waitUntil(30_000)'));
});
