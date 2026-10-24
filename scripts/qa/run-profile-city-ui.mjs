import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';
import { prepareLocalRuntime, runEmulatorEntry } from './local-runtime.mjs';
import { assertLocalEndpointsClosed } from './local-emulator-lifecycle.mjs';

const serial = process.env.SGM_LOCAL_ANDROID_SERIAL, output = process.env.SGM_LOCAL_UI_OUTPUT;
assert(/^emulator-\d+$/.test(serial ?? ''));
assert(isAbsolute(output ?? '') && !existsSync(output));
const runtime = prepareLocalRuntime();
Object.assign(runtime.env, { SGM_LOCAL_ANDROID_SERIAL: serial, SGM_LOCAL_UI_OUTPUT: output,
  SGM_LOCAL_DISPOSABLE_EMULATOR: 'true', SGM_LOCAL_UI_SESSION_FILE: resolve(runtime.temp, 'private-session.json') });
try {
  runEmulatorEntry(runtime, 'profile-city-ui-suite.mjs');
  const result = JSON.parse(readFileSync(resolve(output, 'results.json')));
  assert.equal(result.runId, runtime.env.SGM_LOCAL_RUN_ID);
  assert.equal(result.connectedCases, 1); assert.equal(result.componentCases, 3);
  assert.equal(result.localPackagesRemoved, true); assert.equal(result.adminClientClosed, true);
} finally { runtime.cleanup(); await assertLocalEndpointsClosed([9099, 8080, 9000, 5001]); }
