import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, symlinkSync, rmSync, cpSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { collectAdbHostHealth, summarizeAdbHost, summarizeAdbProcesses, observeAdbHostProcesses } from '../scripts/qa/adb-host-health.mjs';
import { observeAdbSockets, parseLocalTcpSockets } from '../scripts/qa/adb-host-sockets.mjs';
import { validateNativeCopyDisconnect } from '../scripts/qa/native-copy-disconnect-evidence.mjs';

const tcpHeader = '  sl local_address rem_address st tx_queue rx_queue tr tm->when retrnsmt uid timeout inode';
test('the terminal copy failure retains the observed disconnect without inventing a server identity or successful gate', () => {
  validateNativeCopyDisconnect(resolve(import.meta.dirname, '..'));
});
test('rehashed historical receipts cannot promote cleanup or later instrumentation into a successful original gate', () => {
  const root = resolve(import.meta.dirname, '..'), temp = mkdtempSync(resolve(tmpdir(), 'sgm-copy-history-'));
  const folder = 'docs/release/evidence/native-copy-disconnect-2026-10-26';
  try {
    cpSync(resolve(root, folder), resolve(temp, folder), { recursive: true });
    for (const [file, change] of [['run.json', value => value.conclusion = 'success'],
      ['native-suite-status.json', value => value.localReplay = 0],
      ['primary-copy.json', value => value.completed = true],
      ['primary-copy.json', value => value.hostBefore.socketOwnership = { completed: true }],
      ['ordinary-results.json', value => value.failed = 1]]) {
      const original = readFileSync(resolve(root, folder, file)), value = JSON.parse(original); change(value);
      const bytes = JSON.stringify(value); writeFileSync(resolve(temp, folder, file), bytes);
      const hashes = JSON.parse(readFileSync(resolve(root, folder, 'artifact-sha256.json')));
      hashes[file] = createHash('sha256').update(bytes).digest('hex');
      writeFileSync(resolve(temp, folder, 'artifact-sha256.json'), JSON.stringify(hashes));
      assert.throws(() => validateNativeCopyDisconnect(temp)); writeFileSync(resolve(temp, folder, file), original);
    }
  } finally { rmSync(temp, { recursive: true, force: true }); }
});
const tcpRow = (local, remote, state, uid, inode) =>
  `0: ${local} ${remote} ${state} 00000000:00000000 00:00000000 00000000 ${uid} 0 ${inode} 1`;

test('socket parser selects same-user loopback metadata and never retains external addresses', () => {
  const rows = [tcpRow('0100007F:13AD', '00000000:0000', '0A', 1001, 11),
    tcpRow('0100007F:A35A', '0100007F:15B3', '01', 1001, 12),
    tcpRow('0100007F:A35B', '0100007F:13AD', '01', 1001, 13),
    tcpRow('0100007F:A35C', '0100000A:01BB', '01', 1001, 14),
    tcpRow('0100007F:A35D', '0100007F:13AD', '01', 1002, 15)];
  const result = parseLocalTcpSockets([tcpHeader, ...rows].join('\n'), 1001);
  assert.equal(result.length, 3); assert.equal(result[0].localPort, 5037); assert.equal(result[0].listening, true);
  assert.equal(result[1].remotePort, 5555); assert.equal(result[2].remotePort, 5037);
  assert.doesNotMatch(JSON.stringify(result), /0100000A|1002|A35[ABCD]/);
  assert.equal(parseLocalTcpSockets(tcpHeader + '\n', 1001).length, 0);
  for (const value of ['secret', tcpHeader + '\nmalformed', tcpHeader + '\n' + rows[0].replace('13AD', 'bad-port')])
    assert.throws(() => parseLocalTcpSockets(value, 1001));
});

test('IPv6 loopback sockets remain scoped and malformed or oversized tables are rejected', () => {
  const loopback = '00000000000000000000000001000000';
  const value = tcpHeader.replace('rem_address', 'remote_address') + '\n' + tcpRow(loopback + ':13AD', loopback + ':D903', '01', 42, 55);
  assert.equal(parseLocalTcpSockets(value, 42)[0].remotePort, 55555);
  assert.throws(() => parseLocalTcpSockets(' '.repeat(1024 * 1024 + 1), 42));
});

