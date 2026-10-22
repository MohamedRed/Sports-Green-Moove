import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { isAbsolute, resolve } from 'node:path';
import { superviseLocalProcess } from './supervised-local-process.mjs';
import { scopedLocalSettings } from './scoped-browserstack-local.mjs';

assert.equal(process.platform, 'darwin', 'This verified vendor-binary launcher is macOS-only');
const candidate = process.argv[2]; assert(isAbsolute(candidate ?? ''), 'Supply the signed vendor binary path');
const startupDiagnostic = process.argv[3] === '--startup-diagnostic-approved';
assert(process.argv.length === (startupDiagnostic ? 4 : 3), 'Only the explicit approved startup diagnostic option is allowed');
const binary = realpathSync(candidate);
execFileSync('/usr/bin/codesign', ['--verify', '--strict', binary], { stdio: 'pipe' });
// codesign details are written to stderr; verify publisher without printing its output.
const signature = spawnSync('/usr/bin/codesign', ['-dv', '--verbose=2', binary], { encoding: 'utf8' });
assert.equal(signature.status, 0, 'Vendor signature unavailable'); const publisher = signature.stderr;
assert(publisher.includes('TeamIdentifier=YQ5FZQ855D') && publisher.includes('Authority=Developer ID Application: Browserstack Inc'));
const temp = mkdtempSync(resolve(tmpdir(), 'sgm-scoped-bs-')); const pipe = resolve(temp, 'credential.pipe');
const home = resolve(temp, 'vendor-home'); mkdirSync(home, { mode: 0o700 });
execFileSync('/usr/bin/mkfifo', ['-m', '600', pipe]);
const configPipe = resolve(temp, 'vendor-config.yml');
execFileSync('/usr/bin/mkfifo', ['-m', '600', configPipe]);
const controller = new AbortController();
const interrupt = () => controller.abort('SIGINT'), terminate = () => controller.abort('SIGTERM');
process.once('SIGINT', interrupt); process.once('SIGTERM', terminate);
let verified = false;
try {
  console.log(JSON.stringify({ scope: 'private-fifo-ready-not-provider-connection-proof', credentialPipe: pipe, settings: scopedLocalSettings,
    startupDiagnostic, requestLoggingEnabled: false }));
  const env = Object.fromEntries(['PATH', 'USER', 'LOGNAME', 'TMPDIR'].filter(key => process.env[key]).map(key => [key, process.env[key]]));
  Object.assign(env, { HOME: home, XDG_CONFIG_HOME: resolve(home, '.config') });
  const result = await superviseLocalProcess({ command: process.execPath,
    args: [resolve(import.meta.dirname, 'run-scoped-browserstack-local.mjs'), binary, pipe, configPipe,
      ...(startupDiagnostic ? ['--startup-diagnostic-approved'] : [])], cwd: temp,
    env, signal: controller.signal, stopGraceMs: 15_000 });
  verified = result.groupExitVerified;
  if (result.stopped) process.exitCode = controller.signal.reason === 'SIGINT' ? 130 : 143;
} catch (error) {
  verified = error.groupExitVerified === true;
  throw error;
} finally {
  process.removeListener('SIGINT', interrupt); process.removeListener('SIGTERM', terminate);
  if (verified) { rmSync(temp, { recursive: true, force: true }); console.log('Owned helper process group stopped; private handoff directory removed.'); }
  else console.error('Helper cleanup is not verified. Retain the private handoff directory until the owned process group is stopped.');
}
