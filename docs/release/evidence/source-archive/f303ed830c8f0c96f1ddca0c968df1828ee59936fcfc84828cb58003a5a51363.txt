import assert from 'node:assert/strict';
import { readFileSync, readdirSync, readlinkSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

const scope = 'same-user-adb-loopback-socket-ownership-not-disconnect-cause';
const loopbacks = new Set(['0100007F', '00000000000000000000000001000000', '0000000000000000FFFF00000100007F']);
const wildcards = new Set(['00000000', '00000000000000000000000000000000']);
const endpoint = value => {
  const match = /^([A-Fa-f0-9]{8}|[A-Fa-f0-9]{32}):([A-Fa-f0-9]{4})$/.exec(value);
  assert(match, 'Invalid TCP endpoint');
  const address = match[1].toUpperCase();
  return { category: loopbacks.has(address) ? 'loopback' : wildcards.has(address) ? 'wildcard' : 'other',
    port: Number.parseInt(match[2], 16) };
};

export function parseLocalTcpSockets(input, uid) {
  assert(Number.isSafeInteger(uid) && uid >= 0); assert(input.length <= 1024 * 1024);
  const lines = input.trim().split('\n'); assert(/^\s*sl\s+local_address\s+rem(?:ote)?_address\s+st\b/.test(lines.shift()));
  return lines.flatMap(line => {
    const fields = line.trim().split(/\s+/); assert(fields.length >= 10 && /^\d+:$/.test(fields[0]));
    assert(/^[a-fA-F0-9]{2}$/.test(fields[3]) && /^\d+$/.test(fields[7]) && /^\d+$/.test(fields[9]));
    const local = endpoint(fields[1]), remote = endpoint(fields[2]), state = fields[3].toUpperCase();
    if (Number(fields[7]) !== uid || local.category === 'other' || remote.category === 'other') return [];
    const listening = state === '0A';
    if (!listening && (local.category !== 'loopback' || remote.category !== 'loopback')) return [];
    return [{ inode: fields[9], state, listening, localPort: local.port, remotePort: remote.port,
      localAddress: local.category, remoteAddress: remote.category }];
  });
}

function processIdentity(root, pid, uid) {
  const path = resolve(root, String(pid));
  assert.equal(statSync(path).uid, uid, 'Process owner changed');
  assert.equal(readFileSync(resolve(path, 'comm'), 'utf8').trim(), 'adb', 'Process identity changed');
  const status = readFileSync(resolve(path, 'stat'), 'utf8');
  const match = /^(\d+) \(adb\) ([\s\S]+)$/.exec(status); assert(match && Number(match[1]) === pid);
  const ticks = match[2].trim().split(/\s+/)[19]; assert(/^\d+$/.test(ticks));
  return ticks;
}

export function observeAdbSockets(processes, { root = '/proc', platform = process.platform,
  uid = typeof process.getuid === 'function' ? process.getuid() : null } = {}) {
  const result = { scope, completed: false, deviceCommandRequested: false, rawNetworkTablesRetained: false,
    argumentsRead: false, environmentRead: false, processes: [], unavailableProcessCount: 0 };
  if (platform !== 'linux') return { ...result, unavailableReason: 'unsupported-host' };
  try {
    assert(Array.isArray(processes) && processes.length <= 16);
    assert(processes.every(row => Number.isSafeInteger(row.pid) && row.pid > 0));
    assert.equal(new Set(processes.map(row => row.pid)).size, processes.length);
    assert(Number.isSafeInteger(uid) && uid >= 0);
    const namespace = readlinkSync(resolve(root, 'self/ns/net')); assert(/^net:\[\d+\]$/.test(namespace));
    const sockets = ['tcp', 'tcp6'].flatMap(file => parseLocalTcpSockets(readFileSync(resolve(root, 'net', file), 'utf8'), uid));
    const byInode = new Map(sockets.map(row => [row.inode, row]));
    for (const { pid } of processes) {
      try {
        const startTicks = processIdentity(root, pid, uid), directory = resolve(root, String(pid), 'fd');
        assert.equal(readlinkSync(resolve(root, String(pid), 'ns/net')), namespace, 'Network namespace differs');
        const descriptors = readdirSync(directory); assert(descriptors.length <= 256);
        const connections = new Map();
        for (const fd of descriptors) {
          assert(/^\d+$/.test(fd));
          const target = readlinkSync(resolve(directory, fd)), inode = /^socket:\[(\d+)\]$/.exec(target)?.[1];
          if (inode && byInode.has(inode)) connections.set(inode, byInode.get(inode));
        }
        assert.equal(processIdentity(root, pid, uid), startTicks, 'Process changed during observation');
        result.processes.push({ pid, startTicks, connections: [...connections.values()].sort((a, b) =>
          a.localPort - b.localPort || a.remotePort - b.remotePort || a.inode.localeCompare(b.inode)) });
      } catch { result.unavailableProcessCount++; }
    }
    return { ...result, completed: result.unavailableProcessCount === 0,
      unavailableReason: result.unavailableProcessCount ? 'process-observation-incomplete' : null };
  } catch { return { ...result, unavailableReason: 'socket-observation-unavailable' }; }
}
