import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { prepareLocalRuntime, runEmulatorEntry } from './local-runtime.mjs';

if (process.env.SGM_LOCAL_FLOW_OUTPUT) assert(!existsSync(process.env.SGM_LOCAL_FLOW_OUTPUT), 'Choose fresh team history evidence');
const runtime = prepareLocalRuntime();
try {
  runEmulatorEntry(runtime, 'local-team-history-suite.mjs');
  const result = JSON.parse(readFileSync(runtime.env.SGM_LOCAL_FLOW_OUTPUT, 'utf8'));
  assert.equal(result.runId, runtime.env.SGM_LOCAL_RUN_ID); assert.equal(result.checks.length, 14);
  assert(result.checks.every((check) => check.status === 'passed'));
  assert.equal(result.teamChatImplemented, false); assert.equal(result.productionWrites, false);
} finally { runtime.cleanup(); }
