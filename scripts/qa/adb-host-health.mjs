import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { closeSync, constants, fstatSync, openSync, readSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { isAbsolute, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export function summarizeAdbHost(version, inventory, daemonTail) {
  const stateCounts = { device: 0, offline: 0, unauthorized: 0, other: 0 };
  for (const line of inventory.split('\n')) {
    const match = /^emulator-\d+\s+(\S+)/.exec(line);
    if (match) stateCounts[Object.hasOwn(stateCounts, match[1]) ? match[1] : 'other']++;
  }
  const count = (pattern) => daemonTail === null ? null : [...daemonTail.matchAll(pattern)].length;
  return { bridgeVersion: /Android Debug Bridge version ([\d.]+)/.exec(version)?.[1] ?? null,
    platformToolsVersion: /^Version ([\w.-]+)/m.exec(version)?.[1] ?? null,
    emulatorStates: stateCounts, daemonLog: { available: daemonTail !== null, tailLimitBytes: 65536,
      signals: { killServer: count(/kill-server/gi), serverRestart: count(/server.*(?:killed|restarting)/gi),
        transportOffline: count(/(?:transport|device)[^\n]{0,120}offline/gi),
        writeFailure: count(/(?:write failed|failed to write)/gi) } } };
}

function readDaemonTail() {
  if (typeof process.getuid !== 'function') return null;
  let fd;
  try {
    fd = openSync(join(tmpdir(), `adb.${process.getuid()}.log`), constants.O_RDONLY | constants.O_NOFOLLOW);
    const stat = fstatSync(fd);
    if (!stat.isFile() || stat.uid !== process.getuid()) return null;
    const buffer = Buffer.alloc(Math.min(stat.size, 65536));
    const length = readSync(fd, buffer, 0, buffer.length, Math.max(0, stat.size - buffer.length));
    return buffer.subarray(0, length).toString('utf8');
  } catch { return null; }
  finally { if (fd !== undefined) closeSync(fd); }
}

export function collectAdbHostHealth(phase, run, daemonTail) {
  assert(['component-transfer', 'local-replay'].includes(phase));
  const observations = [];
  const observe = (args) => {
    const result = run(args);
    const completed = result.status === 0 && !result.error && !result.signal;
    observations.push({ command: args.join(' '), completed, status: result.status ?? null,
      signal: result.signal ?? null, errorCode: result.error?.code ?? null });
    return completed ? result.stdout || '' : '';
  };
  const version = observe(['version']);
  const inventory = observe(['devices', '-l']);
  const summary = summarizeAdbHost(version, inventory, daemonTail);
  return { scope: 'sanitized-host-transport-observations-not-root-cause-or-flow-proof', phase,
    observedAt: new Date().toISOString(), observations, ...summary,
    emulatorStates: observations[1].completed ? summary.emulatorStates : null,
    rawLogsRetained: false, deviceMutationRequested: false, retryPerformed: false };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [phase, output] = process.argv.slice(2);
  assert(output && isAbsolute(output), 'A fresh absolute diagnostic output is required');
  const adb = process.env.ANDROID_HOME ? join(process.env.ANDROID_HOME, 'platform-tools/adb') : 'adb';
  const report = collectAdbHostHealth(phase, (args) => spawnSync(adb, args,
    { encoding: 'utf8', timeout: 3000, maxBuffer: 262144 }), readDaemonTail());
  writeFileSync(output, JSON.stringify(report, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
}
