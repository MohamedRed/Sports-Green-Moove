import assert from 'node:assert/strict';
import {cpSync, mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {tmpdir} from 'node:os';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import test from 'node:test';
import {parseDocument} from 'yaml';
import {assertTransferEmulatorIdentity, observeTransferEmulator} from '../scripts/diagnostics/adb-transfer-emulator.mjs';
import {transferLifecycleFolder, validateTransferLifecycle} from '../scripts/qa/transfer-lifecycle-evidence.mjs';
import {content} from '../partner-portal/content.mjs';

const identity = {pid: 80, startedTicks: '123456', executable: 'qemu-system-x86_64-headless', port: 5554, avd: 'test'};
const statLine = (ticks = identity.startedTicks, state = 'S') => `80 (private process name) ${[state, 1, ...Array(17).fill(0), ticks].join(' ')}`;
const header = 'sl local_address rem_address st tx_queue rx_queue tr tm->when retrnsmt uid timeout inode';
function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'sgm-transfer-emulator-')), uid = process.getuid();
  t.after(() => rmSync(root, {recursive: true, force: true}));
  for (const directory of ['80/fd', '80/ns', 'self/ns', 'net']) mkdirSync(join(root, directory), {recursive: true});
  writeFileSync(join(root, '80/stat'), statLine());
  symlinkSync('/private/sdk/' + identity.executable, join(root, '80/exe'));
  symlinkSync('net:[99]', join(root, '80/ns/net')); symlinkSync('net:[99]', join(root, 'self/ns/net'));
  const row = (local, remote, inode) => `0: ${local} ${remote} 01 0:0 0:0 0 ${uid} 0 ${inode} 1`;
  writeFileSync(join(root, 'net/tcp'), [header, row('0100007F:15B3', '0100007F:BCDE', 11),
    row('0100007F:15B5', '0100007F:BCDD', 12), row('0100007F:15B3', '0100000A:01BB', 13)].join('\n'));
  writeFileSync(join(root, 'net/tcp6'), header + '\n');
  for (const [fd, inode] of [[1, 11], [2, 11], [3, 12], [4, 13]]) symlinkSync('socket:[' + inode + ']', join(root, '80/fd', String(fd)));
  symlinkSync('/private/secret-token', join(root, '80/fd/5'));
  writeFileSync(join(root, '80/cmdline'), 'DO_NOT_READ_ARGUMENTS'); writeFileSync(join(root, '80/environ'), 'DO_NOT_READ_ENVIRONMENT');
  const options = {root, platform: 'linux', uid};
  return {root, options, observe: () => observeTransferEmulator(identity, options)};
}
test('the exact process birth and owned device port are observed without retaining unrelated connections', t => {
  const f = fixture(t), result = f.observe();
  assert.equal(result.processState, 'present'); assert.equal(result.socketsObserved, true);
  assert.equal(result.connections.length, 1); assert.equal(result.connections[0].localPort, 5555);
  assert.deepEqual(result.identity, identity); assert.equal(result.atomicObservation, false);
  assert.equal(result.environmentRead, false); assert.equal(result.rawArgumentsRetained, false);
  assert.equal(result.deviceCommandsRequested, false);
  assert.doesNotMatch(JSON.stringify(result), /private|secret-token|0100000A|DO_NOT_READ|5557/);
});
test('the original process can stay present while its device connection is absent', t => {
  const f = fixture(t); writeFileSync(join(f.root, 'net/tcp'), header + '\n');
  const result = f.observe(); assert.equal(result.processState, 'present');
  assert.equal(result.socketsObserved, true); assert.deepEqual(result.connections, []);
});
test('a reused PID is not rebound to a replacement or read through its descriptors', t => {
  const f = fixture(t); writeFileSync(join(f.root, '80/stat'), statLine('987654'));
  rmSync(join(f.root, '80/fd'), {recursive: true});
  const result = f.observe(); assert.equal(result.processState, 'identity-changed');
  assert.equal(result.socketsObserved, false); assert.deepEqual(result.connections, []);
});
test('absence, zombie and malformed metadata remain different observations', t => {
  const f = fixture(t); writeFileSync(join(f.root, '80/stat'), statLine(identity.startedTicks, 'Z'));
  assert.equal(f.observe().processState, 'zombie');
  writeFileSync(join(f.root, '80/stat'), 'private malformed state'); assert.equal(f.observe().processState, 'unavailable');
  rmSync(join(f.root, '80/stat')); assert.equal(f.observe().processState, 'unavailable', 'Missing stat with a present PID directory is not process absence');
  rmSync(join(f.root, '80'), {recursive: true}); assert.equal(f.observe().processState, 'gone');
});
test('namespace mismatch or missing tables never establishes missing device sockets', t => {
  const f = fixture(t); rmSync(join(f.root, '80/ns/net')); symlinkSync('net:[100]', join(f.root, '80/ns/net'));
  assert.equal(f.observe().processState, 'present'); assert.equal(f.observe().socketsObserved, false);
  rmSync(join(f.root, '80/ns/net')); symlinkSync('net:[99]', join(f.root, '80/ns/net'));
  rmSync(join(f.root, 'net/tcp6')); assert.equal(f.observe().socketsObserved, false);
});
test('foreign process owners are not inspected as the bound test device', t => {
  const f = fixture(t), result = observeTransferEmulator(identity, {...f.options, uid: process.getuid() + 1});
  assert.equal(result.processState, 'unavailable'); assert.equal(result.socketsObserved, false);
});
test('unsupported hosts remain explicitly unobserved', () => {
  const result = observeTransferEmulator(identity, {platform: 'darwin'});
  assert.equal(result.unavailableReason, 'unsupported-host'); assert.equal(result.processState, 'unavailable');
});
test('invalid or expanded identities are rejected before process observation', () => {
  for (const value of [{...identity, extra: 'PRIVATE'}, {...identity, executable: 'node'}, {...identity, avd: 'personal'},
    {...identity, port: 5555}, {...identity, pid: 0}, {...identity, startedTicks: 'PRIVATE'}])
    assert.throws(() => assertTransferEmulatorIdentity(value, 'emulator-5554'));
});
test('the snapshot source cannot request a device command, process signal, argument or environment read', () => {
  const source = readFileSync(new URL('../scripts/diagnostics/adb-transfer-emulator.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /spawn\(|spawnSync|execFile|process\.kill|\.kill\(|fetch\(|['"]cmdline['"]|['"]environ['"]/);
});
test('both native and web gates run the new observations and watch their source and tests', () => {
  for (const name of ['native-ci', 'web-integration-smoke']) {
    const workflow = parseDocument(readFileSync(new URL('../.github/workflows/' + name + '.yml', import.meta.url), 'utf8')).toJSON();
    const steps = Object.values(workflow.jobs).flatMap(job => job.steps ?? []).filter(step => step.name === 'Test bound emulator transfer observations');
    assert.equal(steps.length, 1);
    assert.equal(steps[0].run, 'node --test tests/adb-transfer-probe.test.mjs tests/adb-transfer-emulator.test.mjs');
    assert.equal(steps[0].if, undefined); assert.equal(steps[0]['continue-on-error'], undefined);
    for (const event of ['push', 'pull_request']) {
      assert(workflow.on[event].paths.includes('scripts/diagnostics/adb-transfer-*.mjs'));
      assert(workflow.on[event].paths.includes('tests/adb-transfer*.test.mjs'));
    }
  }
});

const repositoryRoot = fileURLToPath(new URL('..', import.meta.url));
test('retained passing lifecycle observations do not repair the prior failure or pass the whole native gate', () => {
  assert.deepEqual(validateTransferLifecycle(repositoryRoot), {beforeTransferPasses: 24, candidateTransferPasses: 32,
    mainGroups: 37, fullNativeGateAccepted: false, releaseAccepted: false});
  assert.equal(content.updates.find(row => row.flow === 'messages').source, transferLifecycleFolder + 'README.md');
  for (const id of ['native-evidence-copy', 'chat-send-stability'])
    assert.equal(content.blockers.find(row => row.id === id).latestSource, transferLifecycleFolder + 'README.md');
});
test('recomputed evidence checksums cannot promote scope or pass counts', t => {
  const root = mkdtempSync(join(tmpdir(), 'sgm-transfer-lifecycle-'));
  t.after(() => rmSync(root, {recursive: true, force: true}));
  const folder = join(root, transferLifecycleFolder);
  cpSync(join(repositoryRoot, transferLifecycleFolder), folder, {recursive: true});
  const archive = join(root, 'docs/release/evidence/source-archive'); mkdirSync(dirname(archive), {recursive: true});
  symlinkSync(join(repositoryRoot, 'docs/release/evidence/source-archive'), archive);
  const prior = 'docs/release/evidence/native-timeout-9abc639-2026-10-30/following-main/results.json';
  mkdirSync(dirname(join(root, prior)), {recursive: true}); cpSync(join(repositoryRoot, prior), join(root, prior));
  validateTransferLifecycle(root);
  const original = JSON.parse(readFileSync(join(folder, 'review.json')));
  const hashes = JSON.parse(readFileSync(join(folder, 'artifact-sha256.json')));
  for (const [key, value] of [
    ...['candidateFailureReproduced', 'realFailureLifecycleDistinguished', 'nativeMainArchiveDigestVerified',
      'underlyingCauseConfirmed', 'earlierCopyFailureRepaired', 'passAttributedToObservation', 'retryAdded', 'deadlinesChanged',
      'productCodeChanged', 'fullNativeGateAccepted', 'physicalDeviceAccepted', 'productionWrites', 'releaseAccepted'].map(key => [key, true]),
    ['beforeTransferPasses', 25], ['candidateTransferPasses', 33], ['mainReplayGroups', 40],
  ]) {
    const bytes = JSON.stringify({...original, [key]: value}); writeFileSync(join(folder, 'review.json'), bytes);
    writeFileSync(join(folder, 'artifact-sha256.json'), JSON.stringify({...hashes,
      'review.json': createHash('sha256').update(bytes).digest('hex')}));
    assert.throws(() => validateTransferLifecycle(root), new RegExp(key));
  }
});
