import assert from 'node:assert/strict';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';
import { prepareLocalRuntime, runEmulatorEntry } from './local-runtime.mjs';
import { assertLocalEndpointsClosed } from './local-emulator-lifecycle.mjs';

const output = process.env.SGM_LOCAL_FLOW_OUTPUT;
assert(isAbsolute(output ?? '') && !existsSync(output), 'A fresh absolute output is required');
const ports = [9099, 8080, 9000, 5001], runtime = prepareLocalRuntime();
const path = resolve(runtime.temp, 'notification-read-services.json');
let report, failure, endpoints, destroyed = false;
try {
  await assertLocalEndpointsClosed(ports);
  Object.assign(runtime.env, {SGM_LOCAL_UI_SESSION_FILE: resolve(runtime.temp, 'session.json'), SGM_LOCAL_FLOW_OUTPUT: path});
  runEmulatorEntry(runtime, 'local-notification-read-services.mjs');
  report = JSON.parse(readFileSync(path)); assert.equal(report.runId, runtime.env.SGM_LOCAL_RUN_ID);
  assert.equal(report.completed, true); assert.equal(report.checks.length, 4); assert(report.checks.every(row => row.status === 'passed'));
  assert.equal(report.adminClientClosed, true); assert.equal(report.nativeUiExecuted, false);
} catch (error) { failure = error; }
finally {
  try { runtime.cleanup(); destroyed = !existsSync(runtime.temp); assert(destroyed); endpoints = await assertLocalEndpointsClosed(ports); }
  catch (error) { failure = failure ? new AggregateError([failure, error], 'Trial and disposal failed') : error; }
}
if (report) writeFileSync(output, JSON.stringify({...report, completed: report.completed && !failure,
  isolatedEnvironmentDestroyed: destroyed, emulatorEndpoints: endpoints}, null, 2) + '\n', {flag: 'wx'});
if (failure) throw failure;
