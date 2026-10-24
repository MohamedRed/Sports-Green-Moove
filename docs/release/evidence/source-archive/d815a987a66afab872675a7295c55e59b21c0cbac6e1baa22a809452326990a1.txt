import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { prepareLocalRuntime, runEmulatorEntry } from './local-runtime.mjs';

if (process.env.SGM_LOCAL_FLOW_OUTPUT) assert(!existsSync(process.env.SGM_LOCAL_FLOW_OUTPUT), 'Choose a fresh evidence output');
const runtime = prepareLocalRuntime();
try {
  runEmulatorEntry(runtime, 'local-team-native-fixture-suite.mjs');
  const result = JSON.parse(readFileSync(runtime.env.SGM_LOCAL_FLOW_OUTPUT, 'utf8'));
  assert.equal(result.runId, runtime.env.SGM_LOCAL_RUN_ID); assert.equal(result.testCount, 6);
  assert(result.steps.every((step) => step.status === 'passed')); assert.equal(result.nativeUiExecuted, false);
  assert.equal(result.isolatedFixtureCleanupVerified, true);
} finally { runtime.cleanup(); }
