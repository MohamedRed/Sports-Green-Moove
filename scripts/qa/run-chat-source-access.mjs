import assert from 'node:assert/strict';
import {existsSync, readFileSync, writeFileSync} from 'node:fs';
import {isAbsolute, resolve} from 'node:path';
import {prepareLocalRuntime, runEmulatorEntry} from './local-runtime.mjs';
import {assertLocalEndpointsClosed} from './local-emulator-lifecycle.mjs';

const baseline = process.argv[2] === '--original-rules';
assert(process.argv.length === (baseline ? 3 : 2), 'Only the explicit original-rules reproduction mode is supported');
const output = process.env.SGM_LOCAL_FLOW_OUTPUT, ports = [9099, 8080, 9000, 5001];
assert(isAbsolute(output ?? '') && !existsSync(output), 'Use a fresh absolute result path');
await assertLocalEndpointsClosed(ports);
const runtime = prepareLocalRuntime(), path = resolve(runtime.temp, 'chat-source-access.json');
let result, failure, endpoints, disposed = false;
try {
  runtime.env.SGM_LOCAL_FLOW_OUTPUT = path; runtime.env.SGM_CHAT_SOURCE_BASELINE = String(baseline);
  runEmulatorEntry(runtime, 'chat-source-access-suite.mjs');
  result = JSON.parse(readFileSync(path)); assert.equal(result.runId, runtime.env.SGM_LOCAL_RUN_ID);
  assert.equal(result.completed, true); assert.equal(result.checks.length, 9); assert.equal(result.baseline, baseline);
  assert(result.adminClientClosed && result.firestoreClientTerminated);
} catch (error) {failure = error; if (existsSync(path)) result = JSON.parse(readFileSync(path));}
finally {
  try {runtime.cleanup(); disposed = !existsSync(runtime.temp); assert(disposed); endpoints = await assertLocalEndpointsClosed(ports);}
  catch (error) {failure = failure ? new AggregateError([failure, error]) : error;}
}
if (result) writeFileSync(output, JSON.stringify({...result, completed: result.completed && !failure,
  isolatedEnvironmentDestroyed: disposed, endpoints: endpoints ?? null}, null, 2) + '\n', {flag: 'wx'});
if (failure) throw failure;
