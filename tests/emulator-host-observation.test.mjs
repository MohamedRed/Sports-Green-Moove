import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, symlink, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { parseDocument } from 'yaml';
import { parseHostStat, selectEmulatorHost, inspectEmulatorHost, probeEmulatorHost, observeEmulatorHost,
  createFreshHostObservationDirectory } from '../scripts/qa/emulator-host-observation.mjs';

const rawStat = (pid, { parent = 1, state = 'S', ticks = '123456', name = 'private command (not retained)' } = {}) =>
  `${pid} (${name}) ${[state, parent, ...Array(17).fill(0), ticks, 0, 0].join(' ')}\n`;
const settings = { port: 5554, avd: 'test' };
test('a new full-matrix output parent is created without reusing an earlier observation directory', async t => {
  const root = await mkdtemp(join(tmpdir(), 'sgm-host-output-')); t.after(() => rm(root, {recursive: true, force: true}));
  const directory = join(root, 'focused-safety-ui/full-matrix/host-shutdown');
  await createFreshHostObservationDirectory(directory);
  assert.equal((await stat(directory)).mode & 0o777, 0o700);
  await writeFile(join(directory, 'started.json'), 'retained-original-unit-fixture');
  await assert.rejects(() => createFreshHostObservationDirectory(directory), { code: 'EEXIST' });
  assert.equal(await readFile(join(directory, 'started.json'), 'utf8'), 'retained-original-unit-fixture');
  await assert.rejects(() => createFreshHostObservationDirectory('relative/host-shutdown'));
});
async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'sgm-host-observation-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const process = async (pid, { name = 'qemu-system-x86_64-headless', args = ['-avd', 'test', '-port', '5554'], ...values } = {}) => {
    const dir = join(root, String(pid)); await mkdir(dir, { recursive: true });
    await writeFile(join(dir, 'stat'), rawStat(pid, values));
    await symlink('/private-sensitive-path/' + name, join(dir, 'exe'));
    await writeFile(join(dir, 'cmdline'), ['binary', ...args, '--private-value', 'do-not-retain-this-secret', ''].join('\0'));
    await writeFile(join(dir, 'environ'), 'DO_NOT_READ=private-environment');
    await writeFile(join(dir, 'wchan'), 'futex_wait_queue');
    await mkdir(join(dir, 'task', String(pid)), { recursive: true });
    await writeFile(join(dir, 'task', String(pid), 'wchan'), 'do_futex');
    await mkdir(join(dir, 'fd')); await symlink('pipe:[12345]', join(dir, 'fd', '1'));
    await symlink('/private-sensitive-path/diagnostic-file', join(dir, 'fd', '2'));
  };
  return { root, process };
}

