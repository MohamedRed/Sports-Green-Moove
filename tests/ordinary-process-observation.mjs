import assert from 'node:assert/strict';
import test from 'node:test';
import {spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {ordinaryProcessObservation} from '../scripts/qa/ordinary-process-observation.mjs';
import {parseAndroidJUnitTranscript} from '../scripts/qa/android-junit-transcript.mjs';
import {parseDocument} from 'yaml';

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

test('the runner keeps every test, deadline, buffer, assertion, redaction and original receipt write boundary', () => {
  const source = readFileSync(new URL('../scripts/qa/run-ordinary-android-ui.mjs', import.meta.url), 'utf8');
  assert(source.includes('ordinaryProcessObservation(result, {elapsedMs, stderr})'));
  assert(source.includes('timeout: 12 * 60_000, maxBuffer: 16 * 1024 * 1024'));
  assert(source.includes("'-e', 'timeout_msec', '240000'"));
  assert(source.includes('const transcript = redact(result.stdout), stderr = redact(result.stderr)'));
  assert(source.indexOf('ordinaryProcessObservation(result, {elapsedMs, stderr})') < source.indexOf('assert.equal(result.status, 0'));
  assert(source.indexOf('assert.equal(result.status, 0') < source.indexOf('parseAndroidJUnitTranscript(transcript)'));
  assert(source.includes('assert.equal(result.signal, null); assert(!result.error)'));
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
