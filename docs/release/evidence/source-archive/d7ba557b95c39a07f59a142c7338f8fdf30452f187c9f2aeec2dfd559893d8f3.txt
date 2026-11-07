import assert from 'node:assert/strict';
import {existsSync, readFileSync, writeFileSync} from 'node:fs';
import {isAbsolute, resolve} from 'node:path';
import {prepareLocalRuntime, runEmulatorEntry} from './local-runtime.mjs';
import {assertLocalEndpointsClosed} from './local-emulator-lifecycle.mjs';

const output = process.env.SGM_LOCAL_FLOW_OUTPUT;
assert(isAbsolute(output ?? '') && !existsSync(output), 'Use a fresh absolute receipt path');
const runtime = prepareLocalRuntime(), path = resolve(runtime.temp, 'review-pagination.json'), ports = [9099, 8080, 9000, 5001];
let result, failure, endpoints, disposed = false;
try {
  await assertLocalEndpointsClosed(ports);
  runtime.env.SGM_LOCAL_FLOW_OUTPUT = path; runtime.env.SGM_LOCAL_UI_SESSION_FILE = resolve(runtime.temp, 'session.json');
  runEmulatorEntry(runtime, 'local-review-pagination.mjs');
  result = JSON.parse(readFileSync(path)); assert.equal(result.runId, runtime.env.SGM_LOCAL_RUN_ID);
  assert.equal(result.completed, true); assert.equal(result.steps.length, 8);
  assert.equal(result.adminClientClosed, true); assert.equal(result.firestoreClientTerminated, true);
} catch (error) {failure = error; if (existsSync(path)) result = JSON.parse(readFileSync(path));}
finally {
  try {runtime.cleanup(); disposed = !existsSync(runtime.temp); assert(disposed); endpoints = await assertLocalEndpointsClosed(ports);}
  catch (error) {failure = failure ? new AggregateError([failure, error]) : error;}
}
if (result) writeFileSync(output, JSON.stringify({...result, completed: result.completed && !failure,
  isolatedEnvironmentDestroyed: disposed, emulatorEndpoints: endpoints ?? null}, null, 2) + '\n', {flag: 'wx'});
if (failure) throw failure;
