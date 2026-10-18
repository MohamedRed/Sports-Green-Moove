import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createRealMapsFetch, mapsOperation, realMapsRequestLimit } from '../scripts/qa/real-maps-fetch.mjs';
import { content } from '../partner-portal/content.mjs';

const key = 'AIza' + 'test-only-not-a-credential'.replaceAll('-', '_');
const route = 'https://routes.googleapis.com/directions/v2:computeRoutes';
const init = () => ({ method: 'POST', body: '{}', headers: { 'X-Goog-Api-Key': key, 'X-Goog-FieldMask': 'routes.distanceMeters' } });
const source = (name) => readFileSync(new URL('../' + name.split('/').map(encodeURIComponent).join('/'), import.meta.url), 'utf8');

test('approved adapter only allows exact Places and single-route operations', () => {
  assert.equal(mapsOperation(route, init()), 'compute-route');
  assert.equal(mapsOperation('https://places.googleapis.com/v1/places:autocomplete', { method: 'POST' }), 'autocomplete');
  assert.equal(mapsOperation('https://places.googleapis.com/v1/places/ChIJ_123-abc', { method: 'GET' }), 'place-details');
  for (const url of [route.replace('https:', 'http:'), route + '?key=secret', route + '#fragment',
    route.replace('.com', '.com.evil.test'), route.replace('/directions', ':444/directions'),
    route.replace('https://', 'https://user:pass@'), 'https://firestore.googleapis.com/v1/projects/production',
    'https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix',
    'https://places.googleapis.com/v1/places/a%2Fb']) assert.throws(() => mapsOperation(url, init()));
  assert.throws(() => mapsOperation(route, { method: 'GET' }));
});

test('five-request cap is shared, redirects rejected and receipts exclude credentials and bodies', async () => {
  let count = 0;
  const maps = createRealMapsFetch(key, async (url, options) => {
    count++; assert.equal(url, route); assert.equal(options.redirect, 'error'); assert(options.signal instanceof AbortSignal);
    return new Response('{}', { status: 200 });
  });
  for (let index = 0; index < realMapsRequestLimit; index++) await maps.fetch(route, init());
  await assert.rejects(() => maps.fetch(route, init()), /budget exhausted/);
  assert.equal(count, 5);
  assert.deepEqual(maps.receipts(), Array.from({ length: 5 }, () => ({ operation: 'compute-route', status: 200, completed: true })));
  const copy = maps.receipts(); copy[0].status = 500; assert.equal(maps.receipts()[0].status, 200);
  assert(!JSON.stringify(maps.receipts()).includes(key));
});

test('provider failures are not retried and cannot expose error bodies or credentials', async () => {
  let count = 0;
  const maps = createRealMapsFetch(key, async () => { count++; return new Response(key, { status: 403 }); });
  await assert.rejects(() => maps.fetch(route, init()), (error) => /HTTP 403/.test(error.message) && !String(error).includes(key));
  assert.equal(count, 1); assert.deepEqual(maps.receipts(), [{ operation: 'compute-route', status: 403, completed: false }]);
  const failure = createRealMapsFetch(key, async () => { throw new Error(`private ${key}`); });
  await assert.rejects(() => failure.fetch(route, init()), (error) => /transport failed/.test(error.message) && !String(error).includes(key));
  assert.equal(failure.receipts()[0].status, null);
});

test('adapter rejects account credentials and foreign map key before network access', async () => {
  let count = 0;
  const maps = createRealMapsFetch(key, async () => { count++; });
  for (const headers of [{ ...init().headers, authorization: 'Bearer local-account-token' },
    { ...init().headers, cookie: 'local-session' }, { ...init().headers, 'X-Goog-Api-Key': 'foreign-secret' },
    { 'X-Goog-Api-Key': key }]) await assert.rejects(() => maps.fetch(route, { ...init(), headers }));
  assert.equal(count, 0); assert.deepEqual(maps.receipts(), []);
});

test('offline guard remains active after importing the narrowly captured adapter', () => {
  const output = execFileSync(process.execPath, ['--input-type=module', '-e', `
    import { createRealMapsFetch } from './scripts/qa/real-maps-fetch.mjs';
    await import('./scripts/qa/local-egress-guard.mjs');
    try { await fetch('https://firestore.googleapis.com'); process.exit(1); }
    catch (error) { if (!error.message.includes('blocks non-loopback')) throw error; }
    console.log('blocked');`], { cwd: new URL('..', import.meta.url), encoding: 'utf8' });
  assert.equal(output.trim(), 'blocked');
});

