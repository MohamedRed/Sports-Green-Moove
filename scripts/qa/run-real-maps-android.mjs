import assert from 'node:assert/strict';
import { mkdirSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, isAbsolute } from 'node:path';
import { prepareLocalRuntime } from './local-runtime.mjs';
import { disposableAndroidShell } from './disposable-android-shell.mjs';
import { androidMapsPrerequisites } from './android-maps-prerequisites.mjs';
import { startRealMapsBroker } from './real-maps-broker.mjs';
import { attachRealMapsBroker, runMapUiEmulators } from './real-maps-runtime.mjs';
import { assertRealMapsUiProviderEvidence } from './real-maps-ui-evidence.mjs';
import { assertFramedRealMapDisplay } from './real-map-display-evidence.mjs';
import { setInstallBlocked } from './disposable-installations.mjs';

assert.deepEqual(process.argv.slice(2), ['--approved-isolated-real-maps']);
const { serial, shell } = disposableAndroidShell();
androidMapsPrerequisites(shell);
const output = process.env.SGM_REAL_MAPS_UI_OUTPUT;
assert(isAbsolute(output ?? '') && !existsSync(output), 'A fresh absolute map UI output is required');
assert(/^AIza[A-Za-z0-9_-]{20,}$/.test(process.env.SGM_REAL_MAPS_SERVER_KEY ?? ''), 'Explicit server map credential is required');
mkdirSync(output, { recursive: true });
const runtime = prepareLocalRuntime();
let broker;
try {
  broker = await startRealMapsBroker(process.env.SGM_REAL_MAPS_SERVER_KEY);
  attachRealMapsBroker(runtime, broker);
  Object.assign(runtime.env, { SGM_LOCAL_ANDROID_SERIAL: serial, SGM_LOCAL_DISPOSABLE_EMULATOR: 'true',
    SGM_LOCAL_UI_SESSION_FILE: resolve(runtime.temp, 'ui-session.json'), SGM_LOCAL_UI_OUTPUT: output,
    SGM_REAL_MAPS_UI: 'approved-five-requests' });
  if (process.env.SGM_BLOCK_TEST_PHONE_INSTALLS === 'true') {
    assert.equal(process.env.SGM_PAUSE_TEST_PHONE_STORE, 'true');
    runtime.env.SGM_BLOCK_TEST_PHONE_INSTALLS = 'true';
    runtime.env.SGM_PAUSE_TEST_PHONE_STORE = 'true';
    setInstallBlocked(shell, true);
  }
  await runMapUiEmulators(runtime);
  const result = JSON.parse(readFileSync(resolve(output, 'results.json'), 'utf8'));
  assertRealMapsUiProviderEvidence(result, broker.receipts(), runtime.env.SGM_LOCAL_RUN_ID);
  assertFramedRealMapDisplay(result.native.mapDisplay);
} finally {
  try {
    if (broker) {
      try { writeFileSync(resolve(output, 'real-maps-provider.json'), JSON.stringify(broker.receipts(), null, 2) + '\n', { mode: 0o600, flag: 'wx' }); }
      finally { await broker.close(); }
    }
  } finally { runtime.cleanup(); }
}
writeFileSync(resolve(output, 'verified.json'), JSON.stringify({ projectId: 'demo-sgm-local-qa', runId: runtime.env.SGM_LOCAL_RUN_ID,
  scope: 'native-ui-provider-and-persisted-evidence-join-not-physical-device', status: 'passed', testedAt: new Date().toISOString(),
  approvedRequestLimit: 5, nativeUi: true, mapDisplayVerified: true, mapFramingVerified: true,
  physicalDevice: false, paymentExercised: false, productionDataWritten: false }, null, 2) + '\n', { flag: 'wx' });
