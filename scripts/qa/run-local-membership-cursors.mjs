import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { prepareLocalRuntime, runEmulatorEntry } from './local-runtime.mjs';

if (process.env.SGM_LOCAL_FLOW_OUTPUT) assert(!existsSync(process.env.SGM_LOCAL_FLOW_OUTPUT), 'Choose a fresh cursor evidence output');
const runtime = prepareLocalRuntime();
try {
  runEmulatorEntry(runtime, 'local-membership-cursor-suite.mjs');
  const report = JSON.parse(readFileSync(runtime.env.SGM_LOCAL_FLOW_OUTPUT, 'utf8'));
  assert.equal(report.runId, runtime.env.SGM_LOCAL_RUN_ID); assert.equal(report.steps.length, 8);
  assert(report.steps.every((step) => step.status === 'passed')); assert.equal(report.productionWrites, false);
  assert.equal(report.providerRequests, 0); assert.equal(report.nativeUiExecuted, false);
} finally { runtime.cleanup(); }