test('socket ownership distinguishes the server listener and clients without process arguments or payloads', () => {
  const root = mkdtempSync(resolve(tmpdir(), 'sgm-proc-test-')), uid = process.getuid();
  try {
    mkdirSync(resolve(root, 'net'));
    mkdirSync(resolve(root, 'self/ns'), { recursive: true }); symlinkSync('net:[99]', resolve(root, 'self/ns/net'));
    writeFileSync(resolve(root, 'net/tcp'), [tcpHeader,
      tcpRow('0100007F:13AD', '00000000:0000', '0A', uid, 11),
      tcpRow('0100007F:A35A', '0100007F:15B3', '01', uid, 12),
      tcpRow('0100007F:A35B', '0100007F:13AD', '01', uid, 13)].join('\n'));
    writeFileSync(resolve(root, 'net/tcp6'), tcpHeader + '\n');
    for (const pid of [55, 56]) {
      mkdirSync(resolve(root, String(pid), 'fd'), { recursive: true });
      mkdirSync(resolve(root, String(pid), 'ns')); symlinkSync('net:[99]', resolve(root, String(pid), 'ns/net'));
      writeFileSync(resolve(root, String(pid), 'comm'), 'adb\n');
      writeFileSync(resolve(root, String(pid), 'stat'), `${pid} (adb) ` + [...Array(19).fill('0'), String(pid * 100)].join(' '));
    }
    symlinkSync('socket:[11]', resolve(root, '55/fd/10')); symlinkSync('socket:[12]', resolve(root, '55/fd/11'));
    symlinkSync('socket:[12]', resolve(root, '55/fd/12')); symlinkSync('/private/secret-token', resolve(root, '55/fd/13'));
    symlinkSync('socket:[13]', resolve(root, '56/fd/10'));
    const options = { root, uid, platform: 'linux' }, processes = [{ pid: 55 }, { pid: 56 }];
    const result = observeAdbSockets(processes, options);
    assert.equal(result.completed, true); assert.equal(result.processes.length, 2);
    assert.equal(result.processes[0].connections.length, 2); assert.equal(result.processes[0].connections[0].listening, true);
    assert.equal(result.processes[1].connections[0].remotePort, 5037);
    assert.equal(result.argumentsRead, false); assert.equal(result.environmentRead, false); assert.equal(result.deviceCommandRequested, false);
    assert.doesNotMatch(JSON.stringify(result), /secret|token|private|socket:\[/);
    writeFileSync(resolve(root, '56/comm'), 'unrelated-private-process');
    const changed = observeAdbSockets(processes, options);
    assert.equal(changed.completed, false); assert.equal(changed.unavailableProcessCount, 1); assert.equal(changed.processes.length, 1);
    assert.doesNotMatch(JSON.stringify(changed), /unrelated|private/);
    writeFileSync(resolve(root, '56/comm'), 'adb'); rmSync(resolve(root, '56/ns/net'));
    symlinkSync('net:[100]', resolve(root, '56/ns/net'));
    assert.equal(observeAdbSockets(processes, options).completed, false);
    assert.equal(observeAdbSockets([...processes, processes[0]], options).completed, false);
    rmSync(resolve(root, 'net/tcp6'));
    const unavailable = observeAdbSockets(processes, options);
    assert.equal(unavailable.completed, false); assert.deepEqual(unavailable.processes, []);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('unsupported hosts are explicit and host process collection supplies only selected adb PIDs', () => {
  assert.equal(observeAdbSockets([], { platform: 'darwin' }).unavailableReason, 'unsupported-host');
  let called = 0;
  const result = observeAdbHostProcesses(() => ({ status: 0, stdout: '55 Thu Oct 22 12:24:02 2026 adb\n' }), processes => {
    called++; assert.deepEqual(processes.map(row => row.pid), [55]); return { completed: false, unavailableReason: 'test-unavailable' };
  });
  assert.equal(called, 1); assert.equal(result.completed, true); assert.equal(result.socketOwnership.completed, false);
  assert.equal(result.deviceCommandRequested, false);
});

test('host observations retain only version numbers, emulator-state counts and bounded signal counts', () => {
  const result = summarizeAdbHost('Android Debug Bridge version 1.0.41\nVersion 37.0.1-12345\nInstalled as /private/secret/adb',
    'List of devices attached\nemulator-5554 offline transport_id:2\nemulator-5556 device product:private\nreal-phone-secret device\n',
    'private-token kill-server\ntransport device offline\nconnection terminated: write failed\nprivate-key-data');
  assert.equal(result.bridgeVersion, '1.0.41'); assert.equal(result.platformToolsVersion, '37.0.1-12345');
  assert.deepEqual(result.emulatorStates, { device: 1, offline: 1, unauthorized: 0, other: 0 });
  assert.deepEqual(result.daemonLog.signals, { killServer: 1, serverRestart: 0, transportOffline: 1, writeFailure: 1 });
  assert.doesNotMatch(JSON.stringify(result), /secret|private|5554|real-phone/);
});
test('missing logs and failed inventory remain explicitly unobserved without a retry or device command', () => {
  const calls = [];
  const result = collectAdbHostHealth('component-transfer', (args) => {
    calls.push(args); return { status: null, signal: 'SIGTERM', error: { code: 'ETIMEDOUT' }, stdout: 'private', stderr: 'secret' };
  }, null);
  assert.deepEqual(calls, [['version'], ['devices', '-l']]);
  assert(result.observations.every((row) => !row.completed && row.errorCode === 'ETIMEDOUT'));
  assert.equal(result.daemonLog.available, false); assert.equal(result.daemonLog.signals.killServer, null);
  assert.equal(result.emulatorStates, null);
  assert.equal(result.bridgeVersion, null); assert.equal(result.retryPerformed, false); assert.equal(result.deviceMutationRequested, false);
  assert.doesNotMatch(JSON.stringify(result), /secret|private/);
  assert.throws(() => collectAdbHostHealth('unknown', () => assert.fail(), null));
});
test('CI gates cover the observation collector and neither accept a missing log nor publish its raw contents', () => {
  const read = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
  const source = read('scripts/qa/adb-host-health.mjs');
  for (const required of ['constants.O_NOFOLLOW', 'stat.uid !== process.getuid()', 'Math.min(stat.size, 65536)',
    "flag: 'wx'", 'timeout: 3000', 'rawLogsRetained: false']) assert(source.includes(required));
  for (const workflow of ['native-ci.yml', 'web-integration-smoke.yml'])
    assert.equal(read('.github/workflows/' + workflow).split('"tests/adb-host-health.test.mjs"').length - 1, 2);
});

test('process observations select only adb executable identity and start time, not command arguments or other processes', () => {
  const output = ' 500 Thu Oct 22 12:24:02 2026 /sdk/platform-tools/adb\n' +
    ' 12 Thu Oct 22 12:23:01 2026 /private/secret/node\n' +
    ' 9 Thu Oct 22 12:22:01 2026 adb\n';
  assert.deepEqual(summarizeAdbProcesses(output), [
    { pid: 9, startedAtLocal: 'Thu Oct 22 12:22:01 2026' },
    { pid: 500, startedAtLocal: 'Thu Oct 22 12:24:02 2026' },
  ]);
  let called = 0;
  const result = observeAdbHostProcesses((command, args, options) => {
    called++; assert.equal(command, '/bin/ps'); assert.deepEqual(args, ['-axo', 'pid=,lstart=,comm=']);
    assert.equal(options.timeout, 2000); assert.equal(options.env.LC_ALL, 'C'); assert(!options.env.SGM_QA_PASSWORD);
    return { status: 0, stdout: output, stderr: 'never retain this secret' };
  });
  assert.equal(called, 1); assert.equal(result.completed, true); assert.equal(result.adbProcesses.length, 2);
  assert.equal(result.rawLogsRetained, false); assert.equal(result.deviceCommandRequested, false);
  assert.doesNotMatch(JSON.stringify(result), /private|secret|platform-tools/);
  assert.throws(() => summarizeAdbProcesses('invalid metadata adb'));
  assert.throws(() => summarizeAdbProcesses('unrecognized unrelated process'));
  assert.throws(() => summarizeAdbProcesses(''));
});

test('an unavailable or malformed process observation stays unobserved without command retries', () => {
  for (const run of [() => ({ status: 1, stdout: 'secret', stderr: 'secret' }),
    () => ({ status: 0, stdout: 'bad metadata adb' }), () => { throw new Error('secret'); }]) {
    const result = observeAdbHostProcesses(run);
    assert.equal(result.completed, false); assert.equal(result.adbProcesses, null);
    assert.doesNotMatch(JSON.stringify(result), /secret/);
  }
});
