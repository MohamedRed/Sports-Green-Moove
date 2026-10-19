import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { prepareLocalRuntime, runEmulatorEntry } from './local-runtime.mjs';

if (process.env.SGM_LOCAL_FLOW_OUTPUT) assert(!existsSync(process.env.SGM_LOCAL_FLOW_OUTPUT));
const runtime = prepareLocalRuntime();
try {
  runEmulatorEntry(runtime, 'local-emergency-fixture-suite.mjs');
  const report = JSON.parse(readFileSync(runtime.env.SGM_LOCAL_FLOW_OUTPUT));
  assert.equal(report.runId, runtime.env.SGM_LOCAL_RUN_ID); assert.equal(report.checks.length, 5);
  assert(report.checks.every((check) => check.status === 'passed')); assert.equal(report.fixtureCleanupVerified, true);
} finally { runtime.cleanup(); }
