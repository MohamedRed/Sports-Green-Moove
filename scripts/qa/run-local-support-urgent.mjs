import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { prepareLocalRuntime, runEmulatorEntry } from './local-runtime.mjs';

assert.equal(process.argv.length, 2, 'No external environment or provider options are supported');
if (process.env.SGM_LOCAL_FLOW_OUTPUT) assert(!existsSync(process.env.SGM_LOCAL_FLOW_OUTPUT), 'Use fresh evidence output');
const runtime = prepareLocalRuntime();
try {
  runEmulatorEntry(runtime, 'local-support-urgent-suite.mjs');
  const report = JSON.parse(readFileSync(runtime.env.SGM_LOCAL_FLOW_OUTPUT));
  assert.equal(report.projectId, 'demo-sgm-local-qa'); assert.equal(report.runId, runtime.env.SGM_LOCAL_RUN_ID);
  assert.equal(report.completed, true); assert.equal(report.checks.length, 11);
  assert(report.checks.every(row => row.status === 'passed')); assert.equal(report.realEmailSent, false);
} finally { runtime.cleanup(); }
