import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { isAbsolute } from 'node:path';
import { isolatedLocalAllowlist, assertIsolatedTunnelSettings } from './browserstack-local-policy.mjs';
import { assertPrivatePipe } from './read-private-credential-pipe.mjs';
import { writePrivateConfigPipe } from './write-private-config-pipe.mjs';

export const scopedLocalSettings = Object.freeze({ onlyAllow: isolatedLocalAllowlist, forceLocal: false,
  verbose: false, enableLoggingForApi: false, mitmProxy: false, folderTesting: '', includeHosts: '', excludeHosts: '' });
export const allowedHelperEnvironment = Object.freeze(['PATH', 'USER', 'LOGNAME', 'TMPDIR', 'HOME', 'XDG_CONFIG_HOME',
  '__CF_USER_TEXT_ENCODING']);

export function scopedLocalArguments(configPipe) {
  assert(isAbsolute(configPipe ?? ''));
  assertIsolatedTunnelSettings(scopedLocalSettings);
  return ['--config-file', configPipe, '--only', isolatedLocalAllowlist, '--verbose', '0',
    '--log-file', '/dev/null', '--disable-dashboard', '--timeout', '10'];
}

// The vendor cannot read inherited descriptors; a private FIFO keeps config bytes off disk.
export async function runScopedLocalBinary(binary, accessKey, { signal, env, configPipe, spawnImpl = spawn, onSpawn = () => {} }) {
  assert(isAbsolute(binary)); assert(signal instanceof AbortSignal);
  assert.equal(typeof accessKey, 'string'); assert(/^[A-Za-z0-9]{20,256}$/.test(accessKey), 'Invalid credential shape');
  assert(Object.keys(env).every(key => allowedHelperEnvironment.includes(key)),
    'Only the isolated helper environment is allowed');
  assert(!Object.values(env).some(value => String(value).includes(accessKey)), 'A credential cannot enter the helper environment');
  if (signal.aborted) return { spawned: false, stopped: true, code: 0, signal: null };
  assertPrivatePipe(configPipe);
  const transfer = new AbortController();
  const child = spawnImpl(binary, scopedLocalArguments(configPipe), { env, stdio: ['ignore', 'ignore', 'ignore'] });
  let finished = false;
  const closed = new Promise((resolve, reject) => {
    child.once('error', () => { finished = true; transfer.abort(); reject(new Error('Scoped helper could not start')); });
    child.once('close', (code, exitSignal) => { finished = true; transfer.abort(); resolve({ code, signal: exitSignal }); });
  });
  closed.catch(() => {});
  let stopRequested = false;
  const stop = () => { if (!stopRequested && !finished) { stopRequested = true; child.kill(signal.reason === 'SIGINT' ? 'SIGINT' : 'SIGTERM'); } };
  signal.addEventListener('abort', stop, { once: true });
  const config = Buffer.from(`key: ${accessKey}\n`); accessKey = '';
  try {
    try { await writePrivateConfigPipe(configPipe, config, AbortSignal.any([signal, transfer.signal, AbortSignal.timeout(15_000)])); }
    catch { stop(); await closed; throw new Error('Private credential transfer failed'); }
    config.fill(0); onSpawn(child.pid);
    if (signal.aborted) stop();
    const result = await closed;
    assert(result.code === 0 || (signal.aborted && (['SIGINT', 'SIGTERM'].includes(result.signal) || [130, 143].includes(result.code))),
      'Scoped helper exited unsuccessfully; no device flow is verified');
    return { ...result, spawned: true, stopped: signal.aborted };
  } catch (error) {
    stop(); await closed.catch(() => {}); throw error;
  } finally { config.fill(0); signal.removeEventListener('abort', stop); }
}
