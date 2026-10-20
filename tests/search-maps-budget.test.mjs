import test from 'node:test';
import assert from 'node:assert/strict';
import { createSearchMapsFetch, startSearchMapsBroker } from '../scripts/qa/search-maps-fetch.mjs';
import { searchMapsOperation, searchMapsRequestLimit } from '../scripts/qa/search-maps-policy.mjs';
import { mapsOperation, realMapsRequestLimit } from '../scripts/qa/real-maps-fetch.mjs';
import { testKey, fixture, request, response, init } from './helpers/search-maps-fixture.mjs';

test('the approved search allowance is separate from the unchanged five-request route-edit policy', () => {
  assert.equal(searchMapsRequestLimit, 8); assert.equal(realMapsRequestLimit, 5);
  const matrix = request(4, fixture());
  assert.equal(searchMapsOperation(matrix.url, init(matrix)), 'route-matrix');
  assert.throws(() => mapsOperation(matrix.url, init(matrix)));
  for (const url of [matrix.url + '?key=hidden', matrix.url + '#fragment', matrix.url.replace('https:', 'http:'),
    'https://user@routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix',
    'https://routes.googleapis.com:444/distanceMatrix/v2:computeRouteMatrix'])
    assert.throws(() => searchMapsOperation(url, init(matrix)));
});

test('one real-shaped chain retains six receipts, nine matrix elements and no credential', async () => {
  const trip = fixture(); let calls = 0;
  const maps = createSearchMapsFetch(testKey, trip, async (url, options) => {
    const expected = request(calls, trip); assert.equal(url, expected.url);
    assert.equal(options.redirect, 'error'); assert.equal(options.headers['X-Goog-Api-Key'], testKey);
    return response(calls++);
  });
  for (let n = 0; n < 6; n++) { const data = request(n, trip); assert((await maps.fetch(data.url, init(data))).ok); }
  const receipt = maps.receipts();
  assert.equal(calls, 6); assert.equal(receipt.approvedRequestLimit, 8);
  assert.equal(receipt.requests.length, 6); assert(receipt.requests.every(x => x.completed && x.status === 200));
  assert.equal(receipt.facts[4].elements.length, 9); assert.equal(receipt.facts[5].polylineSha256.length, 64);
  assert(!JSON.stringify(receipt).includes(testKey)); assert.equal(receipt.stopped, false);
  const again = request(0, trip); await assert.rejects(maps.fetch(again.url, init(again)));
  assert.equal(calls, 6, 'Unused allowance is not permission to retry the chain');
  receipt.requests.length = 0; assert.equal(maps.receipts().requests.length, 6);
});

test('bad field masks, queries, place IDs and coordinates are denied before upstream billing', async () => {
  const trip = fixture(); let calls = 0;
  const maps = createSearchMapsFetch(testKey, trip, async () => response(calls++));
  const first = request(0, trip);
  for (const bad of [{ ...first, fieldMask: '*' }, { ...first, body: JSON.stringify({ input: 'Paris' }) },
    { ...first, url: first.url + '?credential=hidden' }]) await assert.rejects(maps.fetch(bad.url, init(bad)));
  assert.equal(calls, 0);
  await maps.fetch(first.url, init(first));
  await assert.rejects(maps.fetch('https://places.googleapis.com/v1/places/unselected', init(request(1, trip))));
  assert.equal(calls, 1);
  for (let n = 1; n < 4; n++) { const data = request(n, trip); await maps.fetch(data.url, init(data)); }
  const matrix = request(4, trip), body = JSON.parse(matrix.body);
  body.origins.push(body.origins[0]);
  await assert.rejects(maps.fetch(matrix.url, init({ ...matrix, body: JSON.stringify(body) })));
  const foreign = JSON.parse(matrix.body); foreign.destinations[0].waypoint.location.latLng.latitude = 49;
  await assert.rejects(maps.fetch(matrix.url, init({ ...matrix, body: JSON.stringify(foreign) })));
  assert.equal(calls, 4);
});

for (const kind of ['transport', 'http', 'invalid-json', 'wrong-place', 'bad-matrix']) {
  test(`${kind} permanently stops the broker allowance without leaking the provider body`, async () => {
    const trip = fixture(); let calls = 0;
    const failingIndex = kind === 'wrong-place' ? 1 : kind === 'bad-matrix' ? 4 : 0;
    const maps = createSearchMapsFetch(testKey, trip, async () => {
      const n = calls++;
      if (n !== failingIndex) return response(n);
      if (kind === 'transport') throw new Error(testKey);
      if (kind === 'http') return new Response(testKey, { status: 403 });
      if (kind === 'invalid-json') return new Response(testKey, { status: 200 });
      if (kind === 'wrong-place') return new Response(JSON.stringify({ id: 'foreign' }), { status: 200 });
      const cells = await response(4).json(); cells[8] = cells[0];
      return new Response(JSON.stringify(cells), { status: 200 });
    });
    for (let n = 0; n < failingIndex; n++) { const data = request(n, trip); await maps.fetch(data.url, init(data)); }
    const failed = request(failingIndex, trip);
    await assert.rejects(maps.fetch(failed.url, init(failed)), error => !error.message.includes(testKey));
    await assert.rejects(maps.fetch(failed.url, init(failed)));
    const receipt = maps.receipts(); assert.equal(calls, failingIndex + 1); assert.equal(receipt.stopped, true);
    assert.equal(receipt.requests.at(-1).completed, false); assert(!JSON.stringify(receipt).includes(testKey));
  });
}

test('parallel function workers cannot reserve duplicate requests or race the budget', async () => {
  const trip = fixture(); let calls = 0, release;
  const gate = new Promise(done => { release = done; });
  const maps = createSearchMapsFetch(testKey, trip, async () => { calls++; await gate; return response(0); });
  const data = request(0, trip), first = maps.fetch(data.url, init(data));
  await assert.rejects(maps.fetch(data.url, init(data))); release(); await first;
  assert.equal(calls, 1); assert.equal(maps.receipts().requests.length, 1);
});

test('authenticated search broker shares the allowance across HTTP workers and blocks extra payload fields', async () => {
  const trip = fixture(); let calls = 0;
  const broker = await startSearchMapsBroker(testKey, trip, async () => response(calls++));
  const send = (data, token = broker.token) => fetch(broker.origin + '/maps', { method: 'POST',
    headers: { authorization: `Bearer ${token}` }, body: JSON.stringify(data) });
  try {
    assert.equal((await send(request(0, trip), 'wrong')).status, 502);
    assert.equal((await send({ ...request(0, trip), privateAccount: 'forbidden' })).status, 502);
    assert.equal(calls, 0);
    for (let n = 0; n < 6; n++) assert.equal((await send(request(n, trip))).status, 200);
    const extra = await send(request(0, trip)); assert.equal(extra.status, 502);
    assert(!(await extra.text()).includes(testKey)); assert.equal(calls, 6);
  } finally { await broker.close(); }
});