test('stat parsing handles parentheses without retaining the process command or unsafe fields', () => {
  assert.deepEqual(parseHostStat(rawStat(80)), { pid: 80, parentPid: 1, state: 'S', startedTicks: '123456' });
  for (const raw of ['', '80 malformed', rawStat(0), rawStat(80, { state: 'unknown' }), rawStat(80, { ticks: 'token' })])
    assert.throws(() => parseHostStat(raw));
});
test('one exact SDK host binds its birth identity, not another emulator, command or environment', async t => {
  const f = await fixture(t); await f.process(80); await f.process(81, { args: ['-avd', 'test', '-port', '5556'] });
  await f.process(82, { name: 'node' }); await f.process(83, { args: ['-avd', 'personal-device', '-port', '5554'] });
  const identity = await selectEmulatorHost(settings, f.root);
  assert.deepEqual(identity, { pid: 80, startedTicks: '123456', executable: 'qemu-system-x86_64-headless', ...settings });
  assert.doesNotMatch(JSON.stringify(identity), /sensitive|private|secret|environment/);
});
test('ambiguous, missing, duplicate-flag and zombie processes never select an alternate target', async t => {
  const f = await fixture(t);
  await assert.rejects(selectEmulatorHost(settings, f.root));
  await f.process(80, { args: ['-avd', 'test', '-port', '5554', '-port', '5556'] });
  await f.process(81, { state: 'Z' }); await assert.rejects(selectEmulatorHost(settings, f.root));
  await f.process(82); await f.process(83); await assert.rejects(selectEmulatorHost(settings, f.root));
  for (const bad of [{ port: 5555, avd: 'test' }, { port: 5554, avd: 'personal-device' }])
    await assert.rejects(selectEmulatorHost(bad, f.root));
});
test('snapshots expose only bounded wait channels, known direct children and stream kinds', async t => {
  const f = await fixture(t); await f.process(80);
  await f.process(81, { name: 'crashpad_handler', parent: 80 });
  await f.process(82, { name: 'netsimd', parent: 80 });
  await f.process(83, { name: 'unrelated-private-application', parent: 80 });
  await f.process(84, { name: 'netsimd', parent: 1 });
  const identity = await selectEmulatorHost(settings, f.root), row = await inspectEmulatorHost(identity, f.root);
  assert.equal(row.state, 'present'); assert.deepEqual(row.tasks, [{ tid: 80, waitChannel: 'do_futex' }]);
  assert.deepEqual(row.descendants.map(child => child.executable), ['crashpad_handler', 'netsimd']);
  assert.equal(row.stdout, 'pipe'); assert.equal(row.stderr, 'other');
  assert.doesNotMatch(JSON.stringify(row), /secret|environment|private|cmdline|environ|pipe:\[12345\]/);
});
test('a reused PID stops observation before reading replacement commands, files or children', async t => {
  const f = await fixture(t); await f.process(80); const identity = await selectEmulatorHost(settings, f.root);
  await writeFile(join(f.root, '80/stat'), rawStat(80, { ticks: '999999' }));
  assert.deepEqual(await probeEmulatorHost(identity, f.root), { state: 'identity-changed' });
  assert.deepEqual(await inspectEmulatorHost(identity, f.root), { state: 'identity-changed' });
});
test('only absent bound process metadata proves disappearance; zombies and malformed metadata remain distinct', async t => {
  const f = await fixture(t); await f.process(80); const identity = await selectEmulatorHost(settings, f.root);
  await writeFile(join(f.root, '80/stat'), rawStat(80, { state: 'Z' }));
  assert.deepEqual(await inspectEmulatorHost(identity, f.root), { state: 'zombie', processState: 'Z' });
  await writeFile(join(f.root, '80/stat'), 'unrecognized private data');
  assert.deepEqual(await inspectEmulatorHost(identity, f.root), { state: 'unavailable' });
  await rm(join(f.root, '80'), { recursive: true });
  assert.deepEqual(await inspectEmulatorHost(identity, f.root), { state: 'gone' });
});
test('unknown thread metadata cannot leak into observations or establish a stopped process', async t => {
  const f = await fixture(t); await f.process(80); const identity = await selectEmulatorHost(settings, f.root);
  await writeFile(join(f.root, '80/task/80/wchan'), 'private unexpected content with spaces');
  assert.deepEqual((await inspectEmulatorHost(identity, f.root)).tasks, [{ tid: 80, waitChannel: null }]);
  await rm(join(f.root, '80/task'), { recursive: true });
  assert.deepEqual(await inspectEmulatorHost(identity, f.root), { state: 'unavailable' });
});
test('CLI refuses personal/local or unapproved context before creating a receipt or worker', () => {
  const cli = resolve('scripts/qa/observe-emulator-shutdown.mjs');
  for (const args of [['start', 'all'], ['start', 'ride-observation'], ['observe', 'ride-observation'], ['wait', 'ride-observation']]) {
    const result = spawnSync(process.execPath, [cli, ...args], { env: {}, encoding: 'utf8' });
    assert.notEqual(result.status, 0); assert.equal(result.stdout, '');
  }
});
test('a persistently live process yields seven bounded samples and no invented exit or signals', async () => {
  const identity = { pid: 80, startedTicks: '123456' }, samples = []; let time = 0, probes = 0, snapshots = 0;
  const result = await observeEmulatorHost(identity, { now: () => time, sleep: async ms => { time += ms; },
    probe: async value => { assert.equal(value, identity); probes++; return { state: 'present' }; },
    inspect: async value => { assert.equal(value, identity); snapshots++; return { state: 'present' }; },
    onSample: async row => samples.push(row) });
  assert.deepEqual(result, { finalState: 'present', observations: 7, elapsedMs: 90_000 });
  assert.equal(probes, 91); assert.equal(snapshots, 7);
  assert.deepEqual(samples.map(row => row.elapsedMs), [0, 15_000, 30_000, 45_000, 60_000, 75_000, 90_000]);
});
test('disappearance, replacement, zombies and unavailability terminate without another target or probe', async () => {
  for (const state of ['gone', 'identity-changed', 'zombie', 'unavailable']) {
    let probes = 0;
    const result = await observeEmulatorHost({}, { now: () => 0, sleep: async () => assert.fail('Unexpected wait'),
      probe: async () => { probes++; return { state }; }, inspect: async () => assert.fail('Replacement metadata must not be read'),
      onSample: async row => assert.equal(row.state, state) });
    assert.equal(result.finalState, state); assert.equal(result.observations, 1); assert.equal(probes, 1);
  }
});
test('process exit during a detailed snapshot preserves that observed outcome', async () => {
  const result = await observeEmulatorHost({}, { now: () => 0, sleep: async () => assert.fail('Unexpected wait'),
    probe: async () => ({ state: 'present' }), inspect: async () => ({ state: 'gone' }), onSample: async () => {} });
  assert.deepEqual(result, { finalState: 'gone', observations: 1, elapsedMs: 0 });
});
test('the observer has no device, process signal, request, environment or raw argument logging path', async () => {
  const core = await readFile('scripts/qa/emulator-host-observation.mjs', 'utf8');
  const cli = await readFile('scripts/qa/observe-emulator-shutdown.mjs', 'utf8');
  assert.doesNotMatch(core + cli, /execFile|spawnSync|process\.kill|\.kill\(|fetch\(|https?:|['"]environ['"]/);
  assert(cli.includes("detached: true, stdio: 'ignore'")); assert(cli.includes('child.unref()'));
  assert(cli.includes('90_000')); assert(cli.includes('95_000')); assert(cli.includes('flag: \'wx\''));
  assert(cli.includes('flowAccepted: false, rootCauseConfirmed: false'));
  const workflow = parseDocument(await readFile('.github/workflows/native-focused-ui.yml', 'utf8')).toJSON();
  const steps = workflow.jobs['focused-case'].steps;
  const wait = steps.findIndex(step => step.run?.includes('observe-emulator-shutdown.mjs wait'));
  const upload = steps.findIndex(step => step.uses?.startsWith('actions/upload-artifact'));
  assert(wait > 0 && wait < upload); assert.equal(steps[wait].if, '${{ always() }}');
});
