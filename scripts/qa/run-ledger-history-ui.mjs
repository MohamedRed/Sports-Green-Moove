import assert from 'node:assert/strict';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
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
  runEmulatorEntry(runtime, 'ledger-history-ui-suite.mjs');
  const result = JSON.parse(readFileSync(resolve(output, 'results.json')));
  assert.equal(result.runId, runtime.env.SGM_LOCAL_RUN_ID); assert.equal(result.connectedCases, 1);
  assert.equal(result.localPackagesRemoved, true); assert.equal(result.adminClientClosed, true);
} finally {
  runtime.cleanup(); await assertLocalEndpointsClosed([9099, 8080, 9000, 5001]);
  if (existsSync(output)) writeFileSync(resolve(output, 'environment-cleanup.json'), JSON.stringify({
    scope: 'owned-local-ledger-ui-environment-disposal-not-device-host-shutdown',
    runId: runtime.env.SGM_LOCAL_RUN_ID, runtimeDirectoryAbsent: !existsSync(runtime.temp),
    endpointsVerifiedClosed: [9099, 8080, 9000, 5001], checkedAt: new Date().toISOString(),
  }, null, 2) + '\n', {flag: 'wx'});
}
