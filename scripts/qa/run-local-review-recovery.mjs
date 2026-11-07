import assert from 'node:assert/strict';
import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {isAbsolute, resolve} from 'node:path';
import {prepareLocalRuntime, runEmulatorEntry} from './local-runtime.mjs';
import {assertLocalEndpointsClosed} from './local-emulator-lifecycle.mjs';
import {retainLocalEmulatorLogs} from './local-emulator-log-evidence.mjs';

const output = process.env.SGM_LOCAL_FLOW_OUTPUT, ports = [9099, 8080, 9000, 5001];
assert(isAbsolute(output ?? '') && !existsSync(output) && !existsSync(output + '.artifacts'), 'Use fresh absolute evidence paths');
const runtime = prepareLocalRuntime(), path = resolve(runtime.temp, 'review-recovery.json');
let result, failure, endpoints, disposed = false;
try {
  await assertLocalEndpointsClosed(ports);
  runtime.env.SGM_LOCAL_FLOW_OUTPUT = path; runtime.env.SGM_LOCAL_UI_SESSION_FILE = resolve(runtime.temp, 'session.json');
  runEmulatorEntry(runtime, 'local-review-recovery.mjs');
  result = JSON.parse(readFileSync(path)); assert.equal(result.runId, runtime.env.SGM_LOCAL_RUN_ID);
  assert.equal(result.completed, true); assert.equal(result.checks.length, 8);
  assert(result.checks.every(row => row.status === 'passed'));
  assert.equal(result.adminClientClosed, true); assert.equal(result.firestoreClientTerminated, true);
} catch (error) {failure = error; if (existsSync(path)) result = JSON.parse(readFileSync(path));}
finally {
  try {mkdirSync(output + '.artifacts', {mode: 0o700}); retainLocalEmulatorLogs(runtime.temp, output + '.artifacts', runtime.env.SGM_QA_PASSWORD);}
  catch (error) {failure = failure ? new AggregateError([failure, error], 'Trial and diagnostic retention failed') : error;}
  try {runtime.cleanup(); disposed = !existsSync(runtime.temp); assert(disposed); endpoints = await assertLocalEndpointsClosed(ports);}
  catch (error) {failure = failure ? new AggregateError([failure, error], 'Trial and disposal failed') : error;}
}
if (result) writeFileSync(output, JSON.stringify({...result, completed: result.completed && !failure,
  isolatedEnvironmentDestroyed: disposed, emulatorEndpoints: endpoints ?? null}, null, 2) + '\n', {flag: 'wx', mode: 0o600});
if (failure) throw failure;
