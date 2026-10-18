import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { collectAdbSyncFailureDiagnostics, listingSummary, summarizeDirectoryStat, summarizeSyncListing } from '../scripts/qa/adb-sync-failure-diagnostics.mjs';
import { createHash } from 'node:crypto';
import { XMLParser } from 'fast-xml-parser';
import { assertInstrumentationPassed } from '../scripts/qa/android-instrumentation-result.mjs';

const runId = 'a'.repeat(32), password = 'isolated-qa-password-not-a-real-credential';
const repositoryRoot = fileURLToPath(new URL('../', import.meta.url));
const readRepoFile = (path) => readFileSync(resolve(repositoryRoot, path));
function fixture(t) {
  const directory = mkdtempSync(join(tmpdir(), 'sgm-sync-diagnostic-'));
  const previous = process.env.SGM_LOCAL_DISPOSABLE_EMULATOR;
  process.env.SGM_LOCAL_DISPOSABLE_EMULATOR = 'true';
  t.after(() => {
    rmSync(directory, { recursive: true, force: true });
    if (previous === undefined) delete process.env.SGM_LOCAL_DISPOSABLE_EMULATOR; else process.env.SGM_LOCAL_DISPOSABLE_EMULATOR = previous;
  });
  return { adb: '/sdk/adb', serial: 'emulator-5554', runId, evidenceDir: directory, phase: 'network-recovery', password };
}

test('file-list metadata records counts and invalid-name shape without copying names or file contents', () => {
  assert.deepEqual(summarizeSyncListing('000081b0 0000000000000100 0000000067abcd00 local-screen.png\n000081b0 00000002 67abcd00 local-state.json\n'),
    { entryCount: 2, maxNameBytes: 16, namesAreSimple: true, pngCount: 1, jsonCount: 1 });
  const summary = listingSummary(['private@example.test', 'private/file', 'a'.repeat(256)]);
  assert.equal(summary.namesAreSimple, false); assert.equal(summary.maxNameBytes, 256);
  assert(!JSON.stringify(summary).includes('private'));
  assert.throws(() => summarizeSyncListing('permission denied: private path'));
  assert.deepEqual(summarizeDirectoryStat('770,10211,1079,4096,1792337030\n'),
    { mode: '770', uid: 10211, gid: 1079, bytes: 4096, modifiedAtSeconds: 1792337030 });
  assert.throws(() => summarizeDirectoryStat('private error output'));
  assert.throws(() => summarizeDirectoryStat('770,1,1,9999999999999999,1792337030'));
  assert.equal(summarizeSyncListing('000041ed 00000000 67abcd00 .\n000041ed 00000000 67abcd00 ..\n').entryCount, 0);
});

test('a failed primary transfer gets only bounded read-only observations and no retry or raw file listing', (t) => {
  const input = fixture(t), calls = [];
  const result = collectAdbSyncFailureDiagnostics(input, (adb, args, options) => {
    assert.equal(adb, '/sdk/adb'); calls.push(args);
    assert.equal(options.timeout, 5_000); assert.equal(options.maxBuffer, 256 * 1024);
    assert.deepEqual(options.stdio, ['ignore', 'pipe', 'pipe']);
    if (args.includes('stat')) {
      assert(args.includes('%a,%u,%g,%s,%Y'));
      assert(!args.some((arg) => /[|;&]/.test(arg)));
      return '770,10211,1079,4096,1792337030';
    }
    if (args[2] === 'ls') return '000081b0 00000002 67abcd00 local-state.json\n';
    if (args.includes('ls')) return 'local-state.json\nlocal-screen.png\n';
    return `adbd diagnostic ${password} Bearer private/token+= eyJhead.payload.signature`;
  });
  assert.equal(calls.length, 4); assert(!calls.flat().includes('pull'));
  assert(!calls.flat().some((arg) => /force-stop|kill-server|reconnect|chmod|rm|run-as/.test(arg)));
  assert.equal(result.observations.length, 4); assert(result.observations.every((item) => item.collected));
  const stored = readFileSync(join(input.evidenceDir, 'adb-sync-network-recovery-diagnostics.json'), 'utf8');
  assert(!stored.includes(password)); assert(!stored.includes('private/token')); assert(!stored.includes('eyJhead'));
  assert(!stored.includes('local-screen.png')); assert(stored.includes('not-copy-or-flow-verification'));
});

