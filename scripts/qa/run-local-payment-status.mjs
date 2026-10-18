import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { prepareLocalRuntime, runEmulatorEntry } from './local-runtime.mjs';

if (process.env.SGM_LOCAL_FLOW_OUTPUT) assert(!existsSync(process.env.SGM_LOCAL_FLOW_OUTPUT), 'Use a fresh evidence output');
const runtime = prepareLocalRuntime();
try {
  runEmulatorEntry(runtime, 'local-payment-status-suite.mjs');
  const result = JSON.parse(readFileSync(runtime.env.SGM_LOCAL_FLOW_OUTPUT, 'utf8'));
  assert.equal(result.runId, runtime.env.SGM_LOCAL_RUN_ID);
  assert.equal(result.projectId, 'demo-sgm-local-qa');
  assert.equal(result.checks.length, 11);
  assert(result.checks.every((item) => item.status === 'passed'));
  assert.equal(result.steps[0].status, 'passed');
  assert.equal(result.providerRequests, 0);
} finally { runtime.cleanup(); }
