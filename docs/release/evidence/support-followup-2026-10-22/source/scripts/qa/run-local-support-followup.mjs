import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { isAbsolute } from 'node:path';
import { prepareLocalRuntime, runEmulatorEntry } from './local-runtime.mjs';

if (process.env.SGM_LOCAL_FLOW_OUTPUT) assert(!existsSync(process.env.SGM_LOCAL_FLOW_OUTPUT), 'Use a fresh evidence output');
const runtime = prepareLocalRuntime();
try {
  assert(process.argv.slice(2).every(value => value === '--browser'), 'Unknown support follow-up argument');
  if (process.argv.includes('--browser')) {
    assert(isAbsolute(process.env.SGM_SUPPORT_UI_OUTPUT || '') && !existsSync(process.env.SGM_SUPPORT_UI_OUTPUT), 'Use a fresh absolute screenshot directory');
    runtime.env.SGM_SUPPORT_BROWSER_TEST = 'true';
    for (const key of ['PLAYWRIGHT_MODULE_PATH', 'PLAYWRIGHT_EXECUTABLE_PATH', 'SGM_SUPPORT_UI_OUTPUT'])
      if (process.env[key]) runtime.env[key] = process.env[key];
  }
  runEmulatorEntry(runtime, 'local-support-followup-suite.mjs');
  const report = JSON.parse(readFileSync(runtime.env.SGM_LOCAL_FLOW_OUTPUT));
  assert.equal(report.projectId, 'demo-sgm-local-qa'); assert.equal(report.runId, runtime.env.SGM_LOCAL_RUN_ID);
  assert.equal(report.completed, true); assert.equal(report.checks.length, 13); assert(report.checks.every(row => row.status === 'passed'));
  if (process.argv.includes('--browser')) { assert.equal(report.browser.checks.length, 5); assert(report.browser.checks.every(row => row.status === 'passed')); }
} finally { runtime.cleanup(); }
