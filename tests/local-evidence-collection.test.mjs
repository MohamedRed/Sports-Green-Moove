import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { collectLocalUiEvidence, EvidenceCollectionError } from '../scripts/qa/collect-local-ui-evidence.mjs';

const password = 'synthetic-credential-for-redaction';
const fixture = fileURLToPath(new URL('./fixtures/adb-evidence-process.mjs', import.meta.url));
const runId = 'abcdef0123456789abcdef0123456789';
process.env.SGM_LOCAL_DISPOSABLE_EMULATOR = 'true';

function setup(t, mode = 'success') {
  const dir = mkdtempSync(resolve(tmpdir(), 'sgm-pull-test-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const calls = [];
  const execute = (command, args, options) => {
    assert.equal(command, '/sdk/platform-tools/adb'); calls.push({ args, options });
    if (args[0] === 'version') return 'Android Debug Bridge version 1.0.41\nVersion 37.0.0-test\n';
    if (args.includes('wait-for-device')) return '';
    if (args.includes('get-state')) return 'device\n';
    if (args.includes('getprop')) return '1\n';
    assert.fail('Unexpected readiness command');
  };
  const spawn = (command, args, options) => {
    assert.equal(command, '/sdk/platform-tools/adb'); assert.equal(args[2], 'pull'); calls.push({ args, options });
    return spawnSync(process.execPath, [fixture, mode], { ...options,
      env: { ...options.env, SGM_TEST_REDACT_ME: password } });
  };
  const input = { adb: '/sdk/platform-tools/adb', serial: 'emulator-5554', runId,
    evidenceDir: dir, password, phase: 'network-recovery' };
  return { dir, input, calls, execute, spawn,
    collect: (changes = {}) => collectLocalUiEvidence({ ...input, ...changes }, execute, spawn),
    read: (phase = input.phase) => JSON.parse(readFileSync(resolve(dir, `adb-pull-${phase}.json`), 'utf8')) };
}

test('captures actual subprocess output with scoped tracing and records command success, not flow success', (t) => {
  const mock = setup(t);
  const receipt = mock.collect();
  assert.equal(receipt.completed, true); assert.equal(receipt.status, 0); assert.equal(receipt.signal, null);
  assert.equal(receipt.runId, runId); assert.equal(receipt.phase, 'network-recovery');
  assert.equal(receipt.scope, 'local-adb-file-sync-command-not-flow-verification');
  assert.match(receipt.version, /37.0.0-test/); assert.equal(receipt.stdout, 'file transfer output\n');
  assert.equal(receipt.stderr, 'sync diagnostic [REDACTED]\n');
  assert.deepEqual(mock.read(), receipt);
  const pull = mock.calls.find((call) => call.args[2] === 'pull');
  assert.equal(pull.options.env.ADB_TRACE, 'sync'); assert.equal(pull.options.timeout, 120_000);
  assert.deepEqual(pull.options.stdio, ['ignore', 'pipe', 'pipe']);
  assert.equal(mock.calls.filter((call) => call.args[2] === 'pull').length, 1);
  assert(!mock.calls.some((call) => call.args.includes('logcat')), 'Successful copies do not need failure diagnostics');
});

test('a success-looking file count with exit 1 stays failed, retains redacted diagnostics and is never retried', (t) => {
  const mock = setup(t, 'failed-summary');
  assert.throws(() => mock.collect(), (error) => {
    assert(error instanceof EvidenceCollectionError); assert.equal(error.status, 1);
    assert(!JSON.stringify(error).includes(password)); assert(!String(error).includes(password));
    return true;
  });
  const receipt = mock.read();
  assert.equal(receipt.completed, false); assert.equal(receipt.status, 1);
  assert.match(receipt.stdout, /55 files pulled, 0 skipped/); assert.match(receipt.stderr, /sync diagnostic \[REDACTED\]/);
  assert(!JSON.stringify(receipt).includes(password));
  assert.equal(mock.calls.filter((call) => call.args[2] === 'pull').length, 1);
  collectLocalUiEvidence({ ...mock.input, phase: 'failure-cleanup' }, mock.execute, setup(t).spawn);
  assert.equal(mock.read('failure-cleanup').completed, true);
  assert.equal(mock.read().completed, false, 'A successful cleanup copy must not overwrite the primary failure');
});

test('signals and missing exit statuses cannot be recorded as successful copies', (t) => {
  const mock = setup(t, 'signal');
  assert.throws(() => mock.collect(), EvidenceCollectionError);
  assert.equal(mock.read().completed, false); assert.equal(mock.read().status, null); assert.equal(mock.read().signal, 'SIGTERM');
});

test('failed copies retain their failed receipt and collect the device state without another transfer', (t) => {
  const mock = setup(t, 'failed-summary');
  const execute = (command, args, options) => {
    if (args.includes('logcat') || args.includes('dumpsys') || args.includes('/proc/meminfo')) {
      mock.calls.push({ args, options });
      if (args.includes('installs')) return 'Active install sessions:\n';
      return `scoped device diagnostic ${password}`;
    }
    return mock.execute(command, args, options);
  };
  assert.throws(() => collectLocalUiEvidence(mock.input, execute, mock.spawn), EvidenceCollectionError);
  assert.equal(mock.read().completed, false);
  const diagnostic = JSON.parse(readFileSync(resolve(mock.dir, 'evidence-copy-network-recovery-diagnostics.json')));
  assert.equal(diagnostic.runId, runId); assert.equal(diagnostic.label, 'evidence-copy-network-recovery');
  assert.equal(diagnostic.scope, 'read-only-native-process-failure-diagnostic-not-flow-verification');
  assert.equal(diagnostic.records.length, 7); assert(diagnostic.records.every(({ status }) => status === 'collected'));
  assert.equal(mock.calls.filter((call) => call.args[2] === 'pull').length, 1);
  for (const { file } of diagnostic.records) assert(!readFileSync(resolve(mock.dir, file), 'utf8').includes(password));
});

test('unavailable diagnostics cannot mask, repair or retry the original failed copy', (t) => {
  const mock = setup(t, 'failed-summary');
  assert.throws(() => mock.collect(), (error) => error instanceof EvidenceCollectionError && error.status === 1);
  assert.equal(mock.read().status, 1); assert.equal(mock.read().completed, false);
  const diagnostic = JSON.parse(readFileSync(resolve(mock.dir, 'evidence-copy-network-recovery-diagnostics.json')));
  assert(diagnostic.records.every(({ status }) => status === 'failed'));
  assert.equal(mock.calls.filter((call) => call.args[2] === 'pull').length, 1);
});

test('unapproved, physical, malformed-run and unsupported-phase calls fail before executing commands or writing receipts', (t) => {
  const mock = setup(t);
  for (const changes of [{ serial: 'physical-device' }, { runId: 'stale' }, { phase: 'invented' },
    { evidenceDir: 'relative' }, { password: '' }]) assert.throws(() => collectLocalUiEvidence({ ...mock.input, ...changes }, mock.execute));
  const old = process.env.SGM_LOCAL_DISPOSABLE_EMULATOR;
  delete process.env.SGM_LOCAL_DISPOSABLE_EMULATOR;
  try { assert.throws(() => collectLocalUiEvidence(mock.input, mock.execute)); }
  finally { process.env.SGM_LOCAL_DISPOSABLE_EMULATOR = old; }
  assert.equal(mock.calls.length, 0); assert.deepEqual(readdirSync(mock.dir), []);
});

test('timeouts, buffer errors and unavailable executables are retained without running another transfer', (t) => {
  for (const code of ['ETIMEDOUT', 'ENOBUFS', 'ENOENT']) {
    const mock = setup(t);
    let calls = 0;
    const spawn = () => { calls++; return { status: null, signal: null,
      error: Object.assign(new Error('Do not echo raw error ' + password), { code }), stdout: '', stderr: password }; };
    assert.throws(() => collectLocalUiEvidence(mock.input, mock.execute, spawn), EvidenceCollectionError);
    const receipt = mock.read(); assert.equal(receipt.completed, false); assert.equal(receipt.errorCode, code);
    assert.equal(receipt.stderr, '[REDACTED]'); assert.equal(calls, 1);
  }
});

test('a readiness failure prevents collection and same-phase receipts cannot overwrite an earlier result', (t) => {
  const mock = setup(t);
  let spawned = false;
  const notEmulator = (command, args, options) => args.includes('getprop') ? '0' : mock.execute(command, args, options);
  assert.throws(() => collectLocalUiEvidence(mock.input, notEmulator, () => { spawned = true; }));
  assert.equal(spawned, false); assert.deepEqual(readdirSync(mock.dir), []);
  const receipt = mock.collect();
  const copies = mock.calls.filter((call) => call.args[2] === 'pull').length;
  assert.throws(() => mock.collect(), /cannot be repeated/);
  assert.equal(mock.calls.filter((call) => call.args[2] === 'pull').length, copies);
  assert.deepEqual(mock.read(), receipt);
});

test('all replay copy boundaries use named diagnostics and stay behind complete instrumentation and host verification', () => {
  const read = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
  const runner = read('scripts/qa/local-android-session.mjs');
  for (const phase of ['confirmed-restart', 'response-loss', 'network-recovery', 'failure-cleanup'])
    assert(runner.includes(`collectEvidence('${phase}')`));
  assert(!runner.includes("run(adb, ['-s', serial, 'pull'"), 'Uncaptured duplicate copy implementation must be removed');
  assert(runner.indexOf("collectEvidence('network-recovery')") < runner.indexOf('verifyChatNetworkUi(networkFixture'));
  assert(runner.includes("assert(result, 'A complete verified replay is required before recording success')"));
  for (const workflow of ['native-ci.yml', 'web-integration-smoke.yml']) {
    const value = read('.github/workflows/' + workflow);
    assert.equal(value.split('"tests/local-evidence-collection.test.mjs"').length - 1, 2);
    assert.equal(value.split('"tests/fixtures/adb-evidence-process.mjs"').length - 1, 2);
  }
  const pkg = JSON.parse(read('package.json'));
  assert(pkg.scripts['test:local-flow-isolation'].includes('tests/local-evidence-collection.test.mjs'));
});
