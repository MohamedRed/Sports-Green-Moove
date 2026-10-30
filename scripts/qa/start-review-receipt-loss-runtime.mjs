import assert from 'node:assert/strict';
import {existsSync, readFileSync, rmSync, statSync, writeFileSync} from 'node:fs';
import {dirname, isAbsolute, resolve} from 'node:path';
import {prepareLocalRuntime, emulatorEntryArguments} from './local-runtime.mjs';
import {assertLocalEndpointsClosed} from './local-emulator-lifecycle.mjs';
import {superviseLocalProcess} from './supervised-local-process.mjs';

const handoff = process.argv[2];
assert(isAbsolute(handoff ?? '') && !existsSync(handoff));
assert.equal(statSync(dirname(handoff)).mode & 0o077, 0);
const ports = [5001, 5002, 8080, 9000, 9099];
await assertLocalEndpointsClosed(ports);
const controller = new AbortController();
const interrupt = () => controller.abort('SIGINT'), terminate = () => controller.abort('SIGTERM');
process.once('SIGINT', interrupt); process.once('SIGTERM', terminate);
let runtime;
try {
  runtime = prepareLocalRuntime();
  const path = resolve(runtime.temp, 'firebase.json'), config = JSON.parse(readFileSync(path));
  assert.deepEqual(config.emulators.functions, {host: '127.0.0.1', port: 5001});
  config.emulators.functions.port = 5002;
  writeFileSync(path, JSON.stringify(config, null, 2));
  writeFileSync(handoff, JSON.stringify({projectId: 'demo-sgm-local-qa', runId: runtime.env.SGM_LOCAL_RUN_ID,
    password: runtime.env.SGM_QA_PASSWORD}), {flag: 'wx', mode: 0o600});
  const result = await superviseLocalProcess({command: process.execPath,
    args: emulatorEntryArguments(runtime, 'keep-review-loss-emulators.mjs'), cwd: runtime.temp,
    env: runtime.env, signal: controller.signal});
  if (result.stopped) process.exitCode = controller.signal.reason === 'SIGINT' ? 130 : 143;
} finally {
  process.removeListener('SIGINT', interrupt); process.removeListener('SIGTERM', terminate);
  // The separate controller must close its facade before any private runtime data is removed.
  await assertLocalEndpointsClosed(ports);
  runtime?.cleanup(); rmSync(handoff, {force: true});
}
