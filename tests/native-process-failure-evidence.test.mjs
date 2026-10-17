import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { collectNativeProcessFailure } from '../scripts/qa/native-process-failure-evidence.mjs';

const runId = 'a'.repeat(32), password = 'isolated-fixture-password';
function input(t) {
  const directory = mkdtempSync(join(tmpdir(), 'sgm-process-diagnostics-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  return { adb: '/sdk/adb', serial: 'emulator-5554', directory, label: 'LocalTripCancellationFlowTest', password, runId };
}

test('an empty Java crash buffer does not suppress the OS exit reason or bounded process logs', (t) => {
  const settings = input(t), calls = [];
  const previous = process.env.SGM_LOCAL_DISPOSABLE_EMULATOR;
  process.env.SGM_LOCAL_DISPOSABLE_EMULATOR = 'true';
  t.after(() => { if (previous === undefined) delete process.env.SGM_LOCAL_DISPOSABLE_EMULATOR; else process.env.SGM_LOCAL_DISPOSABLE_EMULATOR = previous; });
  const receipt = collectNativeProcessFailure(settings, (adb, args, options) => {
    calls.push(args); assert.equal(options.timeout, 30_000); assert.equal(options.maxBuffer, 1024 * 1024);
    if (args.includes('crash')) return '';
    return `diagnostic ${password} Bearer private/token+= eyJheader.payload.signature eyJunsigned.payload.`;
  });
  assert.equal(calls.length, 4); assert.equal(receipt.records.length, 4);
  assert(receipt.host.totalMemoryBytes > 0 && receipt.host.cpuCount > 0);
  assert.equal(receipt.records[0].empty, true); assert(receipt.records.every((item) => item.status === 'collected'));
  assert(calls[1].includes('be.sportgreenmoove.app.local')); assert(calls[2].includes('800'));
  const text = readFileSync(join(settings.directory, receipt.records[1].file), 'utf8');
  assert(!text.includes(password) && !text.includes('private/token') && !text.includes('eyJheader') && !text.includes('eyJunsigned'));
  assert.equal(receipt.scope, 'read-only-native-process-failure-diagnostic-not-flow-verification');
});

test('unapproved or physical targets never execute a diagnostic command', (t) => {
  const settings = input(t), previous = process.env.SGM_LOCAL_DISPOSABLE_EMULATOR;
  t.after(() => { if (previous === undefined) delete process.env.SGM_LOCAL_DISPOSABLE_EMULATOR; else process.env.SGM_LOCAL_DISPOSABLE_EMULATOR = previous; });
  let calls = 0;
  process.env.SGM_LOCAL_DISPOSABLE_EMULATOR = 'false';
  assert.throws(() => collectNativeProcessFailure(settings, () => { calls++; }));
  process.env.SGM_LOCAL_DISPOSABLE_EMULATOR = 'true';
  assert.throws(() => collectNativeProcessFailure({ ...settings, serial: 'physical-device' }, () => { calls++; }));
  assert.throws(() => collectNativeProcessFailure({ ...settings, label: '../outside' }, () => { calls++; }));
  assert.equal(calls, 0);
});

test('one failed diagnostic preserves its code without stopping the remaining queries or leaking child output', (t) => {
  const settings = input(t), previous = process.env.SGM_LOCAL_DISPOSABLE_EMULATOR;
  process.env.SGM_LOCAL_DISPOSABLE_EMULATOR = 'true';
  t.after(() => { if (previous === undefined) delete process.env.SGM_LOCAL_DISPOSABLE_EMULATOR; else process.env.SGM_LOCAL_DISPOSABLE_EMULATOR = previous; });
  let calls = 0;
  const receipt = collectNativeProcessFailure(settings, () => {
    if (++calls === 1) throw Object.assign(new Error('private detail'), { code: 'ENOBUFS', stdout: password });
    return 'scoped process diagnostic';
  });
  assert.equal(calls, 4); assert.deepEqual(receipt.records[0], { kind: 'crash', status: 'failed', errorCode: 'ENOBUFS' });
  assert.equal(receipt.records[2].status, 'collected'); assert(!JSON.stringify(receipt).includes(password));
});