test('runner keeps cloud credentials out of emulators and leaves offline provider defaults unchanged', () => {
  const runner = source('scripts/qa/run-real-maps-local.mjs'), session = source('scripts/qa/real-maps-local-session.mjs');
  assert.match(runner, /--approved-isolated-real-maps/);
  assert.match(runner, /mode: 0o600, flag: 'wx'/);
  assert.match(runner, /finally \{ runtime.cleanup\(\); \}/);
  assert(!runner.includes('runtime.env.GOOGLE_MAPS_API_KEY'));
  assert.match(source('scripts/qa/local-runtime.mjs'), /LOCAL_PROVIDER_DISABLED/);
  assert.match(session, /unlinkSync\(keyFile\)/);
  assert.match(session, /await blocked\(\)/);
  assert.match(session, /assert.equal\(maps.receipts\(\).length, 5/);
  assert.match(session, /quoteThroughCallable: false, nativeUi: false, physicalDevice: false/);
});

function originals(base, count) {
  const read = (name) => source(base + name);
  const hashes = JSON.parse(read('artifact-sha256.json'));
  assert.equal(Object.keys(hashes).length, count);
  for (const [name, hash] of Object.entries(hashes)) {
    assert.equal(createHash('sha256').update(read(name)).digest('hex'), hash, name);
    assert.doesNotMatch(read(name), /AIza[\w-]{20,}|Bearer\s+[\w.-]+|"password"\s*:/);
  }
  return { hashes, read, json: (name) => JSON.parse(read(name)) };
}

test('actual five-request map evidence proves local application, not native UI or real money', () => {
  const base = 'docs/release/evidence/real-maps-local-2026-10-18/';
  const { json } = originals(base, 1), result = json('results.json');
  assert.equal(result.runId, '802c47b1718c45f7fa7eebe6f2306636');
  assert.equal(result.testedAt, '2026-10-18T08:16:13.360Z');
  assert.equal(result.projectId, 'demo-sgm-local-qa'); assert.equal(result.status, 'passed');
  assert.equal(result.scope, 'local-callables-and-service-quote-with-real-maps-not-native-ui');
  assert.equal(result.parentCount, 2); assert.equal(result.acceptedParentCount, 2);
  assert.deepEqual(result.providerRequests.map((r) => r.operation), ['autocomplete', 'place-details', 'autocomplete', 'place-details', 'compute-route']);
  assert(result.providerRequests.every((r) => r.status === 200 && r.completed === true));
  assert.equal(result.route.distanceMeters, 7512); assert.equal(result.route.durationSeconds, 560);
  assert(result.route.encodedPolyline.length > 0);
  assert.equal(result.application.status, 'applied'); assert.equal(result.application.settlementRequiredCount, 0);
  assert.equal(result.application.tripId, result.tripId); assert.equal(result.application.proposalId, result.proposalId);
  assert.deepEqual([...result.application.bookingIds].sort(), [...result.bookingIds].sort());
  assert.equal(new Set(result.bookingIds).size, 2);
  assert.equal(result.steps.length, 9); assert(result.steps.every((step) => step.status === 'passed'));
  for (const key of ['quoteThroughCallable', 'nativeUi', 'physicalDevice', 'productionDataWritten', 'paymentExercised', 'refundIssued', 'syntheticRoute'])
    assert.equal(result[key], false, key);
  const flow = content.flows.find((f) => f.id === 'publication');
  assert.equal(flow.source, 'docs/release/evidence/real-maps-native-2026-10-18/README.md'); assert.equal(flow.status, 'partial');
  assert.match(flow.remaining, /paiements et remboursements réels/);
  assert(flow.images.filter((image) => /nouveau parcours.*appliqué/i.test(image.alt)).every((image) => image.file === 'trip-real-route-applied'));
});

test('runtime originals distinguish an older complete matrix from the newer failed copy', () => {
  const base = 'docs/release/evidence/native-runtime-recheck-2026-10-18/';
  const completed = originals(base + 'completed/', 86), failed = originals(base + 'copy-failed/', 6);
  const result = completed.json('results.json');
  assert.equal(result.runId, '7fd23eda3c41d705b3a911fb24f1fbe8');
  assert.equal(result.testCount, 33); assert.equal(result.steps.length, 33);
  assert(result.steps.every((s) => s.status === 'passed'));
  assert.equal(result.tripScheduleDraftRestart, undefined, 'Older complete run cannot prove the later mandatory subscenario');
  const transcripts = Object.keys(completed.hashes).filter((n) => n.endsWith('-instrumentation.txt'));
  assert.equal(transcripts.length, 25);
  assert.equal(transcripts.reduce((n, name) => n + Number(completed.read(name).match(/OK \((\d+) tests?\)/)?.[1] ?? 0), 0), 33);
  const copies = Object.keys(completed.hashes).filter((n) => n.startsWith('adb-pull-'));
  assert.equal(copies.length, 11); assert(copies.every((n) => completed.json(n).completed));
  for (const reports of [completed, failed]) {
    assert.equal(reports.json('native-build-status.json').status, 0);
    const setup = reports.json('disposable-device-setup.json'), restore = reports.json('disposable-store-restore.json');
    assert.equal(restore.restored, true); assert.equal(restore.verified, true);
    assert.equal(setup.mapsRuntime.playServicesVersion, '26.40.32');
    assert.equal(restore.observed.mapsRuntime.playServicesVersion, setup.mapsRuntime.playServicesVersion);
  }
  assert.equal(completed.json('native-suite-status.json').localReplay, 0);
  assert.equal(failed.json('native-suite-status.json').localReplay, 1);
  const copy = failed.json('adb-pull-trip-change-schedule.json');
  assert.equal(copy.completed, false); assert.equal(copy.status, 1); assert.equal(copy.signal, null);
  assert.match(copy.stderr, /building file list/);
  assert.match(failed.read('LocalTripChangeScheduleFlowTest-instrumentation.txt'), /OK \(1 test\)/);
});
