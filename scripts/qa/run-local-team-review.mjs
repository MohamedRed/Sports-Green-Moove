import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { isAbsolute } from 'node:path';
import { prepareLocalRuntime, runEmulatorEntry } from './local-runtime.mjs';

assert(process.argv.slice(2).every((argument) => argument === '--browser'), 'Unknown team review argument');
assert(!process.env.SGM_LOCAL_FLOW_OUTPUT || !existsSync(process.env.SGM_LOCAL_FLOW_OUTPUT), 'Use a fresh evidence path');
if (process.argv.includes('--browser')) {
  assert(isAbsolute(process.env.SGM_TEAM_REVIEW_UI_OUTPUT || '') && !existsSync(process.env.SGM_TEAM_REVIEW_UI_OUTPUT), 'Use a fresh absolute capture directory');
}
const runtime = prepareLocalRuntime();
if (process.argv.includes('--browser')) {
  runtime.env.SGM_TEAM_REVIEW_BROWSER_TEST = 'true';
  for (const key of ['PLAYWRIGHT_MODULE_PATH', 'PLAYWRIGHT_EXECUTABLE_PATH', 'SGM_TEAM_REVIEW_UI_OUTPUT'])
    if (process.env[key]) runtime.env[key] = process.env[key];
}
try {
  runEmulatorEntry(runtime, 'local-team-review-suite.mjs');
  const result = JSON.parse(readFileSync(runtime.env.SGM_LOCAL_FLOW_OUTPUT, 'utf8'));
  assert.equal(result.runId, runtime.env.SGM_LOCAL_RUN_ID); assert.equal(result.projectId, 'demo-sgm-local-qa');
  assert.equal(result.checks.length, 8); assert(result.checks.every((row) => row.status === 'passed'));
  assert.equal(result.fixtureCleanupVerified, true); assert.equal(result.productionWrites, false); assert.equal(result.providerRequests, 0);
  if (process.argv.includes('--browser')) {
    assert.equal(result.browser.checks.length, 10); assert(result.browser.checks.every((row) => row.status === 'passed'));
    assert.equal(result.browser.externalRequests, 0);
  }
} finally { runtime.cleanup(); }
