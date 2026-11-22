import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { prepareLocalRuntime, runEmulatorEntry } from './local-runtime.mjs';

if (process.env.SGM_LOCAL_FLOW_OUTPUT) assert(!existsSync(process.env.SGM_LOCAL_FLOW_OUTPUT), 'Use a fresh evidence output');
const runtime = prepareLocalRuntime();
try {
  runEmulatorEntry(runtime, 'local-guardian-parent-suite.mjs');
  const result = JSON.parse(readFileSync(runtime.env.SGM_LOCAL_FLOW_OUTPUT, 'utf8'));
  assert.equal(result.runId, runtime.env.SGM_LOCAL_RUN_ID); assert.equal(result.checks.length, 13);
  assert(result.checks.every((check) => check.status === 'passed'));
  assert.equal(result.providerRequests, 0); assert.equal(result.nativeUiExecuted, false);
} finally { runtime.cleanup(); }
