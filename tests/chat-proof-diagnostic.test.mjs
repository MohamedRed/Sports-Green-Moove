import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {mkdtempSync, readFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import test from 'node:test';
import {parse} from 'yaml';
import {assertExactPixelFrames} from '../scripts/lib/exact-pixel-frames.mjs';
import {sampleProofResources} from '../scripts/diagnostics/ci-proof-resources.mjs';
import {probeProofMedia, proofImages} from '../scripts/diagnostics/chat-proof-media-probe.mjs';
import {chatProofCommands, runChatProofDiagnostic} from '../scripts/diagnostics/run-chat-proof-diagnostic.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
test('full-size pixel differences are rejected with a bounded diagnostic, not a huge array diff', () => {
  const frame = Buffer.alloc(274 * 618 * 3, 20), changed = Buffer.from(frame); changed[frame.length - 1] = 21;
  assert.doesNotThrow(() => assertExactPixelFrames(frame, Buffer.from(frame), frame.length));
  assert.throws(() => assertExactPixelFrames(frame, changed, frame.length), error => {
    assert(error.message.length < 350); assert.match(error.message, /firstDifferentByte":507995/);
    assert.match(error.message, /actualSha256/); assert.match(error.message, /expectedSha256/); return true;
  });
  for (const [actual, expected, length] of [[frame.subarray(1), frame, frame.length],
    [frame, frame.subarray(1), frame.length], [frame, frame, 0], [[], frame, frame.length]])
    assert.throws(() => assertExactPixelFrames(actual, expected, length));
});
test('host samples retain only explicit memory counters, never raw files or arbitrary fields', () => {
  const paths = [], sample = sampleProofResources({platform: 'linux', now: () => 'fixed', read: path => {
    paths.push(path);
    if (path === '/proc/meminfo') return 'MemTotal: 100 kB\nMemAvailable: 50 kB\nprivate: 99 kB\nsecret';
    if (path.endsWith('events')) return 'oom 2\noom_kill 1\nprivate 123\nsecret';
    return path.endsWith('max') ? 'max\n' : '4096\n';
  }});
  assert.equal(paths.length, 5);
  assert.deepEqual(sample.resources.hostMemoryBytes, {MemTotal: 102400, MemAvailable: 51200});
  assert.deepEqual(sample.resources.cgroupMemoryEvents, {oom: 2, oom_kill: 1});
  assert.equal(sample.resources.cgroupMemoryMax, 'max'); assert.deepEqual(sample.unavailable, []);
  assert.doesNotMatch(JSON.stringify(sample), /private|secret|\/proc|\/sys/);
});
test('unsupported and unavailable counters are explicit, without an alternate collection route', () => {
  assert.deepEqual(sampleProofResources({platform: 'darwin', read: () => assert.fail(), now: () => 'fixed'}).resources, {});
  const sample = sampleProofResources({platform: 'linux', read: () => {throw new Error('private data');}});
  assert.equal(sample.unavailable.length, 5); assert.deepEqual(sample.resources, {});
  assert.doesNotMatch(JSON.stringify(sample), /private data/);
});
test('the media probe delegates to the exact portable verifier once without alternate decoding', () => {
  let calls = 0; const events = [], expected = {captures: 3, exactRgbaPixels: true, releaseAccepted: false};
  const result = probeProofMedia(root, {emit: row => events.push(row), verify: selected => {
    assert.equal(selected, root); calls++; return expected;
  }});
  assert.equal(calls, 1); assert.deepEqual(result, expected);
  assert.deepEqual(events[0], {phase: 'portable-crop-validation-start', images: proofImages});
  assert.deepEqual(events[1], {phase: 'portable-crop-validation-complete', ...expected});
});
for (const kind of ['truncated', 'changed', 'decoder-error']) test('pixel comparison fails closed: ' + kind, () => {
  let calls = 0;
  assert.throws(() => probeProofMedia(root, {emit() {}, verify: () => {calls++; throw new Error(kind);}}), new RegExp(kind));
  assert.equal(calls, 1, 'No alternate decoder or retry after verification fails');
});
for (const failure of [null, 'nonzero', 'signal', 'launch']) test('diagnostic retains exact outcomes without replacing smoke: ' + failure, async t => {
  const folder = mkdtempSync(join(tmpdir(), 'sgm-chat-proof-test-')); t.after(() => rmSync(folder, {recursive: true, force: true}));
  const calls = [], output = join(folder, 'result');
  const result = await runChatProofDiagnostic(output, {root, sample: () => ({only: 'allowlisted-unit-sample'}),
    launch: (command, args, options) => {
      assert.equal(command, process.execPath); assert.deepEqual(options, {cwd: root, stdio: 'inherit'});
      calls.push(args); const child = new EventEmitter(); child.kill = () => assert.fail('No diagnostic kill or retry');
      setImmediate(() => {
        if (failure === 'launch') child.emit('error', new Error('private launcher detail'));
        else child.emit('exit', failure === 'signal' ? null : failure === 'nonzero' ? 7 : 0,
          failure === 'signal' ? 'SIGKILL' : null);
      }); return child;
    }});
  assert.equal(result.diagnosticPassed, failure === null); assert.equal(calls.length, failure ? 1 : 2);
  assert.deepEqual(calls, chatProofCommands.slice(0, failure ? 1 : 2));
  for (const flag of ['primaryGateAccepted', 'physicalFlowAccepted', 'rootCauseProven', 'releaseAccepted']) assert.equal(result[flag], false);
  assert.deepEqual(JSON.parse(readFileSync(join(output, 'result.json'))), result);
  assert.doesNotMatch(readFileSync(join(output, 'result.json'), 'utf8'), /private launcher detail/);
  assert(readFileSync(join(output, 'resources.jsonl'), 'utf8').trim().split('\n').length >= 3);
  await assert.rejects(runChatProofDiagnostic(output));
});
test('cancellation is forwarded only to the owned child and cannot become a diagnostic pass', async t => {
  const folder = mkdtempSync(join(tmpdir(), 'sgm-chat-proof-cancel-')); t.after(() => rmSync(folder, {recursive: true, force: true}));
  const before = process.listeners('SIGTERM'), signals = [];
  const result = await runChatProofDiagnostic(join(folder, 'result'), {sample: () => ({}), launch: () => {
    const child = new EventEmitter();
    child.kill = signal => {signals.push(signal); child.emit('exit', null, signal);};
    setImmediate(() => {
      const owned = process.listeners('SIGTERM').filter(listener => !before.includes(listener));
      assert.equal(owned.length, 1); owned[0]();
    }); return child;
  }});
  assert.deepEqual(signals, ['SIGTERM']); assert.equal(result.cancellationSignal, 'SIGTERM');
  assert.equal(result.diagnosticPassed, false); assert.equal(result.phases.length, 1);
  assert.deepEqual(process.listeners('SIGTERM'), before);
});
test('workflow uses the same runner, Node and tests, no credentials, emulators, retries or permissive gates', () => {
  const diagnostic = parse(readFileSync(join(root, '.github/workflows/chat-proof-diagnostic.yml'), 'utf8'));
  const smoke = parse(readFileSync(join(root, '.github/workflows/web-integration-smoke.yml'), 'utf8'));
  assert.equal(diagnostic.jobs.proof['runs-on'], smoke.jobs.smoke['runs-on']);
  assert.deepEqual(diagnostic.permissions, {contents: 'read'});
  assert.equal(diagnostic.jobs.proof.steps[0].with['persist-credentials'], false);
  assert.equal(diagnostic.jobs.proof.steps[1].with['node-version'], '22');
  const primary = smoke.jobs.smoke.steps.find(row => row.name === 'Test post-commit chat confirmation loss guards');
  assert.equal(primary.run, 'node ' + chatProofCommands[1].join(' '));
  for (const step of diagnostic.jobs.proof.steps) {
    assert.notEqual(step['continue-on-error'], true);
    assert.doesNotMatch(JSON.stringify(step), /secrets\.|emulator|retry|kill-server|--test-name-pattern/);
  }
  for (const event of ['push', 'pull_request']) assert(smoke.on[event].paths.includes('tests/chat-proof-diagnostic.test.mjs'));
  assert(smoke.jobs.smoke.steps.some(row => row.run === 'node --test tests/chat-proof-diagnostic.test.mjs tests/chat-proof-rgb-normalization.test.mjs'));
});
