import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, cpSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { startRealMapsBroker } from '../scripts/qa/real-maps-broker.mjs';
import { attachRealMapsBroker } from '../scripts/qa/real-maps-runtime.mjs';
import { assertRealMapsUiProviderEvidence } from '../scripts/qa/real-maps-ui-evidence.mjs';

const key = 'AIza' + 'test_only_not_a_credential';
const url = 'https://routes.googleapis.com/directions/v2:computeRoutes';
const payload = () => ({ url, method: 'POST', body: '{}', fieldMask: 'routes.distanceMeters' });
const source = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const upstream = () => new Response(JSON.stringify({ routes: [{ distanceMeters: 12000, duration: '900s', polyline: { encodedPolyline: 'test-unit-route' } }] }), { status: 200 });
const send = (broker, data = payload(), token = broker.token) => fetch(`${broker.origin}/maps`, { method: 'POST',
  headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` }, body: JSON.stringify(data) });

test('loopback broker authenticates, caps all workers together and never returns the server key', async () => {
  let calls = 0;
  const broker = await startRealMapsBroker(key, async (target, init) => {
    calls++; assert.equal(target, url); assert.equal(init.headers['X-Goog-Api-Key'], key);
    assert.equal(init.redirect, 'error'); assert(!init.headers.authorization); return upstream();
  });
  try {
    assert.equal((await send(broker, payload(), 'foreign')).status, 502);
    assert.equal((await send(broker, { ...payload(), url: 'https://firestore.googleapis.com/' })).status, 502);
    assert.equal((await send(broker, { ...payload(), extra: 'not-allowed' })).status, 502);
    assert.equal((await send(broker, { ...payload(), body: 'a'.repeat(17000) })).status, 502);
    assert.equal(calls, 0);
    const responses = await Promise.all(Array.from({ length: 6 }, () => send(broker)));
    assert.equal(responses.filter((r) => r.status === 200).length, 5);
    assert.equal(responses.filter((r) => r.status === 502).length, 1); assert.equal(calls, 5);
    assert.equal(broker.receipts().requests.length, 5); assert.equal(broker.receipts().facts.length, 5);
    assert(!JSON.stringify(broker.receipts()).includes(key));
    for (const response of responses) assert(!(await response.text()).includes(key));
  } finally { await broker.close(); }
});

test('provider failure produces neither replacement route nor provider body in local responses', async () => {
  let calls = 0;
  const broker = await startRealMapsBroker(key, async () => { calls++; return new Response(`private ${key}`, { status: 403 }); });
  try {
    const response = await send(broker); assert.equal(response.status, 502);
    const text = await response.text(); assert(!text.includes(key)); assert(!text.includes('routes'));
    assert.equal(calls, 1); assert.equal(broker.receipts().facts.length, 0);
    assert.deepEqual(broker.receipts().requests, [{ operation: 'compute-route', status: 403, completed: false }]);
  } finally { await broker.close(); }
});

test('function bridge reaches only the authenticated broker while production transports remain blocked', async () => {
  const temp = mkdtempSync(resolve(tmpdir(), 'sgm-map-bridge-test-'));
  const broker = await startRealMapsBroker(key, async () => upstream());
  try {
    const lib = resolve(temp, 'functions/lib'); mkdirSync(lib, { recursive: true });
    writeFileSync(resolve(lib, 'index.js'), "import './local-egress-guard.mjs';\n");
    cpSync(new URL('../scripts/qa/local-egress-guard.mjs', import.meta.url), resolve(lib, 'local-egress-guard.mjs'));
    writeFileSync(resolve(temp, 'functions/.secret.local'), 'STRIPE_SECRET_KEY=LOCAL_PROVIDER_DISABLED\nGOOGLE_MAPS_API_KEY=LOCAL_PROVIDER_DISABLED\n');
    attachRealMapsBroker({ temp, env: { GCLOUD_PROJECT: 'demo-sgm-local-qa' } }, broker);
    assert(readFileSync(resolve(temp, 'functions/.secret.local'), 'utf8').includes('STRIPE_SECRET_KEY=LOCAL_PROVIDER_DISABLED'));
    assert(!readFileSync(resolve(temp, 'functions/.secret.local'), 'utf8').includes(key));
    const code = `import './index.js';
      const config = JSON.parse((await import('node:fs')).readFileSync('./real-maps-bridge-config.json','utf8'));
      const response = await fetch('${url}', {method:'POST',body:'{}',headers:{'X-Goog-Api-Key':config.token,'X-Goog-FieldMask':'routes.distanceMeters'}});
      if (!response.ok || (await response.json()).routes[0].distanceMeters !== 12000) throw Error('bridge failed');
      for(const host of ['https://firestore.googleapis.com','https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix']) {
        try { await fetch(host); throw Error('allowed-unapproved-request'); }
        catch(error) { if(error.message==='allowed-unapproved-request') throw error; }
      }
      console.log('approved-route-and-production-denial');`;
    const result = await promisify(execFile)(process.execPath, ['--input-type=module', '-e', code], { cwd: lib, timeout: 10_000 });
    assert.equal(result.stdout.trim(), 'approved-route-and-production-denial');
    assert.equal(broker.receipts().requests.length, 1);
  } finally { await broker.close(); rmSync(temp, { recursive: true, force: true }); }
});

function unitEvidence() {
  const result = { projectId: 'demo-sgm-local-qa', runId: 'unit-run', tripId: 'unit-trip', status: 'passed',
    scope: 'native-ui-with-local-callables-and-explicit-real-maps-not-physical-device',
    native: { runId: 'unit-run', tripId: 'unit-trip', selectedPlaceIds: ['place1', 'place2'] },
    nativeUi: true, quoteThroughCallable: true, parentCount: 2, acceptedParentCount: 2,
    physicalDevice: false, productionDataWritten: false, paymentExercised: false, refundIssued: false,
    route: { distanceMeters: 12000, durationSeconds: 900 },
    savedTrip: { origin: { lat: 50, lng: 4 }, destination: { lat: 51, lng: 5 }, distanceKm: 12, routeDurationSeconds: 900, polylineSha256: 'a'.repeat(64) } };
  for (const key of ['completed', 'realSuggestionsSelected', 'unconfirmedPlaceBlocked', 'bothParentsConfirmedInApp',
    'originalTripKeptBeforeApplication', 'parentsCannotApply', 'routeQuoteRequired', 'driverAppliedInApp']) result.native[key] = true;
  const operations = ['autocomplete', 'place-details', 'autocomplete', 'place-details', 'compute-route'];
  const provider = { requests: operations.map((operation) => ({ operation, status: 200, completed: true })),
    facts: [{ operation: 'autocomplete' }, { operation: 'place-details', placeId: 'place1', location: { latitude: 50, longitude: 4 } },
      { operation: 'autocomplete' }, { operation: 'place-details', placeId: 'place2', location: { latitude: 51, longitude: 5 } },
      { operation: 'compute-route', distanceMeters: 12000, duration: '900.2s', polylineSha256: 'a'.repeat(64) }] };
  return { result, provider };
}

test('evidence join refuses wrong run, native scope, route, place, request count or success state', () => {
  const { result, provider } = unitEvidence(); assertRealMapsUiProviderEvidence(result, provider, 'unit-run');
  const mutations = [(r) => { r.runId = 'stale'; }, (r) => { r.native.runId = 'stale'; }, (r) => { r.nativeUi = false; },
    (r) => { r.quoteThroughCallable = false; }, (r) => { r.physicalDevice = true; }, (r) => { r.acceptedParentCount = 1; },
    (r) => { r.native.selectedPlaceIds.reverse(); }, (r) => { r.savedTrip.origin.lat = 49; },
    (r) => { r.route.distanceMeters = 1; }, (r) => { r.savedTrip.polylineSha256 = 'b'.repeat(64); },
    (r, p) => { p.requests.pop(); }, (r, p) => { p.requests[0].completed = false; },
    (r, p) => { p.requests[0].status = 403; }, (r, p) => { p.facts.pop(); }];
  for (const mutate of mutations) {
    const { result: r, provider: p } = unitEvidence(); mutate(r, p);
    assert.throws(() => assertRealMapsUiProviderEvidence(r, p, 'unit-run'));
  }
  for (const key of Object.keys(result.native).filter((k) => result.native[k] === true)) {
    const r = structuredClone(result); delete r.native[key];
    assert.throws(() => assertRealMapsUiProviderEvidence(r, provider, 'unit-run'), key);
  }
});

test('real-map UI is manual only, separate from the offline matrix, and keeps evidence after failures', () => {
  const workflow = source('.github/workflows/native-ci.yml'), job = source('.github/workflows/native-real-maps-ui.yml');
  assert.match(workflow, /real_maps_ui:[\s\S]*?type: boolean\s+default: false/);
  assert.match(workflow, /github.event_name == 'workflow_dispatch' && inputs.real_maps_ui/);
  assert.match(workflow, /github.event_name != 'workflow_dispatch' \|\| \(!inputs.real_maps_ui && !inputs.vehicle_map_ui\)/);
  assert.match(workflow, /'Offline UI matrix \(not requested\)' \|\| 'Android native UI tests'/);
  assert.match(job, /workflow_call:/); assert(!job.includes('workflow_dispatch:') && !job.includes('pull_request:'));
  assert.match(job, /SGM_REAL_MAPS_SERVER_KEY: \$\{\{ secrets.GOOGLE_MAPS_API_KEY \}\}/);
  assert.match(job, /if: \$\{\{ always\(\) \}\}/); assert(!job.includes('continue-on-error'));
  const runner = source('scripts/qa/run-real-maps-android.mjs');
  assert.match(runner, /--approved-isolated-real-maps/); assert.match(runner, /assertRealMapsUiProviderEvidence/);
  assert(runner.indexOf("'verified.json'") > runner.indexOf('runtime.cleanup()'));
  const shell = source('scripts/run-real-maps-android-ui.sh');
  assert(shell.indexOf('assembleDebug') < shell.indexOf('configure-disposable-android'));
  assert.match(shell, /trap restore_test_store EXIT/);
  const ui = source('android/app/src/androidTest/java/be/sportgreenmoove/app/ui/LocalRealMapsTripChangeTest.kt');
  assert.match(ui, /args.getString\("realMapsApproved"\) != null/); assert.match(ui, /ActivityScenario.launch\(MainActivity::class.java\)/);
  assert.match(ui, /enterTripFormText/); assert.match(ui, /trip.change.\$tag.suggestion./);
  assert(!ui.includes('Fake') && !ui.includes('quoteTripChange('));
  const agreement = ui.indexOf('awaitRecordedTripAgreement(compose, acceptedParentCount = index + 1, parentCount = 2)');
  const clicked = ui.indexOf('compose.onNodeWithTag("trip.change.accept").performScrollTo().assertIsEnabled().performClick()');
  assert(clicked >= 0 && agreement > clicked);
  assert(agreement < ui.indexOf('expectStatus(if (index == 0)'));
  const waiting = source('android/app/src/androidTest/java/be/sportgreenmoove/app/ui/TripChangeDecisionAwait.kt');
  assert(waiting.indexOf('trip.change.decision') < waiting.indexOf('trip.change.consents'));
  assert.match(waiting, /trip.change.busy/); assert.match(waiting, /Votre accord est enregistré/);
  const regression = source('android/app/src/androidTest/java/be/sportgreenmoove/app/ui/TripChangeFlowTest.kt');
  assert.match(regression, /firstAgreementWaitsForRecordedReplyEvenThoughPendingStatusDoesNotChange/);
  assert.match(regression, /decisionGate\?\.await\(\)/);
  assert.match(source('.github/workflows/web-integration-smoke.yml'), /node --test tests\/real-maps-local.test.mjs tests\/real-maps-ui.test.mjs/);
});
