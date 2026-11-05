import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { prepareLocalRuntime, runEmulatorEntry } from './local-runtime.mjs';
import { assertLocalEndpointsClosed } from './local-emulator-lifecycle.mjs';

if (process.env.SGM_LOCAL_FLOW_OUTPUT) assert(!existsSync(process.env.SGM_LOCAL_FLOW_OUTPUT), 'Use a fresh output');
const runtime = prepareLocalRuntime();
try {
  runEmulatorEntry(runtime, 'profile-city-services-suite.mjs');
  const result = JSON.parse(readFileSync(runtime.env.SGM_LOCAL_FLOW_OUTPUT));
  assert.equal(result.runId, runtime.env.SGM_LOCAL_RUN_ID);
  assert.equal(result.checks.length, 10); assert(result.checks.every(check => check.status === 'passed'));
  assert.equal(result.adminClientClosed, true); assert.equal(result.firestoreClientTerminated, true);
} finally { runtime.cleanup(); await assertLocalEndpointsClosed([9099, 8080, 9000, 5001]); }
