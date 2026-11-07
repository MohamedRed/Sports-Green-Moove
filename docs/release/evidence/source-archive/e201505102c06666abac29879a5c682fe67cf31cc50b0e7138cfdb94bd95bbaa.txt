import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';

function groupAlive(pid) {
  if (!pid) return false;
  try { process.kill(-pid, 0); return true; }
  catch (error) { if (error.code === 'ESRCH') return false; throw error; }
}
function signalGroup(pid, signal) {
  if (!pid) return;
  try { process.kill(-pid, signal); }
  catch (error) { if (error.code !== 'ESRCH') throw error; }
}
async function requireGroupExit(pid, timeout) {
  const deadline = Date.now() + timeout;
  while (groupAlive(pid)) {
    assert(Date.now() < deadline, 'Owned local process group did not stop; cleanup is unverified');
    await delay(50);
  }
}

export async function superviseLocalProcess({ command, args, cwd, env, signal, stopGraceMs = 10_000 }) {
  assert(process.platform === 'darwin' || process.platform === 'linux', 'Owned local process groups require POSIX');
  assert(signal instanceof AbortSignal); assert(Number.isInteger(stopGraceMs) && stopGraceMs > 0);
  if (signal.aborted) {
    assert(['SIGINT', 'SIGTERM'].includes(signal.reason));
    return { stopped: true, spawned: false, groupExitVerified: true };
  }
  const child = spawn(command, args, { cwd, env, stdio: 'inherit', detached: true });
  let stopTimer, rejectStop;
  const interrupted = new Promise((_, reject) => { rejectStop = reject; });
  const closed = new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('close', (code, exitSignal) => resolve({ code, signal: exitSignal }));
  });
  const stop = () => {
    try {
      assert(['SIGINT', 'SIGTERM'].includes(signal.reason));
      signalGroup(child.pid, signal.reason);
      stopTimer = setTimeout(() => rejectStop(new Error('Owned local process did not acknowledge shutdown; cleanup is unverified')), stopGraceMs);
    } catch (error) { rejectStop(error); }
  };
  signal.addEventListener('abort', stop, { once: true });
  if (signal.aborted) stop();
  try {
    const result = await Promise.race([closed, interrupted]);
    const unexpectedDescendants = groupAlive(child.pid);
    if (unexpectedDescendants) signalGroup(child.pid, 'SIGTERM');
    await requireGroupExit(child.pid, stopGraceMs);
    assert(signal.aborted || !unexpectedDescendants, 'Local launcher exited with live descendants; explicit cleanup was required');
    const interruptedExit = signal.aborted && (['SIGINT', 'SIGTERM'].includes(result.signal) || [130, 143].includes(result.code));
    assert(result.code === 0 || interruptedExit, 'Local service exited unsuccessfully');
    return { ...result, stopped: signal.aborted, spawned: true, groupExitVerified: true };
  } finally {
    clearTimeout(stopTimer); signal.removeEventListener('abort', stop);
  }
}
