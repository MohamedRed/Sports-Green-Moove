import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { isAbsolute } from 'node:path';
import { prepareLocalRuntime, runEmulatorEntry } from './local-runtime.mjs';

if (process.env.SGM_LOCAL_FLOW_OUTPUT) assert(!existsSync(process.env.SGM_LOCAL_FLOW_OUTPUT), 'Use a fresh evidence output');
assert(process.argv.slice(2).every((argument) => argument === '--browser'), 'Unknown guardian review test argument');
if (process.argv.includes('--browser')) {
  assert(isAbsolute(process.env.SGM_GUARDIAN_UI_OUTPUT || ''), 'Use an absolute screenshot directory');
  assert(!existsSync(process.env.SGM_GUARDIAN_UI_OUTPUT), 'Use a fresh screenshot directory');
}
const runtime = prepareLocalRuntime();
if (process.argv.includes('--browser')) {
  runtime.env.SGM_GUARDIAN_BROWSER_TEST = 'true';
  for (const key of ['PLAYWRIGHT_MODULE_PATH', 'PLAYWRIGHT_EXECUTABLE_PATH', 'SGM_GUARDIAN_UI_OUTPUT'])
    if (process.env[key]) runtime.env[key] = process.env[key];
}
try {
  runEmulatorEntry(runtime, 'local-guardian-review-suite.mjs');
  const result = JSON.parse(readFileSync(runtime.env.SGM_LOCAL_FLOW_OUTPUT, 'utf8'));
  assert.equal(result.runId, runtime.env.SGM_LOCAL_RUN_ID);
  assert.equal(result.projectId, 'demo-sgm-local-qa');
  assert.equal(result.checks.length, 16);
  assert(result.checks.every((item) => item.status === 'passed'));
  assert.equal(result.providerRequests, 0); assert.equal(result.productionWrites, false);
  if (process.argv.includes('--browser')) {
    assert.equal(result.browser.checks.length, 9);
    assert(result.browser.checks.every((item) => item.status === 'passed'));
    assert.equal(result.browser.externalRequests, 0);
  }
} finally { runtime.cleanup(); }
