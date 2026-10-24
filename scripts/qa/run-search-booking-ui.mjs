import assert from 'node:assert/strict';
import { mkdirSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, isAbsolute } from 'node:path';
import { spawn } from 'node:child_process';
import { prepareLocalRuntime, emulatorEntryArguments } from './local-runtime.mjs';
import { disposableAndroidShell } from './disposable-android-shell.mjs';
import { startSearchMapsBroker } from './search-maps-fetch.mjs';
import { attachRealMapsBroker } from './real-maps-runtime.mjs';
import { assertSearchBookingEvidence } from './search-booking-evidence.mjs';
import { assertLocalEndpointsClosed } from './local-emulator-lifecycle.mjs';
import { retainLocalEmulatorLogs } from './local-emulator-log-evidence.mjs';

assert.deepEqual(process.argv.slice(2), ['--approved-one-trial-max-eight-requests']);
assert.equal(process.env.SGM_SEARCH_BOOKING_APPROVAL, 'one-trial-max-eight-requests');
if (process.env.GITHUB_RUN_ATTEMPT !== undefined) assert.equal(process.env.GITHUB_RUN_ATTEMPT, '1', 'No rerun of this paid approval is permitted');
const { serial } = disposableAndroidShell();
const output = process.env.SGM_LOCAL_UI_OUTPUT;
assert(isAbsolute(output ?? '') && !existsSync(output), 'Use a fresh evidence directory, never overwrite an earlier allowance');
assert(/^AIza[A-Za-z0-9_-]{20,}$/.test(process.env.SGM_REAL_MAPS_SERVER_KEY ?? ''));
const plan = { origin: { lat: 50.7167, lng: 4.6167 }, destination: { lat: 50.8503, lng: 4.3517 },
  departureAt: new Date(Date.now() + 72 * 3600_000).toISOString() };
mkdirSync(output, { recursive: true });
writeFileSync(resolve(output, 'search-booking-allowance.json'), JSON.stringify({ approval: '2026-10-20-parent-search-max-eight',
  approvedRequests: 8, retriesApproved: false, issuedAt: new Date().toISOString() }) + '\n', { flag: 'wx' });
const runtime = prepareLocalRuntime();
const config = JSON.parse(readFileSync(resolve(runtime.temp, 'firebase.json')));
const ports = ['auth', 'firestore', 'database', 'functions'].map(key => config.emulators[key].port);
let broker, result, verification, failure, endpoints;
try {
  await assertLocalEndpointsClosed(ports);
  broker = await startSearchMapsBroker(process.env.SGM_REAL_MAPS_SERVER_KEY, plan);
  attachRealMapsBroker(runtime, broker);
  Object.assign(runtime.env, { SGM_LOCAL_ANDROID_SERIAL: serial, SGM_LOCAL_DISPOSABLE_EMULATOR: 'true',
    SGM_LOCAL_UI_SESSION_FILE: resolve(runtime.temp, 'ui-session.json'), SGM_LOCAL_UI_OUTPUT: output,
    SGM_SEARCH_BOOKING_PLAN: JSON.stringify(plan), SGM_SEARCH_BOOKING_APPROVAL: 'one-trial-max-eight-requests' });
  for (const key of ['SGM_PREINSTALLED_TEST_APKS_RECEIPT', 'SGM_FOCUSED_UI_CASE', 'SGM_TEST_PHONE_ADMIN_APPROVED',
    'SGM_PAUSE_TEST_PHONE_STORE', 'SGM_BLOCK_TEST_PHONE_INSTALLS']) {
    assert(process.env[key]); runtime.env[key] = process.env[key];
  }
  await new Promise((done, reject) => {
    const child = spawn(process.execPath, emulatorEntryArguments(runtime, 'local-search-booking-ui.mjs'),
      { cwd: runtime.temp, env: runtime.env, stdio: 'inherit' });
    child.once('error', reject);
    child.once('close', (status, signal) => status === 0 && signal === null ? done() : reject(new Error('Search booking replay did not complete')));
  });
  result = JSON.parse(readFileSync(resolve(output, 'search-booking-app-results.json')));
  const checkpoints = JSON.parse(readFileSync(resolve(output, 'search-booking-checkpoints.json')));
  verification = assertSearchBookingEvidence({ native: result, checkpoints, provider: broker.receipts(),
    runId: runtime.env.SGM_LOCAL_RUN_ID, tripId: result.tripId, readCapture: name => readFileSync(resolve(output, name)) });
} catch (error) { failure = error; }
finally {
  const cleanup = async (label, action) => {
    try { await action(); } catch (error) { failure = failure ? new AggregateError([failure, error], `Trial and ${label} failed`) : error; }
  };
  await cleanup('provider receipt retention', () => {
    if (broker) writeFileSync(resolve(output, 'search-booking-provider.json'), JSON.stringify(broker.receipts(), null, 2) + '\n', { flag: 'wx' });
  });
  await cleanup('broker shutdown', async () => { if (broker) await broker.close(); });
  await cleanup('local diagnostic retention', () => retainLocalEmulatorLogs(runtime.temp, output, runtime.env.SGM_QA_PASSWORD));
  await cleanup('owned runtime disposal', async () => {
    runtime.cleanup(); assert(!existsSync(runtime.temp)); endpoints = await assertLocalEndpointsClosed(ports);
  });
}
if (failure) throw failure;
writeFileSync(resolve(output, 'search-booking-results.json'), JSON.stringify({ ...result, verification,
  scope: 'local-parent-search-two-seat-booking-not-physical-or-payment', status: 'passed', testedAt: new Date().toISOString(),
  isolatedEnvironmentDestroyed: true, emulatorEndpoints: endpoints, providerBrokerClosed: true,
  productionWrites: false, safetyAuditAccepted: false, storeReviewAccepted: false }, null, 2) + '\n', { flag: 'wx' });
