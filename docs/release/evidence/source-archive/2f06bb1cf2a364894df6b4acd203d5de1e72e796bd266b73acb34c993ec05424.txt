import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { isAbsolute } from 'node:path';
import { isolatedLocalAllowlist, assertIsolatedTunnelSettings } from './browserstack-local-policy.mjs';
import { assertPrivatePipe } from './read-private-credential-pipe.mjs';
import { writePrivateConfigPipe } from './write-private-config-pipe.mjs';
import { capturePrivateStartupLog } from './private-startup-log-pipe.mjs';

export const scopedLocalSettings = Object.freeze({ onlyAllow: isolatedLocalAllowlist, forceLocal: false,
  verbose: false, enableLoggingForApi: false, mitmProxy: false, folderTesting: '', includeHosts: '', excludeHosts: '' });
export const allowedHelperEnvironment = Object.freeze(['PATH', 'USER', 'LOGNAME', 'TMPDIR', 'HOME', 'XDG_CONFIG_HOME',
  '__CF_USER_TEXT_ENCODING']);

export function scopedLocalArguments(configPipe, startupDiagnostic = false, logPipe) {
  assert(isAbsolute(configPipe ?? ''));
  assert.equal(typeof startupDiagnostic, 'boolean');
  if (startupDiagnostic) assert(isAbsolute(logPipe ?? ''), 'Approved diagnostics require a private log pipe');
  else assert.equal(logPipe, undefined, 'Normal operation cannot capture a startup log');
  assertIsolatedTunnelSettings(scopedLocalSettings);
  // The vendor timeout is ten minutes of inactivity, not a startup deadline.
  return ['--config-file', configPipe, '--only', isolatedLocalAllowlist, '--verbose', startupDiagnostic ? '1' : '0',
    '--log-file', startupDiagnostic ? logPipe : '/dev/null', '--disable-dashboard', '--timeout', '10'];
}

// The vendor cannot read inherited descriptors; a private FIFO keeps config bytes off disk.
export async function runScopedLocalBinary(binary, accessKey, { signal, env, configPipe, logPipe, startupDiagnostic = false, spawnImpl = spawn, onSpawn = () => {} }) {
  assert(isAbsolute(binary)); assert(signal instanceof AbortSignal);
  assert.equal(typeof accessKey, 'string'); assert(/^[A-Za-z0-9]{20,256}$/.test(accessKey), 'Invalid credential shape');
  assert(Object.keys(env).every(key => allowedHelperEnvironment.includes(key)),
    'Only the isolated helper environment is allowed');
  assert(!Object.values(env).some(value => String(value).includes(accessKey)), 'A credential cannot enter the helper environment');
  if (signal.aborted) return { spawned: false, stopped: true, code: 0, signal: null };
  assertPrivatePipe(configPipe);
  const args = scopedLocalArguments(configPipe, startupDiagnostic, logPipe);
  if (startupDiagnostic) { assert.notEqual(logPipe, configPipe); assertPrivatePipe(logPipe); }
  const transfer = new AbortController();
  const child = spawnImpl(binary, args, { env, stdio: ['ignore', 'pipe', 'pipe'] });
  const diagnosticKey = startupDiagnostic ? accessKey : ''; let startupOutput = '', startupOutputBytes = 0;
  const diagnostics = { authenticationRejected: false, duplicateConnection: false, portUnavailable: false,
    networkFailure: false, configurationRejected: false };
  const classify = chunk => {
    const text = String(chunk).slice(0, 8192);
    if (startupDiagnostic) { startupOutputBytes += Buffer.byteLength(String(chunk)); startupOutput = (startupOutput + text).slice(0, 8192); }
    diagnostics.authenticationRejected ||= /invalid (?:access )?key|authentication failed|unauthori[sz]ed/i.test(text);
    diagnostics.duplicateConnection ||= /another (?:instance|binary|connection)|already (?:running|connected)/i.test(text);
    diagnostics.portUnavailable ||= /EADDRINUSE|address already in use|port.*(?:occupied|in use)/i.test(text);
    diagnostics.networkFailure ||= /could not connect|unable to connect|connection (?:failed|refused)|timed? ?out|ENOTFOUND/i.test(text);
    diagnostics.configurationRejected ||= /invalid (?:option|config)|unknown (?:option|argument)|config.*(?:invalid|error)/i.test(text);
  };
  child.stdout?.on('data', classify); child.stderr?.on('data', classify);
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
  let startupLog;
  try {
    if (startupDiagnostic) startupLog = capturePrivateStartupLog(logPipe, classify, stop);
    try { await writePrivateConfigPipe(configPipe, config, AbortSignal.any([signal, transfer.signal, AbortSignal.timeout(15_000)])); }
    catch { stop(); await closed; throw new Error('Private credential transfer failed'); }
    config.fill(0); onSpawn(child.pid);
    if (signal.aborted) stop();
    const result = await closed;
    startupLog?.close();
    const ownedStop = stopRequested && signal.aborted &&
      (result.code === 0 || ['SIGINT', 'SIGTERM'].includes(result.signal) || [130, 143].includes(result.code));
    if (!ownedStop)
      throw Object.assign(new Error('Scoped helper exited without a verified requested shutdown; no device flow is verified'),
        { vendorOutcome: { code: result.code, signal: result.signal, stopRequested, diagnostics,
          ...(startupDiagnostic ? {startupOutputBytes, startupOutputTruncated: startupOutputBytes > 8192,
            startupOutput: startupOutput.replaceAll(diagnosticKey, '[REDACTED]')
              .replace(/Bearer\s+[^\s]+|AIza[\w-]{20,}|eyJ[\w-]+\.[\w-]+\.[\w-]*/g, '[REDACTED]')
              .replace(/([?&](?:key|token|access_key|password)=)[^&\s]+/gi, '$1[REDACTED]')
              .slice(0, Math.max(0, 8192 - diagnosticKey.length))} : {}) } });
    return { ...result, spawned: true, stopped: signal.aborted };
  } catch (error) {
    stop(); await closed.catch(() => {}); throw error;
  } finally {
    startupLog?.close();
    config.fill(0); startupOutput = ''; signal.removeEventListener('abort', stop);
    child.stdout?.removeListener('data', classify); child.stderr?.removeListener('data', classify);
  }
}
