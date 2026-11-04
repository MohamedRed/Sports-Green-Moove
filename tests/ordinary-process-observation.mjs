import assert from 'node:assert/strict';
import test from 'node:test';
import {spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {ordinaryProcessObservation, requireOrdinaryInstrumentation} from '../scripts/qa/ordinary-process-observation.mjs';
import {parseAndroidJUnitTranscript} from '../scripts/qa/android-junit-transcript.mjs';
import {parseDocument} from 'yaml';
import './ordinary-cutoff-evidence.mjs';

const observe = result => ordinaryProcessObservation(result, {elapsedMs: 1234, stderr: ''});

test('a successful host command is recorded without accepting its test inventory or a flow', () => {
  assert.deepEqual(observe({status: 0, signal: null}), {
    scope: 'single-ordinary-instrumentation-command-not-flow-proof', status: 0, signal: null,
    errorCode: null, elapsedMs: 1234, stderr: '',
  });
  assert.throws(() => parseAndroidJUnitTranscript(''));
});

for (const code of ['ETIMEDOUT', 'ENOBUFS', 'ENOENT', 'EACCES', 'EINVAL', 'EAGAIN', 'EMFILE', 'ENFILE', 'EIO', 'ENOMEM']) {
  test(`records the exact ${code} host error without its message, command arguments or environment`, () => {
    const value = observe({status: null, signal: 'SIGTERM', error: {
      code, message: 'secret error body', path: 'secret path', spawnargs: ['secret argument'],
    }, stdout: 'secret stdout', output: ['secret output'], env: {secret: 'secret value'}});
    assert.equal(value.errorCode, code); assert.equal(value.status, null); assert.equal(value.signal, 'SIGTERM');
    assert.doesNotMatch(JSON.stringify(value), /secret/);
  });
}

test('an unrecognized error code is withheld but never represented as no error', () => {
  for (const code of ['Bearer secret-value', undefined, null, 123]) {
    const value = observe({status: null, signal: null, error: {code}});
    assert.equal(value.errorCode, 'UNCLASSIFIED_PROCESS_ERROR');
    assert.doesNotMatch(JSON.stringify(value), /secret-value/);
  }
});

test('a nonzero exit and an external termination retain their status without inventing a timeout', () => {
  assert.deepEqual(observe({status: 9, signal: null}), {
    scope: 'single-ordinary-instrumentation-command-not-flow-proof', status: 9, signal: null,
    errorCode: null, elapsedMs: 1234, stderr: '',
  });
  assert.equal(observe({status: null, signal: 'SIGKILL'}).errorCode, null);
});

test('a real local host timeout retains ETIMEDOUT; no Android device or network is used', () => {
  const start = performance.now();
  const result = spawnSync(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], {
    timeout: 200, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
  });
  const receipt = ordinaryProcessObservation(result, {elapsedMs: Math.round(performance.now() - start), stderr: ''});
  assert.equal(receipt.status, null); assert.equal(receipt.signal, 'SIGTERM'); assert.equal(receipt.errorCode, 'ETIMEDOUT');
  assert(receipt.elapsedMs >= 200); assert.throws(() => parseAndroidJUnitTranscript(result.stdout));
});

test('a real bounded-output failure retains ENOBUFS rather than being mislabeled as a timeout', () => {
  const start = performance.now();
  const result = spawnSync(process.execPath, ['-e', "process.stdout.write('x'.repeat(1024 * 1024))"], {
    timeout: 5000, maxBuffer: 1024, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
  });
  const receipt = ordinaryProcessObservation(result, {elapsedMs: Math.round(performance.now() - start), stderr: ''});
  assert.equal(receipt.errorCode, 'ENOBUFS');
  assert(!Object.hasOwn(receipt, 'stdout')); assert.throws(() => parseAndroidJUnitTranscript(result.stdout));
});

test('elapsed time rejects invalid observations instead of emitting a misleading duration', () => {
  for (const elapsedMs of [-1, NaN, Infinity, 0.5]) {
    assert.throws(() => ordinaryProcessObservation({status: 0, signal: null}, {elapsedMs, stderr: ''}));
  }
});