test('failed or malformed diagnostic reads are explicit and do not suppress remaining queries or expose child output', (t) => {
  const input = fixture(t); let calls = 0;
  const result = collectAdbSyncFailureDiagnostics(input, () => {
    if (++calls === 1) throw Object.assign(new Error(password), { status: 1, code: 'ETIMEDOUT', stdout: password });
    if (calls === 2) return 'local-screen.png';
    if (calls === 3) return 'not a file-sync listing';
    return 'bounded service log';
  });
  assert.equal(calls, 4);
  assert.deepEqual(result.observations[0], { id: 'directory-stat', collected: false, status: 1, errorCode: 'ETIMEDOUT' });
  assert.equal(result.observations[2].collected, false); assert.equal(result.observations[3].collected, true);
  assert(!JSON.stringify(result).includes(password));
});

test('physical, non-disposable and malformed identity cannot execute diagnostics', (t) => {
  const input = fixture(t); let calls = 0;
  for (const extra of [{ serial: 'physical' }, { runId: 'bad' }, { phase: '../escape' }, { evidenceDir: 'relative' }, { password: 'short' }])
    assert.throws(() => collectAdbSyncFailureDiagnostics({ ...input, ...extra }, () => { calls++; }));
  process.env.SGM_LOCAL_DISPOSABLE_EMULATOR = 'false';
  assert.throws(() => collectAdbSyncFailureDiagnostics(input, () => { calls++; }));
  assert.equal(calls, 0);
});

test('a retained named diagnostic cannot be repeated or overwrite its original observations', (t) => {
  const input = fixture(t); let calls = 0;
  const execute = () => { calls++; throw new Error('read unavailable'); };
  collectAdbSyncFailureDiagnostics(input, execute);
  const path = join(input.evidenceDir, 'adb-sync-network-recovery-diagnostics.json');
  const before = readFileSync(path);
  assert.throws(() => collectAdbSyncFailureDiagnostics(input, execute), /cannot be repeated/);
  assert.equal(calls, 4); assert.deepEqual(readFileSync(path), before);
});

test('passing ordinary tests and a later cleanup transfer cannot repair the retained failed primary copy', () => {
  const read = readRepoFile;
  const base = 'docs/release/evidence/native-transfer-interruption-2026-10-18/';
  const hashes = JSON.parse(read(base + 'artifact-sha256.json'));
  for (const [name, hash] of Object.entries(hashes)) assert.equal(createHash('sha256').update(read(base + name)).digest('hex'), hash, name);
  const xml = read(base + 'general-ui.xml');
  assert.equal(createHash('sha256').update(xml).digest('hex'), '6360cd164a5104e08138994717603b0d299efbd2387ff3516ee261f8e60eaad9');
  const suite = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '', parseAttributeValue: true,
    isArray: (name) => name === 'testcase' }).parse(xml).testsuite;
  assert.equal(suite.tests, 124); assert.equal(suite.failures, 0); assert.equal(suite.errors, 0); assert.equal(suite.skipped, 31);
  assert.equal(suite.testcase.filter((item) => !Object.hasOwn(item, 'skipped')).length, 93);
  const json = (name) => JSON.parse(read(base + name));
  const first = json('adb-pull-trip-change-parent-confirmation.json'), cleanup = json('adb-pull-failure-cleanup.json');
  assert.equal(first.runId, 'e9602ca81b23d6e4697306ba329803ae'); assert.equal(cleanup.runId, first.runId);
  assert.equal(first.status, 1); assert.equal(first.signal, null); assert.equal(first.completed, false);
  assert.match(first.stderr, /building file list/); assert.equal(cleanup.completed, true);
  assert.match(cleanup.stderr, /52 files pulled/);
  assertInstrumentationPassed(read(base + 'LocalTripChangeFlowTest-instrumentation.txt').toString(), 1);
  assert.equal(json('local-trip-change-ui.json').runId, first.runId);
  assert.equal(json('disposable-store-restore.json').verified, true);
  assert.deepEqual(json('native-suite-status.json'), { scope: 'native-suite-exit-status-not-flow-verification',
    ordinaryTests: 0, componentEvidence: 0, localReplay: 1 });
  for (const name of ['results.json', 'trip-change-ui-stage.json']) assert.equal(existsSync(resolve(repositoryRoot, base, name)), false);
});

