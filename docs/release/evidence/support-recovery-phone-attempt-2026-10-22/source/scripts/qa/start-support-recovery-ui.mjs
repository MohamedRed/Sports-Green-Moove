import assert from 'node:assert/strict';
import { existsSync, rmSync } from 'node:fs';
import { isAbsolute } from 'node:path';
import { prepareLocalRuntime, emulatorEntryArguments } from './local-runtime.mjs';
import { superviseLocalProcess } from './supervised-local-process.mjs';
import { installSupportResponseGate } from './install-support-response-gate.mjs';

const path = process.env.SGM_LOCAL_UI_SESSION_FILE, output = process.argv[2];
assert(path && isAbsolute(path) && !existsSync(path)); assert.equal(process.argv.length, 3);
const controller = new AbortController(), interrupt = () => controller.abort('SIGINT'), terminate = () => controller.abort('SIGTERM');
process.on('SIGINT', interrupt); process.on('SIGTERM', terminate);
let runtime;
try {
  runtime = prepareLocalRuntime(); runtime.env.SGM_LOCAL_UI_SESSION_FILE = path;
  const config = installSupportResponseGate(runtime, output);
  console.log(JSON.stringify({ scope: 'isolated-support-phone-response-gate-not-flow-proof', runId: config.runId, gateOutput: output }));
  const result = await superviseLocalProcess({ command: process.execPath, args: emulatorEntryArguments(runtime, 'local-ui-session.mjs'),
    cwd: runtime.temp, env: runtime.env, signal: controller.signal });
  if (result.stopped) process.exitCode = controller.signal.reason === 'SIGINT' ? 130 : 143;
} finally {
  rmSync(path, { force: true }); runtime?.cleanup();
  process.removeListener('SIGINT', interrupt); process.removeListener('SIGTERM', terminate);
}
