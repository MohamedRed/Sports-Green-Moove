import assert from 'node:assert/strict';
import {mkdtempSync, readFileSync, readdirSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import test from 'node:test';
import {parseDocument} from 'yaml';
import {observeNetworkStartupLogging, startupLogProperty} from '../scripts/qa/network-startup-logging.mjs';

const approved = {SGM_LOCAL_DISPOSABLE_EMULATOR: 'true', SGM_NETWORK_STARTUP_LOGGING_APPROVED: 'true',
  SGM_NETWORK_DIAGNOSTIC_DEVICE_OWNED: 'true', GITHUB_ACTIONS: 'true', RUNNER_OS: 'Linux', RUNNER_ENVIRONMENT: 'github-hosted'};
const oldBoot = '00000000-0000-0000-0000-000000000001', newBoot = '00000000-0000-0000-0000-000000000002';
function fixture(t, options = {}) {
  const temporary = mkdtempSync(join(tmpdir(), 'sgm-startup-logging-'));
  t.after(() => rmSync(temporary, {recursive: true, force: true}));
  const output = join(temporary, 'observations'), calls = []; let property = options.original ?? '', boot = oldBoot, clock = 0;
  const controller = new AbortController();
  const shell = (...args) => {
    calls.push(args);
    if (args[0] === 'getprop') return ({'ro.kernel.qemu': options.qemu ?? '1', 'ro.build.version.sdk': options.api ?? '35',
      'ro.product.cpu.abi': 'x86_64', 'sys.boot_completed': '1', [startupLogProperty]: property})[args[1]];
    if (args[0] === 'am') return '0';
    if (args[0] === 'pm') return options.installed ? 'package:be.sportgreenmoove.app.local' : '';
    if (args[0] === 'cat') {assert.equal(args[1], '/proc/sys/kernel/random/boot_id'); return boot;}
    assert.deepEqual(args.slice(0, 2), ['setprop', startupLogProperty]);
    if (options.failRestore && args[2] === '') throw Error('private-sim-id-not-retained');
    property = args[2]; return '';
  };
  const command = (...args) => {
    calls.push(args);
    if (args[0] === 'reboot') {
      if (!options.noBootTransition) boot = newBoot;
      if (options.abortOnReboot) controller.abort();
    } else assert.deepEqual(args, ['wait-for-device']);
    return '';
  };
  const deps = {deviceFactory: () => ({serial: options.serial ?? 'emulator-5554', shell, command}),
    sleep: async (ms, signal) => {signal?.throwIfAborted(); clock += ms;}, now: () => clock,
    signal: controller.signal, id: () => 'a'.repeat(32), collectors: Array.from({length: 4}, () => (_adb, _serial, runId) => {
      if (options.failCollect) throw Error('private-sim-id-not-retained');
      return {runId, scope: 'synthetic-parser-observation'};
    })};
  return {output, calls, deps, property: () => property, run: env => observeNetworkStartupLogging(output, env ?? approved, deps)};
}

test('one approved cold startup observes three bounded states and restores the sole log property', async t => {
  const f = fixture(t); const result = await f.run();
  assert.equal(result.completed, true); assert.equal(result.restored, true); assert.equal(result.failed, false);
  assert.equal(result.rebootRequests, 1); assert.equal(result.bootTransitionObserved, true);
  assert.equal(result.flowExecuted, false); assert.equal(result.radioSettingsChanged, false); assert.equal(f.property(), '');
  assert.equal(f.calls.filter(row => row[0] === 'reboot').length, 1);
  assert.deepEqual(f.calls.filter(row => row[0] === 'setprop'), [['setprop', startupLogProperty, 'D'], ['setprop', startupLogProperty, '']]);
  assert.equal(readdirSync(f.output).filter(name => /^sample-\d.json$/.test(name)).length, 3);
  assert.equal(JSON.parse(readFileSync(join(f.output, 'sample-2.json'))).elapsedMs, 45_000);
  assert(!JSON.stringify(result).includes(oldBoot)); assert(!JSON.stringify(result).includes(newBoot));
});
for (const name of Object.keys(approved)) test('startup logging requires explicit ' + name, async t => {
  const f = fixture(t); await assert.rejects(f.run({...approved, [name]: 'false'})); assert.deepEqual(f.calls, []);
});
for (const [name, options] of [['physical device', {serial: 'personal-phone'}], ['not emulated', {qemu: '0'}],
  ['different API', {api: '34'}], ['installed app', {installed: true}], ['unsafe property', {original: 'private-account-id'}]])
  test('no logging mutation for ' + name, async t => {
    const f = fixture(t, options); await assert.rejects(f.run()); assert(!f.calls.some(row => row[0] === 'setprop'));
  });
for (const options of [{failCollect: true}, {abortOnReboot: true}, {noBootTransition: true}])
  test('failure or cancellation still restores logging: ' + Object.keys(options)[0], async t => {
    const f = fixture(t, options); const result = await f.run();
    assert.equal(result.failed, true); assert.equal(result.completed, false); assert.equal(result.restored, true);
    assert.equal(result.rebootRequests, 1); assert.equal(f.property(), '');
    assert(!readFileSync(join(f.output, 'restoration.json'), 'utf8').includes('private-sim-id-not-retained'));
  });
test('restoration failure cannot be reported as a completed diagnostic', async t => {
  const f = fixture(t, {failRestore: true}); const result = await f.run();
  assert.equal(result.failed, true); assert.equal(result.restored, false); assert.equal(result.completed, false);
  assert.equal(result.releaseAccepted, false); assert.equal(result.rootCauseConfirmed, false);
});
test('the existing registered diagnostic entry point requires explicit dispatch and approval for startup logging', () => {
  const read = file => parseDocument(readFileSync(new URL('../' + file, import.meta.url), 'utf8')).toJSON();
  const parent = read('.github/workflows/android-transport-probe.yml');
  assert.equal(parent.on.workflow_dispatch.inputs.network_startup.default, false);
  assert.equal(parent.jobs['network-startup-logging'].if, "${{ github.event_name == 'workflow_dispatch' && inputs.network_startup }}");
  assert.equal(parent.jobs['generated-file-transfer'].if, "${{ github.event_name != 'workflow_dispatch' || !inputs.network_startup }}");
  const child = read('.github/workflows/network-startup-logging.yml');
  assert.deepEqual(Object.keys(child.on), ['workflow_call']);
  assert.equal(child.jobs['startup-observation'].if, '${{ inputs.approved }}');
  assert(child.jobs['startup-observation'].steps.every(row => !row['continue-on-error']));
  const step = child.jobs['startup-observation'].steps.find(row => row.uses?.startsWith('reactivecircus/'));
  assert.equal(step.with['api-level'], 35); assert.equal(step.with.profile, 'pixel_6');
  assert.equal(step.env.SGM_NETWORK_STARTUP_LOGGING_APPROVED, 'true');
  assert(!JSON.stringify(child).includes('SGM_QA_PASSWORD'));
});
