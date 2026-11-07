import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { prepareLocalRuntime, runEmulatorEntry } from './local-runtime.mjs';

if (process.env.SGM_LOCAL_FLOW_OUTPUT) assert(!existsSync(process.env.SGM_LOCAL_FLOW_OUTPUT), 'Use a fresh evidence output');
const runtime = prepareLocalRuntime();
try {
  runEmulatorEntry(runtime, 'local-guardian-verification-suite.mjs');
  const result = JSON.parse(readFileSync(runtime.env.SGM_LOCAL_FLOW_OUTPUT, 'utf8'));
  assert.equal(result.runId, runtime.env.SGM_LOCAL_RUN_ID);
  assert.equal(result.projectId, 'demo-sgm-local-qa');
  assert.equal(result.checks.length, 20);
  assert(result.checks.every((item) => item.status === 'passed'));
  assert.equal(result.providerRequests, 0);
  assert.equal(result.teamChatImplemented, false);
  assert.equal(result.childEmergencyImplemented, false);
} finally { runtime.cleanup(); }
