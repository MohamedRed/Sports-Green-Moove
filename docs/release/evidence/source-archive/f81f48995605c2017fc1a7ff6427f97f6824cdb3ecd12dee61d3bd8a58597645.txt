import assert from 'node:assert/strict';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, isAbsolute } from 'node:path';
import { prepareLocalRuntime, runEmulatorEntry } from './local-runtime.mjs';
import { assertLocalEndpointsClosed } from './local-emulator-lifecycle.mjs';

const output = process.env.SGM_LOCAL_FLOW_OUTPUT;
assert(typeof output === 'string' && isAbsolute(output) && !existsSync(output));
const runtime = prepareLocalRuntime(), ports = [9099, 8080, 9000, 5001];
let report, failure, endpoints;
try {
  await assertLocalEndpointsClosed(ports);
  runtime.env.SGM_LOCAL_UI_SESSION_FILE = resolve(runtime.temp, 'fixture-ui-session.json');
  runtime.env.SGM_LOCAL_FLOW_OUTPUT = resolve(runtime.temp, 'fixture-attempt.json');
  runEmulatorEntry(runtime, 'local-emergency-identity-fixture-suite.mjs');
  report = JSON.parse(readFileSync(runtime.env.SGM_LOCAL_FLOW_OUTPUT));
  assert.equal(report.runId, runtime.env.SGM_LOCAL_RUN_ID);
  assert.equal(report.nativeUiExecuted, false); assert.equal(report.adminClientClosed, true);
  assert.equal(report.isolation.baselineCollectionCount, 15);
  assert.equal(report.isolation.baselineRecordsPreserved, true); assert.equal(report.isolation.claimsUnchanged, true);
} catch (error) { failure = error; }
finally {
  try { runtime.cleanup(); assert(!existsSync(runtime.temp)); endpoints = await assertLocalEndpointsClosed(ports); }
  catch (error) { failure = failure ? new AggregateError([failure, error], 'Fixture and disposal failed') : error; }
}
if (failure) throw failure;
writeFileSync(output, JSON.stringify({ ...report, isolatedEnvironmentDestroyed: true, emulatorCliExitedSuccessfully: true,
  emulatorEndpoints: endpoints }, null, 2) + '\n', { flag: 'wx' });
