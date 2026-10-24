import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { prepareLocalRuntime, runEmulatorEntry } from './local-runtime.mjs';

const runtime = prepareLocalRuntime();
try {
  runEmulatorEntry(runtime, 'local-trip-history-suite.mjs');
  const evidence = JSON.parse(readFileSync(runtime.env.SGM_LOCAL_FLOW_OUTPUT, 'utf8'));
  assert.equal(evidence.runId, runtime.env.SGM_LOCAL_RUN_ID);
  assert.equal(evidence.projectId, 'demo-sgm-local-qa');
  assert.equal(evidence.result.proposalCount, 13);
  assert.deepEqual(evidence.result.actorCounts, [13, 13, 13, 7]);
  assert.equal(evidence.result.beforeHash, evidence.result.afterHash);
} finally { runtime.cleanup(); }