for (const [name, result, transcript] of [
  ['host timeout', {status: null, signal: 'SIGTERM', error: {code: 'ETIMEDOUT'}}, ''],
  ['nonzero exit', {status: 1, signal: null}, ''],
  ['external signal', {status: 0, signal: 'SIGTERM'}, ''],
  ['host error', {status: 0, signal: null, error: {code: 'ENOBUFS'}}, ''],
  ['incomplete transcript', {status: 0, signal: null}, ''],
]) test(`${name} collects existing observations once and preserves the same failure`, t => {
  for (const diagnosticThrows of [false, true]) {
    let observed, calls = 0;
    const warn = t.mock.method(console, 'warn', () => {});
    assert.throws(() => requireOrdinaryInstrumentation(result, transcript, failure => {
      observed = failure; calls++;
      if (diagnosticThrows) throw new Error('private diagnostic exception');
      return {ok: true};
    }), failure => failure === observed && failure.code === 'ERR_ASSERTION');
    assert.equal(calls, 1);
    assert.equal(warn.mock.calls.length, diagnosticThrows ? 1 : 0);
    if (diagnosticThrows) assert.doesNotMatch(warn.mock.calls[0].arguments.join(' '), /private/);
    warn.mock.restore();
  }
});

test('a complete passing or failing transcript does not invoke the pre-report failure observer', () => {
  const packet = code => 'INSTRUMENTATION_STATUS: class=be.sportgreenmoove.app.ui.ExampleTest\n' +
    'INSTRUMENTATION_STATUS: test=example\nINSTRUMENTATION_STATUS: current=1\n' +
    `INSTRUMENTATION_STATUS: numtests=1\nINSTRUMENTATION_STATUS_CODE: ${code}\n`;
  for (const code of [0, -2]) {
    const transcript = 'INSTRUMENTATION_STATUS: sgm_installations_blocked=true\nINSTRUMENTATION_STATUS_CODE: 0\n' +
      packet(1) + packet(code) + (code === 0 ? 'OK (1 test)\n' : 'FAILURES!!!\n') + 'INSTRUMENTATION_CODE: -1\n';
    const report = requireOrdinaryInstrumentation({status: 0, signal: null}, transcript, () => assert.fail('Unexpected observation'));
    assert.equal(report.complete, true); assert.equal(report.failed, code === 0 ? 0 : 1);
  }
});

test('the runner keeps every test, deadline, buffer, assertion, redaction and original receipt write boundary', () => {
  const source = readFileSync(new URL('../scripts/qa/run-ordinary-android-ui.mjs', import.meta.url), 'utf8');
  assert(source.includes('ordinaryProcessObservation(result, {elapsedMs, stderr})'));
  assert(source.includes('timeout: 12 * 60_000, maxBuffer: 16 * 1024 * 1024'));
  assert(source.includes("'-e', 'timeout_msec', '240000'"));
  assert(source.includes('const transcript = redact(result.stdout), stderr = redact(result.stderr)'));
  assert(source.indexOf('ordinaryProcessObservation(result, {elapsedMs, stderr})') < source.indexOf('requireOrdinaryInstrumentation(result, transcript'));
  const validation = readFileSync(new URL('../scripts/qa/ordinary-process-observation.mjs', import.meta.url), 'utf8');
  assert(validation.indexOf('assert.equal(result.status, 0') < validation.indexOf('parseAndroidJUnitTranscript(transcript)'));
  assert(validation.includes('assert.equal(result.signal, null); assert(!result.error)'));
  assert(source.includes('if (process.env.SGM_PRIMARY_CAPTURE_DIAGNOSTICS === \'true\')\n    collectPrimaryCaptureDiagnostics({adb, serial: device.serial, directory, ordinaryPassed: false})'));
  assert(source.includes('report.passed > 0 && report.failed === 0'));
  assert(source.includes("{ mode: 0o600, flag: 'wx' }"));
  assert(!source.includes('INSTRUMENTATION_PROCESS_ERROR'));
  assert.equal(source.match(/spawnSync\(adb/g).length, 1);
  for (const name of ['native-ci.yml', 'web-integration-smoke.yml']) {
    const workflow = parseDocument(readFileSync(new URL('../.github/workflows/' + name, import.meta.url), 'utf8')).toJSON();
    for (const event of ['push', 'pull_request']) assert(workflow.on[event].paths.includes('tests/ordinary-process-observation.mjs'));
    assert(Object.values(workflow.jobs).some(job => (job.steps ?? []).some(s => s.run?.includes('node --test tests/android-junit-transcript.test.mjs'))));
  }
});
