import assert from 'node:assert/strict';
import { existsSync, lstatSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { isAbsolute, resolve, dirname } from 'node:path';
import { prepareLocalRuntime, emulatorEntryArguments } from './local-runtime.mjs';
import { superviseLocalProcess } from './supervised-local-process.mjs';
import { assertLocalEndpointsClosed } from './local-emulator-lifecycle.mjs';

const [output, phoneSession] = process.argv.slice(2);
assert([3, 4].includes(process.argv.length));
assert(isAbsolute(output ?? '') && !existsSync(output));
if (phoneSession) {
  assert(isAbsolute(phoneSession) && !existsSync(phoneSession) && !existsSync(phoneSession + '.signup') &&
    !phoneSession.startsWith(resolve(output) + '/'));
  const parent = lstatSync(dirname(phoneSession));
  assert(parent.isDirectory() && !parent.isSymbolicLink() && parent.uid === process.getuid() && (parent.mode & 0o077) === 0);
}
mkdirSync(output, { mode: 0o700 });
const controller = new AbortController();
const interrupt = () => controller.abort('SIGINT'), terminate = () => controller.abort('SIGTERM');
process.once('SIGINT', interrupt); process.once('SIGTERM', terminate);
let runtime, processGroupExited = false, attempted = false, failure;
try {
  await assertLocalEndpointsClosed([9099, 8080, 9000, 5001, 4185]);
  runtime = prepareLocalRuntime();
  runtime.env.SGM_INVITATION_BROWSER_OUTPUT = output;
  if (phoneSession) runtime.env.SGM_INVITATION_PHONE_SESSION_FILE = phoneSession;
  attempted = true;
  const result = await superviseLocalProcess({ command: process.execPath,
    args: emulatorEntryArguments(runtime, 'child-invitation-browser-runtime.mjs'), cwd: runtime.temp,
    env: runtime.env, signal: controller.signal, stopGraceMs: 20_000 });
  processGroupExited = result.groupExitVerified;
} catch (error) { processGroupExited = error.groupExitVerified === true; failure = true; }
finally {
  let emulatorEndpoints;
  if (!attempted || processGroupExited) {
    try {
      if (phoneSession) {rmSync(phoneSession, {force: true}); rmSync(phoneSession + '.signup', {force: true});}
      runtime?.cleanup(); emulatorEndpoints = await assertLocalEndpointsClosed([9099, 8080, 9000, 5001, 4185]);
    }
    catch { failure = true; }
  }
  writeFileSync(resolve(output, 'disposal.json'), JSON.stringify({ scope: 'owned-runtime-disposal-not-browser-proof',
    projectId: 'demo-sgm-local-qa', runId: runtime?.env.SGM_LOCAL_RUN_ID, closedAt: new Date().toISOString(),
    processGroupExited, isolatedEnvironmentDestroyed: runtime ? !existsSync(runtime.temp) : true,
    emulatorEndpoints, ...(phoneSession ? {privatePhoneSessionAbsent: !existsSync(phoneSession),
      privateSignupInputAbsent: !existsSync(phoneSession + '.signup')} : {}), failed: Boolean(failure) }, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  process.removeListener('SIGINT', interrupt); process.removeListener('SIGTERM', terminate);
}
if (failure) throw new Error('Invitation browser runtime disposal failed; preserve its receipt.');
