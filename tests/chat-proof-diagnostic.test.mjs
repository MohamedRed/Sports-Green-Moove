import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {mkdtempSync, readFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import test from 'node:test';
import {parse} from 'yaml';
import {assertExactRgbFrames} from './helpers/exact-rgb-frames.mjs';
import {sampleProofResources} from '../scripts/diagnostics/ci-proof-resources.mjs';
import {probeProofMedia, proofImages, proofMediaFolder} from '../scripts/diagnostics/chat-proof-media-probe.mjs';
import {chatProofCommands, runChatProofDiagnostic} from '../scripts/diagnostics/run-chat-proof-diagnostic.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
test('full-size pixel differences are rejected with a bounded diagnostic, not a huge array diff', () => {
  const frame = Buffer.alloc(274 * 618 * 3, 20), changed = Buffer.from(frame); changed[frame.length - 1] = 21;
  assert.doesNotThrow(() => assertExactRgbFrames(frame, Buffer.from(frame), frame.length));
  assert.throws(() => assertExactRgbFrames(frame, changed, frame.length), error => {
    assert(error.message.length < 350); assert.match(error.message, /firstDifferentByte":507995/);
    assert.match(error.message, /actualSha256/); assert.match(error.message, /expectedSha256/); return true;
  });
  for (const [actual, expected, length] of [[frame.subarray(1), frame, frame.length],
    [frame, frame.subarray(1), frame.length], [frame, frame, 0], [[], frame, frame.length]])
    assert.throws(() => assertExactRgbFrames(actual, expected, length));
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
test('the media probe exercises exactly six original decoder commands without changing threads or limits', () => {
  const calls = [], events = [], pixels = Buffer.alloc(274 * 618 * 3, 12);
  const result = probeProofMedia(root, {emit: row => events.push(row), execute: (command, args, options) => {
    calls.push({command, args, options}); return pixels;
  }});
  assert.equal(calls.length, 6); assert.equal(events.length, 12);
  for (const [index, call] of calls.entries()) {
    assert.equal(call.command, 'ffmpeg'); assert.deepEqual(call.options, {maxBuffer: 1_000_000});
    const input = (index % 2 === 1 ? 'original-session-captures/' : 'captures/') + proofImages[Math.floor(index / 2)] + '.png';
    assert.deepEqual(call.args, ['-hide_banner', '-loglevel', 'error', '-i', join(root, proofMediaFolder, input),
      ...(index % 2 === 1 ? ['-vf', 'crop=274:618:615:109:exact=1'] : []),
      '-frames:v', '1', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-']);
    assert.equal(call.args.includes('crop=274:618:615:109:exact=1'), index % 2 === 1);
    assert(!call.args.includes('-threads')); assert(!call.args.includes('-timeout'));
  }
  assert.deepEqual(result.comparisons.map(row => row.image), proofImages);
  assert.equal(result.physicalFlowAccepted, false); assert.equal(result.releaseAccepted, false);
});
for (const kind of ['truncated', 'changed', 'decoder-error']) test('pixel comparison fails closed: ' + kind, () => {
  let calls = 0;
  assert.throws(() => probeProofMedia(root, {emit() {}, execute: () => {
    calls++;
    if (kind === 'decoder-error') throw new Error('decoder failed');
    return Buffer.alloc(kind === 'truncated' ? 1 : 274 * 618 * 3, kind === 'changed' ? calls : 0);
  }}));
  assert(calls <= 2, 'Do not retry or move to another image after failure');
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
  assert(smoke.jobs.smoke.steps.some(row => row.run === 'node --test tests/chat-proof-diagnostic.test.mjs'));
});
