import assert from 'node:assert/strict';
import { existsSync, lstatSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { isAbsolute, resolve, dirname } from 'node:path';
import { prepareLocalRuntime, emulatorEntryArguments } from './local-runtime.mjs';
import { superviseLocalProcess } from './supervised-local-process.mjs';
import { assertLocalEndpointsClosed } from './local-emulator-lifecycle.mjs';

const [sessionPath, output] = process.argv.slice(2);
assert(isAbsolute(sessionPath ?? '') && isAbsolute(output ?? '') && !existsSync(sessionPath) && !existsSync(output));
const parent = lstatSync(dirname(sessionPath));
assert(parent.isDirectory() && !parent.isSymbolicLink() && parent.uid === process.getuid() && (parent.mode & 0o077) === 0);
mkdirSync(output, { mode: 0o700 });
const controller = new AbortController();
const interrupt = () => controller.abort('SIGINT'), terminate = () => controller.abort('SIGTERM');
process.once('SIGINT', interrupt); process.once('SIGTERM', terminate);
let runtime, processGroupExited = false, supervisionAttempted = false, endpointsClosed = false, failure;
try {
  await assertLocalEndpointsClosed([9099, 8080, 9000, 5001]);
  runtime = prepareLocalRuntime();
  Object.assign(runtime.env, { SGM_LOCAL_UI_SESSION_FILE: sessionPath, SGM_CHILD_ACCOUNT_PHONE_OUTPUT: output });
  supervisionAttempted = true;
  const result = await superviseLocalProcess({ command: process.execPath,
    args: emulatorEntryArguments(runtime, 'child-account-phone-runtime.mjs'), cwd: runtime.temp,
    env: runtime.env, signal: controller.signal, stopGraceMs: 20_000 });
  processGroupExited = result.groupExitVerified;
} catch (error) { processGroupExited = error.groupExitVerified === true; failure = true; }
finally {
  if (!supervisionAttempted || processGroupExited) {
    try { rmSync(sessionPath, { force: true }); runtime?.cleanup(); } catch { failure = true; }
    try { await assertLocalEndpointsClosed([9099, 8080, 9000, 5001]); endpointsClosed = true; } catch { failure = true; }
  }
  writeFileSync(resolve(output, 'runtime-cleanup.json'), JSON.stringify({ projectId: 'demo-sgm-local-qa',
    closedAt: new Date().toISOString(), processGroupExited, privateSessionAbsent: !existsSync(sessionPath),
    runtimeAbsent: runtime ? !existsSync(runtime.temp) : true, endpointsClosed, failed: Boolean(failure),
    scope: 'owned-runtime-disposal-not-phone-flow-proof' }, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  process.removeListener('SIGINT', interrupt); process.removeListener('SIGTERM', terminate);
}
if (failure) throw new Error('Child-account phone runtime did not finish cleanly; retain its disposal receipt.');
console.log('Owned child-account runtime closed; no phone-flow success is inferred.');