test('both CI paths cover failure-only diagnostics and keep success/replay outcomes independent', () => {
  const read = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
  const native = read('.github/workflows/native-ci.yml'), smoke = read('.github/workflows/web-integration-smoke.yml');
  assert.equal(native.split('"tests/*failure*.test.mjs"').length - 1, 2);
  assert(native.includes(' tests/adb-sync-failure-diagnostics.test.mjs'));
  assert.equal(smoke.split('"tests/adb-sync-failure-diagnostics.test.mjs"').length - 1, 2);
  assert(smoke.includes('run: node --test tests/adb-sync-failure-diagnostics.test.mjs'));
  const collector = read('scripts/qa/collect-local-ui-evidence.mjs');
  assert(collector.indexOf('collectAdbSyncFailureDiagnostics({') > collector.indexOf('if (!receipt.completed)'));
  assert(collector.includes('throw new EvidenceCollectionError(phase, status, signal, receiptPath)'));
  assert.equal((collector.match(/spawn\(adb,/g) ?? []).length, 1);
});

test('a later complete matrix retains independently successful primary copies and original device transcripts', () => {
  const read = readRepoFile;
  const base = 'docs/release/evidence/native-replay-completed-2026-10-18/';
  const hashes = JSON.parse(read(base + 'artifact-sha256.json'));
  assert.equal(Object.keys(hashes).length, 43);
  for (const [name, expected] of Object.entries(hashes)) assert.equal(createHash('sha256').update(read(base + name)).digest('hex'), expected, name);
  const result = JSON.parse(read(base + 'results.json'));
  assert.equal(result.runId, 'a3a5f34d7657adbba4973414bc4f9663');
  assert.equal(result.testCount, 33); assert.equal(result.nativeCaseCount, 35); assert.equal(result.steps.length, 33);
  assert(result.steps.every((item) => item.status === 'passed'));
  const transcripts = Object.keys(hashes).filter((name) => name.endsWith('-instrumentation.txt'));
  assert.equal(transcripts.length, 27);
  for (const name of transcripts) assertInstrumentationPassed(read(base + name).toString(), name.startsWith('LocalAppFlowTest-') ? 9 : 1);
  const receipts = Object.keys(hashes).filter((name) => name.startsWith('adb-pull-'));
  assert.equal(receipts.length, 12); assert(receipts.every((name) => !name.includes('cleanup')));
  for (const name of receipts) {
    const receipt = JSON.parse(read(base + name));
    assert.equal(receipt.runId, result.runId); assert.equal(receipt.status, 0); assert.equal(receipt.completed, true);
  }
  const suite = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '', parseAttributeValue: true }).parse(read(base + 'general-ui.xml')).testsuite;
  assert.equal(suite.tests, 124); assert.equal(suite.failures, 0); assert.equal(suite.errors, 0); assert.equal(suite.skipped, 31);
  assert.deepEqual(JSON.parse(read(base + 'native-suite-status.json')), {
    scope: 'native-suite-exit-status-not-flow-verification', ordinaryTests: 0, componentEvidence: 0, localReplay: 0,
  });
  assert.equal(JSON.parse(read(base + 'disposable-store-restore.json')).verified, true);
});
