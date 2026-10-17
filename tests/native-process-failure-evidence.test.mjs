import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { collectNativeProcessFailure } from '../scripts/qa/native-process-failure-evidence.mjs';
import { installationState } from '../scripts/qa/native-package-diagnostics.mjs';

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
    if (args.includes('installs')) return 'Active install sessions:\nHistorical install sessions:\n';
    return `diagnostic ${password} Bearer private/token+= eyJheader.payload.signature eyJunsigned.payload.`;
  });
  assert.equal(calls.length, 7); assert.equal(receipt.records.length, 7);
  assert(receipt.host.totalMemoryBytes > 0 && receipt.host.cpuCount > 0);
  assert.equal(receipt.records[0].empty, true); assert(receipt.records.every((item) => item.status === 'collected'));
  assert(calls[1].includes('be.sportgreenmoove.app.local')); assert(calls[2].includes('800'));
  assert.deepEqual(calls[4], ['-s', 'emulator-5554', 'shell', 'dumpsys', 'package', 'frozen']);
  assert(calls[6].includes('4000') && calls[6].includes('threadtime') && calls[6].includes('PackageManager:I'));
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
  const receipt = collectNativeProcessFailure(settings, (adb, args) => {
    if (++calls === 1) throw Object.assign(new Error('private detail'), { code: 'ENOBUFS', stdout: password });
    if (args.includes('installs')) return 'Active install sessions:\n';
    return 'scoped process diagnostic';
  });
  assert.equal(calls, 7); assert.deepEqual(receipt.records[0], { kind: 'crash', status: 'failed', errorCode: 'ENOBUFS' });
  assert.equal(receipt.records[2].status, 'collected'); assert(!JSON.stringify(receipt).includes(password));
});

test('installer state keeps session identities and typed fields, never URLs, paths or free-form messages', () => {
  const result = JSON.parse(installationState(`Active install sessions:
  Active Session 123:
    installerPackageName=com.android.vending createdMillis=1792272180000 stageDir=/private/path
    appPackageName=com.google.android.gms originatingUri=https://private.example/secret
    mCommitted=true mSealed=true mDestroyed=false mFinalStatus=0
    mFinalMessage=private-detail mSessionErrorMessage=private-detail
Historical install sessions:
  Session 122:
    appPackageName=be.sportgreenmoove.app.local mSessionFailed=false
Finalized install sessions:
Legacy install sessions:
`));
  assert.deepEqual(result.sections[0].sessions, [{ id: 123, installerPackageName: 'com.android.vending',
    createdMillis: 1792272180000, appPackageName: 'com.google.android.gms',
    mCommitted: true, mSealed: true, mDestroyed: false, mFinalStatus: 0 }]);
  assert.equal(result.sections[1].sessions[0].id, 122);
  assert(!JSON.stringify(result).includes('private'));
  assert.throws(() => installationState('Error: private-output'), /active-session section/);
});

test('an unrecognized installer response cannot be recorded as an empty successful state', (t) => {
  const settings = input(t), previous = process.env.SGM_LOCAL_DISPOSABLE_EMULATOR;
  process.env.SGM_LOCAL_DISPOSABLE_EMULATOR = 'true';
  t.after(() => { if (previous === undefined) delete process.env.SGM_LOCAL_DISPOSABLE_EMULATOR; else process.env.SGM_LOCAL_DISPOSABLE_EMULATOR = previous; });
  const receipt = collectNativeProcessFailure(settings, () => 'unrecognized-private-output');
  assert.equal(receipt.records.find(({ kind }) => kind === 'install-sessions').status, 'failed');
  assert.equal(receipt.records.at(-1).status, 'collected');
  assert(!JSON.stringify(receipt).includes('private'));
});

test('wrapped installer values cannot silently become truncated package names or timestamps', () => {
  const result = JSON.parse(installationState(`Active install sessions:
  Active Session 123:
    appPackageName=com.google.and
    roid.gms createdMillis=17922735
    17550 mCommitted=true
Historical install sessions:
  Session 122:
    appPackageName=com.and
    roid.vending mDestroyed=true
`));
  assert.equal(result.sections[0].sessions[0].appPackageName, 'com.google.android.gms');
  assert.equal(result.sections[0].sessions[0].createdMillis, 1792273517550);
  assert.equal(result.sections[1].sessions[0].appPackageName, 'com.android.vending');
});
