import assert from 'node:assert/strict';
import { readFile, readlink, readdir, mkdir } from 'node:fs/promises';
import { basename, dirname, isAbsolute, join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

const engines = new Set(['qemu-system-x86_64-headless', 'qemu-system-x86_64']);
const children = new Set(['crashpad_handler', 'netsimd']);
const numeric = value => /^[1-9]\d{0,9}$/.test(String(value));

export async function createFreshHostObservationDirectory(directory) {
  assert(isAbsolute(directory)); assert.equal(basename(directory), 'host-shutdown');
  await mkdir(dirname(directory), { recursive: true, mode: 0o700 });
  await mkdir(directory, { mode: 0o700 });
}

export function parseHostStat(raw) {
  const close = raw.lastIndexOf(')'), open = raw.indexOf('(');
  assert(open > 0 && close > open);
  const pid = raw.slice(0, open).trim(), fields = raw.slice(close + 1).trim().split(/\s+/);
  assert(numeric(pid) && /^[RSDZTWXIPt]$/.test(fields[0]));
  assert(/^\d{1,10}$/.test(fields[1]) && /^\d{1,20}$/.test(fields[19]));
  return { pid: Number(pid), parentPid: Number(fields[1]), state: fields[0], startedTicks: fields[19] };
}

async function stat(root, pid) {
  const row = parseHostStat(await readFile(join(root, String(pid), 'stat'), 'utf8'));
  assert.equal(row.pid, Number(pid)); return row;
}
async function executable(root, pid) {
  return basename(await readlink(join(root, String(pid), 'exe')));
}
async function pids(root) {
  const names = (await readdir(root)).filter(numeric); assert(names.length <= 8192);
  return names.sort((a, b) => Number(a) - Number(b));
}

export async function selectEmulatorHost({ port, avd }, root = '/proc') {
  assert(Number.isInteger(port) && port >= 5554 && port <= 5584 && port % 2 === 0);
  assert.equal(avd, 'test');
  const matches = [];
  for (const pid of await pids(root)) {
    try {
      const before = await stat(root, pid);
      const name = await executable(root, pid); if (!engines.has(name)) continue;
      const args = (await readFile(join(root, pid, 'cmdline'), 'utf8')).split('\0');
      const value = flag => { const index = args.indexOf(flag); return index < 0 ? null : args[index + 1]; };
      if (args.filter(value => value === '-port').length !== 1 || args.filter(value => value === '-avd').length !== 1) continue;
      if (value('-port') !== String(port) || value('-avd') !== avd) continue;
      const identity = await stat(root, pid);
      if (identity.startedTicks !== before.startedTicks) continue;
      if (identity.state === 'Z') continue;
      matches.push({ pid: identity.pid, startedTicks: identity.startedTicks, executable: name, port, avd });
    } catch { /* An exiting or unreadable process cannot establish ownership. */ }
  }
  assert.equal(matches.length, 1, 'One exact CI emulator host identity is required');
  return matches[0];
}

async function waitChannel(path) {
  try {
    const value = (await readFile(path, 'utf8')).trim();
    return /^[A-Za-z0-9_]{1,80}$/.test(value) ? value : null;
  } catch { return null; }
}
async function streamKind(root, pid, fd) {
  try {
    const target = await readlink(join(root, String(pid), 'fd', String(fd)));
    if (/^pipe:\[\d+\]$/.test(target)) return 'pipe';
    if (/^socket:\[\d+\]$/.test(target)) return 'socket';
    return 'other';
  } catch { return 'unavailable'; }
}

export async function probeEmulatorHost(identity, root = '/proc') {
  assert(numeric(identity.pid) && /^\d{1,20}$/.test(identity.startedTicks));
  let current;
  try { current = await stat(root, identity.pid); }
  catch (error) { return { state: error.code === 'ENOENT' ? 'gone' : 'unavailable' }; }
  if (current.startedTicks !== identity.startedTicks) return { state: 'identity-changed' };
  return { state: current.state === 'Z' ? 'zombie' : 'present', processState: current.state };
}

export async function inspectEmulatorHost(identity, root = '/proc') {
  const current = await probeEmulatorHost(identity, root);
  if (current.state !== 'present') return current;
  const tasks = [], taskRoot = join(root, String(identity.pid), 'task');
  try {
    const ids = (await readdir(taskRoot)).filter(numeric).sort((a, b) => Number(a) - Number(b));
    assert(ids.length <= 4096);
    for (const tid of ids.slice(0, 128)) tasks.push({ tid: Number(tid), waitChannel: await waitChannel(join(taskRoot, tid, 'wchan')) });
  } catch { return { state: 'unavailable' }; }
  const descendants = [];
  for (const pid of await pids(root)) {
    try {
      const row = await stat(root, pid); if (row.parentPid !== identity.pid) continue;
      const name = await executable(root, pid); if (!children.has(name)) continue;
      const channel = await waitChannel(join(root, pid, 'wchan')), after = await stat(root, pid);
      if (row.startedTicks !== after.startedTicks || after.parentPid !== identity.pid) continue;
      descendants.push({ pid: row.pid, startedTicks: row.startedTicks, state: after.state, executable: name, waitChannel: channel });
    } catch { /* Keep this read-only snapshot independent of process-exit races. */ }
  }
  const after = await probeEmulatorHost(identity, root); if (after.state !== 'present') return after;
  return { ...after, tasks, descendants,
    stdout: await streamKind(root, identity.pid, 1), stderr: await streamKind(root, identity.pid, 2) };
}

export async function observeEmulatorHost(identity, { onSample, now = () => performance.now(), sleep = delay,
  probe = probeEmulatorHost, inspect = inspectEmulatorHost }) {
  assert.equal(typeof onSample, 'function');
  const started = now(); let previousSample = -15_000, observations = 0, finalState = 'unavailable';
  while (true) {
    const elapsedMs = now() - started; let row = await probe(identity);
    if (row.state !== 'present' || elapsedMs - previousSample >= 15_000 || elapsedMs >= 90_000) {
      if (row.state === 'present') row = await inspect(identity);
      await onSample({ elapsedMs, observedAt: new Date().toISOString(), ...row }, observations++);
      previousSample = elapsedMs;
    }
    finalState = row.state;
    if (row.state !== 'present' || elapsedMs >= 90_000) break;
    await sleep(1_000);
  }
  return { finalState, observations, elapsedMs: now() - started };
}
