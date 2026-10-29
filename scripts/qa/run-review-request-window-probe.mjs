import assert from 'node:assert/strict';
import {existsSync, readFileSync, writeFileSync} from 'node:fs';
import {isAbsolute, resolve} from 'node:path';
import {prepareLocalRuntime, runEmulatorEntry} from './local-runtime.mjs';
import {assertLocalEndpointsClosed} from './local-emulator-lifecycle.mjs';

const output = process.env.SGM_LOCAL_FLOW_OUTPUT;
assert(isAbsolute(output ?? '') && !existsSync(output));
const runtime = prepareLocalRuntime(), path = resolve(runtime.temp, 'review-window.json');
let report, endpoints, disposed = false;
try {
  await assertLocalEndpointsClosed([9099, 8080, 9000, 5001]);
  runtime.env.SGM_LOCAL_FLOW_OUTPUT = path; runtime.env.SGM_LOCAL_UI_SESSION_FILE = resolve(runtime.temp, 'session.json');
  runEmulatorEntry(runtime, 'review-request-window-probe.mjs');
  report = JSON.parse(readFileSync(path)); assert.equal(report.runId, runtime.env.SGM_LOCAL_RUN_ID);
} finally {runtime.cleanup(); disposed = !existsSync(runtime.temp); endpoints = await assertLocalEndpointsClosed([9099, 8080, 9000, 5001]);}
assert(disposed);
writeFileSync(output, JSON.stringify({...report, isolatedEnvironmentDestroyed: disposed, emulatorEndpoints: endpoints}, null, 2) + '\n', {flag: 'wx'});
