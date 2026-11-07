import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { prepareLocalRuntime, runEmulatorEntry } from './local-runtime.mjs';
import { assertLocalEndpointsClosed } from './local-emulator-lifecycle.mjs';

if (process.env.SGM_LOCAL_FLOW_OUTPUT) assert(!existsSync(process.env.SGM_LOCAL_FLOW_OUTPUT));
const runtime = prepareLocalRuntime();
try {
  await assertLocalEndpointsClosed([9099, 8080, 9000, 5001]);
  runEmulatorEntry(runtime, 'search-booking-notice-services-suite.mjs');
  const report = JSON.parse(readFileSync(runtime.env.SGM_LOCAL_FLOW_OUTPUT));
  assert.equal(report.runId, runtime.env.SGM_LOCAL_RUN_ID); assert.equal(report.completed, true);
  assert.equal(report.checks.length, 6); assert(report.checks.every(row => row.status === 'passed'));
  assert.equal(report.adminClientClosed, true); assert.equal(report.firestoreClientTerminated, true);
  assert.equal(report.providerRequests, 0);
} finally {runtime.cleanup(); await assertLocalEndpointsClosed([9099, 8080, 9000, 5001]);}
