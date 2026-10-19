import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { isAbsolute, resolve, dirname } from 'node:path';
import { prepareLocalRuntime, runEmulatorEntry, root } from './local-runtime.mjs';
import { assertLocalEndpointsClosed } from './local-emulator-lifecycle.mjs';
import { retainLocalEmulatorLogs } from './local-emulator-log-evidence.mjs';

const runtime = prepareLocalRuntime();
const output = process.env.SGM_LOCAL_FLOW_OUTPUT || resolve(root, 'android/app/build/outputs/local-service-evidence', runtime.env.SGM_LOCAL_RUN_ID + '.json');
let report, failure, endpoints;
try {
  assert(isAbsolute(output) && !existsSync(output) && !existsSync(output + '.artifacts'));
  mkdirSync(dirname(output), { recursive: true });
  await assertLocalEndpointsClosed([9099, 8080, 9000, 5001]);
  runtime.env.SGM_LOCAL_FLOW_OUTPUT = resolve(runtime.temp, 'vehicle-map-app-results.json');
  runEmulatorEntry(runtime, 'local-vehicle-map-services.mjs');
  report = JSON.parse(readFileSync(runtime.env.SGM_LOCAL_FLOW_OUTPUT));
  assert.equal(report.runId, runtime.env.SGM_LOCAL_RUN_ID);
} catch (error) { failure = error; }
finally {
  try {
    mkdirSync(output + '.artifacts');
    retainLocalEmulatorLogs(runtime.temp, output + '.artifacts', runtime.env.SGM_QA_PASSWORD);
    if (existsSync(runtime.env.SGM_LOCAL_FLOW_OUTPUT)) writeFileSync(output + '.artifacts/candidate.json',
      readFileSync(runtime.env.SGM_LOCAL_FLOW_OUTPUT), { flag: 'wx', mode: 0o600 });
  } catch { console.warn('Read-only diagnostics unavailable; original outcome is unchanged.'); }
  try {
    runtime.cleanup(); assert(!existsSync(runtime.temp));
    endpoints = await assertLocalEndpointsClosed([9099, 8080, 9000, 5001]);
  } catch (error) { failure = failure ? new AggregateError([failure, error], 'Trial and cleanup failed') : error; }
}
if (failure) throw failure;
writeFileSync(output, JSON.stringify({ ...report, emulatorCliExitedSuccessfully: true,
  isolatedEnvironmentDestroyed: true, emulatorEndpoints: endpoints }, null, 2) + '\n', { flag: 'wx' });
