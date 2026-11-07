import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { isAbsolute, resolve, dirname } from 'node:path';
import { prepareLocalRuntime, runEmulatorEntry } from './local-runtime.mjs';
import { assertLocalEndpointsClosed } from './local-emulator-lifecycle.mjs';
import { retainLocalEmulatorLogs } from './local-emulator-log-evidence.mjs';

const output = process.env.SGM_LOCAL_FLOW_OUTPUT;
assert(typeof output === 'string' && isAbsolute(output) && !existsSync(output) && !existsSync(output + '.artifacts'));
const runtime = prepareLocalRuntime();
let report, failure, endpoints;
try {
  await assertLocalEndpointsClosed([9099, 8080, 9000, 5001]);
  runtime.env.SGM_LOCAL_FLOW_OUTPUT = resolve(runtime.temp, 'child-invitation-attempt.json');
  runEmulatorEntry(runtime, 'local-child-invitation-suite.mjs');
  report = JSON.parse(readFileSync(runtime.env.SGM_LOCAL_FLOW_OUTPUT));
  assert.equal(report.runId, runtime.env.SGM_LOCAL_RUN_ID);
  assert.equal(report.steps.length, 18); assert(report.steps.every(step => step.status === 'passed'));
  assert.equal(report.childAccountProvisioned, true); assert.equal(report.parentApprovalSeparate, true);
  assert.equal(report.adminClientClosed, true);
} catch (error) { failure = error; }
finally {
  try {
    mkdirSync(dirname(output), { recursive: true }); mkdirSync(output + '.artifacts');
    retainLocalEmulatorLogs(runtime.temp, output + '.artifacts', runtime.env.SGM_QA_PASSWORD);
    if (existsSync(runtime.env.SGM_LOCAL_FLOW_OUTPUT)) writeFileSync(output + '.artifacts/attempt.json',
      readFileSync(runtime.env.SGM_LOCAL_FLOW_OUTPUT), { flag: 'wx', mode: 0o600 });
  } catch (error) { failure = failure ? new AggregateError([failure, error], 'Trial and evidence retention failed') : error; }
  try {
    runtime.cleanup(); assert(!existsSync(runtime.temp));
    endpoints = await assertLocalEndpointsClosed([9099, 8080, 9000, 5001]);
    writeFileSync(output + '.artifacts/disposal.json', JSON.stringify({ projectId: 'demo-sgm-local-qa', runId: runtime.env.SGM_LOCAL_RUN_ID,
      scope: 'owned-runtime-disposal-not-flow-verification', trialPassed: !failure,
      isolatedEnvironmentDestroyed: true, emulatorEndpoints: endpoints }, null, 2) + '\n', { flag: 'wx' });
  } catch (error) { failure = failure ? new AggregateError([failure, error], 'Trial and disposal failed') : error; }
}
if (failure) throw failure;
writeFileSync(output, JSON.stringify({ ...report, emulatorCliExitedSuccessfully: true,
  isolatedEnvironmentDestroyed: true, emulatorEndpoints: endpoints }, null, 2) + '\n', { flag: 'wx' });
