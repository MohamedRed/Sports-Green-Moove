import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { observeNetworkBootstrap, defaultSelectionLogProperties, parseLogEmissionProperty } from '../scripts/qa/network-bootstrap-observation.mjs';

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
