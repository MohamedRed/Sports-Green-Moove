import assert from 'node:assert/strict';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';
import { prepareLocalRuntime, runEmulatorEntry } from './local-runtime.mjs';
import { assertLocalEndpointsClosed } from './local-emulator-lifecycle.mjs';

const output = process.env.SGM_LOCAL_FLOW_OUTPUT;
assert(isAbsolute(output ?? '') && !existsSync(output), 'A fresh absolute output path is required');
const runtime = prepareLocalRuntime(), ports = [9099, 8080, 9000, 5001];
const reportPath = resolve(runtime.temp, 'booking-notices.json');
let report, failure, endpoints, destroyed = false;
try {
  await assertLocalEndpointsClosed(ports);
  runtime.env.SGM_LOCAL_UI_SESSION_FILE = resolve(runtime.temp, 'session.json'); runtime.env.SGM_LOCAL_FLOW_OUTPUT = reportPath;
  runEmulatorEntry(runtime, 'local-booking-notices.mjs');
  report = JSON.parse(readFileSync(reportPath)); assert.equal(report.runId, runtime.env.SGM_LOCAL_RUN_ID);
  assert.equal(report.completed, true); assert.equal(report.steps.length, 12); assert.equal(report.adminClientClosed, true);
} catch (error) {
  failure = error; if (!report && existsSync(reportPath)) report = JSON.parse(readFileSync(reportPath));
} finally {
  try { runtime.cleanup(); destroyed = !existsSync(runtime.temp); assert(destroyed); endpoints = await assertLocalEndpointsClosed(ports); }
  catch (error) { failure = failure ? new AggregateError([failure, error], 'Trial and disposal failed') : error; }
}
if (report) writeFileSync(output, JSON.stringify({...report, completed: report.completed && !failure,
  isolatedEnvironmentDestroyed: destroyed, emulatorEndpoints: endpoints ?? null}, null, 2) + '\n', {flag: 'wx'});
if (failure) throw failure;
