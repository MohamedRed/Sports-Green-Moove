import assert from 'node:assert/strict';
import {existsSync, readFileSync, writeFileSync} from 'node:fs';
import {prepareLocalRuntime, runEmulatorEntry} from './local-runtime.mjs';
import {assertLocalEndpointsClosed} from './local-emulator-lifecycle.mjs';

assert.equal(process.argv.length, 2, 'No provider or external environment options are supported');
if (process.env.SGM_LOCAL_FLOW_OUTPUT) assert(!existsSync(process.env.SGM_LOCAL_FLOW_OUTPUT), 'Use fresh evidence output');
const runtime = prepareLocalRuntime();
let commandCompleted = false;
try {
  runEmulatorEntry(runtime, 'local-child-booking-receipt.mjs');
  commandCompleted = true;
  const report = JSON.parse(readFileSync(runtime.env.SGM_LOCAL_FLOW_OUTPUT));
  assert.equal(report.projectId, 'demo-sgm-local-qa'); assert.equal(report.runId, runtime.env.SGM_LOCAL_RUN_ID);
  assert.equal(report.completed, true); assert.equal(report.checks.length, 7);
  assert(report.checks.every(row => row.status === 'passed'));
  assert.equal(report.adminClientClosed, true); assert.equal(report.firestoreClientTerminated, true);
} finally {
  runtime.cleanup(); await assertLocalEndpointsClosed([9099, 8080, 9000, 5001]);
  if (process.env.SGM_LOCAL_FLOW_OUTPUT) writeFileSync(process.env.SGM_LOCAL_FLOW_OUTPUT + '.cleanup.json', JSON.stringify({
    scope: 'emulator-command-exit-and-local-disposal-not-device-proof', observedAt: new Date().toISOString(),
    commandCompleted, runtimeAbsent: !existsSync(runtime.temp), localEndpointsClosed: true,
    ports: [9099, 8080, 9000, 5001], productionWrites: false,
  }, null, 2) + '\n', {flag: 'wx', mode: 0o600});
}
