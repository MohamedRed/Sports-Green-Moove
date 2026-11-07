import assert from 'node:assert/strict';
import {readFileSync, readdirSync, readlinkSync, statSync} from 'node:fs';
import {basename, join} from 'node:path';
import {parseHostStat} from '../qa/emulator-host-observation.mjs';
import {parseLocalTcpSockets} from '../qa/adb-host-sockets.mjs';

const engines = new Set(['qemu-system-x86_64-headless', 'qemu-system-x86_64']);
export function assertTransferEmulatorIdentity(identity, serial) {
  assert(identity && Number.isSafeInteger(identity.pid) && identity.pid > 0);
  assert.deepEqual(Object.keys(identity).sort(), ['avd', 'executable', 'pid', 'port', 'startedTicks']);
  assert(/^\d{1,20}$/.test(identity.startedTicks)); assert(engines.has(identity.executable));
  assert.equal(identity.avd, 'test'); assert.equal(serial, 'emulator-' + identity.port);
  assert(Number.isInteger(identity.port) && identity.port >= 5554 && identity.port <= 5584 && identity.port % 2 === 0);
}

export function observeTransferEmulator(identity, {root = '/proc', platform = process.platform,
  uid = typeof process.getuid === 'function' ? process.getuid() : null} = {}) {
  assertTransferEmulatorIdentity(identity, 'emulator-' + identity?.port);
  const result = {scope: 'bound-emulator-process-and-loopback-sockets-not-guest-lifecycle-or-disconnect-cause',
    observedAt: new Date().toISOString(), monotonicMs: performance.now(), atomicObservation: false,
    identity: {...identity}, processState: 'unavailable', socketsObserved: false, connections: [],
    rawArgumentsRetained: false, environmentRead: false, deviceCommandsRequested: false};
  if (platform !== 'linux') return {...result, unavailableReason: 'unsupported-host'};
  const directory = join(root, String(identity.pid));
  const probe = () => {
    try {
      assert.equal(statSync(directory).uid, uid, 'Process owner differs');
      const stat = parseHostStat(readFileSync(join(directory, 'stat'), 'utf8')); assert.equal(stat.pid, identity.pid);
      if (stat.startedTicks !== identity.startedTicks) return 'identity-changed';
      if (stat.state === 'Z') return 'zombie';
      assert.equal(basename(readlinkSync(join(directory, 'exe'))), identity.executable);
      return 'present';
    } catch {
      try {statSync(directory);} catch (error) {if (error.code === 'ENOENT') return 'gone';}
      return 'unavailable';
    }
  };
  result.processState = probe(); if (result.processState !== 'present') return result;
  try {
    assert(Number.isSafeInteger(uid) && uid >= 0);
    const namespace = readlinkSync(join(root, 'self/ns/net')); assert(/^net:\[\d+\]$/.test(namespace));
    assert.equal(readlinkSync(join(directory, 'ns/net')), namespace);
    const ports = new Set([identity.port, identity.port + 1]);
    const sockets = ['tcp', 'tcp6'].flatMap(name => parseLocalTcpSockets(readFileSync(join(root, 'net', name), 'utf8'), uid))
      .filter(row => ports.has(row.localPort) || ports.has(row.remotePort));
    const byInode = new Map(sockets.map(row => [row.inode, row])), selected = new Map();
    const descriptors = readdirSync(join(directory, 'fd')); assert(descriptors.length <= 1024);
    for (const fd of descriptors) {
      assert(/^\d+$/.test(fd));
      const target = readlinkSync(join(directory, 'fd', fd)), inode = /^socket:\[(\d+)\]$/.exec(target)?.[1];
      if (inode && byInode.has(inode)) selected.set(inode, byInode.get(inode));
    }
    // Bind both sides of the snapshot to the original process birth, never a replacement PID.
    const after = probe(); if (after !== 'present') return {...result, processState: after};
    return {...result, socketsObserved: true, connections: [...selected.values()].sort((a, b) =>
      a.localPort - b.localPort || a.remotePort - b.remotePort || a.inode.localeCompare(b.inode))};
  } catch {
    return {...result, processState: probe(), unavailableReason: 'socket-observation-unavailable'};
  }
}
