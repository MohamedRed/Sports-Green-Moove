import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseStoreProcessEvents, readStoreProcessDiagnostics } from '../scripts/qa/disposable-store-diagnostics.mjs';
import { assertRetainedSourceFiles } from '../scripts/qa/retained-source-evidence.mjs';

const start = (name = 'com.android.vending', extra = '') =>
  `1792417576.123 1000 1021 I am_proc_start: [0,3456,10123,${name},service,private-hosting-field${extra}]`;
test('store diagnostics retain only bounded public process fields, not hosting payloads or other apps', () => {
  const output = start() + '\n' + start('another.application') + '\n' +
    '1792417577.123456 1000 1021 I am_proc_died: [0,3456,com.android.vending,20,0]';
  const result = parseStoreProcessEvents(output);
  assert.equal(result.length, 2);
  assert.deepEqual(result[0], { epochSeconds: 1792417576.123, event: 'am_proc_start', userId: 0,
    pid: 3456, processName: 'com.android.vending', hostingType: 'service' });
  assert.equal(result[1].event, 'am_proc_died'); assert(!JSON.stringify(result).includes('private-hosting-field'));
});
test('lookalike packages, another user, malformed fields and other event kinds are excluded', () => {
  for (const output of [start('com.android.vending.evil'), start().replace('[0,', '[10,'),
    start().replace('3456', 'not-a-pid'), start().replace('am_proc_start', 'am_wtf'),
    'private log line containing com.android.vending']) assert.deepEqual(parseStoreProcessEvents(output), []);
  assert.equal(parseStoreProcessEvents(start('com.android.vending:background')).length, 1);
});
test('untrusted hosting text and trailing fields never enter a receipt', () => {
  const result = parseStoreProcessEvents(start().replace(',service,', ',secret=do-not-retain,'));
  assert.equal(result.length, 1); assert.equal(result[0].hostingType, undefined);
  assert(!JSON.stringify(result).includes('secret'));
});
test('process history is bounded and unavailable observations never invent a successful read', () => {
  assert.equal(parseStoreProcessEvents(Array(40).fill(start()).join('\n')).length, 30);
  assert.throws(() => parseStoreProcessEvents('x'.repeat(65_537)));
  assert.throws(() => parseStoreProcessEvents(null));
  for (const shell of [() => { throw Error('credential-do-not-retain'); }, () => 'x'.repeat(65_537)]) {
    const result = readStoreProcessDiagnostics(shell); assert.equal(result.status, 'unavailable');
    assert.deepEqual(result.events, []); assert(!JSON.stringify(result).includes('credential'));
  }
});
test('the diagnostic performs only one bounded read, without clearing logs, restarting a process or retrying', () => {
  const calls = [], result = readStoreProcessDiagnostics((...args) => { calls.push(args); return start(); });
  assert.equal(result.status, 'observed'); assert.equal(result.events.length, 1);
  assert.deepEqual(calls, [['logcat', '-b', 'events', '-d', '-v', 'epoch', '-t', '100', '-s', 'am_proc_start:I', 'am_proc_died:I']]);
  assert.equal(result.scope, 'bounded-public-store-process-events-not-restart-cause-proof');
});
test('the original preparation failure and unknown restoration remain unaccepted after adding diagnostics', () => {
  const base = '../docs/release/evidence/store-pause-preparation-failure-2026-10-19/';
  const read = (file) => readFileSync(new URL(base + file, import.meta.url));
  const report = JSON.parse(read('results.json'));
  assert.equal(report.sourceCommit, '707dd744cf31c4678e0c4792339148414cac56a8');
  assert.equal(report.scope, 'failed-device-preparation-before-app-not-flow-evidence');
  assert.equal(report.buildPassed, true); assert.equal(report.setupPassed, false); assert.equal(report.flowTestsExecuted, 0);
  for (const key of ['ordinaryUiSuiteAccepted', 'emergencyPhoneAccepted', 'observedStoreStateRetained',
    'restartCauseProven', 'newDiagnosticsIncluded']) assert.equal(report[key], false);
  assert.equal(report.restorationOutcome, 'unreported-not-proven-failed-or-successful');
  assertRetainedSourceFiles(fileURLToPath(new URL('../', import.meta.url)), report.sourceFiles);
  assert.deepEqual(JSON.parse(read('disposable-device-setup.json')), {
    scope: 'failed-disposable-device-setup-not-flow-proof', serial: 'emulator-5554', storeCleanup: null, adminCleanup: null });
  assert.equal(JSON.parse(read('native-build-status.json')).status, 0);
  assert(read('job-error-excerpt.txt').includes('Store pause was not applied'));
  for (const [file, expected] of Object.entries(JSON.parse(read('artifact-sha256.json'))))
    assert.equal(createHash('sha256').update(read(file)).digest('hex'), expected);
  for (const name of ['native-ci.yml', 'web-integration-smoke.yml'])
    assert(readFileSync(new URL('../.github/workflows/' + name, import.meta.url), 'utf8').includes('tests/disposable-store-diagnostics.test.mjs'));
});
