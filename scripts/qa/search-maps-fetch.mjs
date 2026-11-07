import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { serveMapBroker } from './map-broker-server.mjs';
import { assertBelgianPoint, assertSearchFixture, assertSearchMapPayload, searchMapsOperation,
  searchMapsPolicy, searchMapsRequestLimit } from './search-maps-policy.mjs';

const networkFetch = globalThis.fetch;

export function createSearchMapsFetch(apiKey, fixture, fetcher = networkFetch) {
  assert(typeof apiKey === 'string' && /^AIza[A-Za-z0-9_-]{20,}$/.test(apiKey));
  assertSearchFixture(fixture);
  fixture = structuredClone(fixture);
  const requests = [], facts = [], selected = [], details = [];
  let stopped = false, busy = false;
  const fetch = async (target, init) => {
    assert(!stopped && !busy, 'No retry or concurrent provider request is approved');
    assert(requests.length < searchMapsRequestLimit, 'Approved map request budget exhausted');
    const operation = searchMapsOperation(target, init), headers = new Headers(init?.headers);
    assert.equal(headers.get('X-Goog-Api-Key'), apiKey);
    assert(!headers.has('authorization') && !headers.has('cookie'));
    assertSearchMapPayload({ target, init, operation, index: requests.length, fixture, selected, details });
    const receipt = { operation, status: null, completed: false };
    // Reserve before awaiting: all function workers share this one allowance.
    requests.push(receipt); busy = true;
    try {
      const response = await fetcher(target, { ...init, redirect: 'error', signal: AbortSignal.timeout(30_000) });
      receipt.status = response.status;
      assert(response.ok);
      const json = await response.json(), fact = { operation };
      if (operation === 'autocomplete') {
        const id = json.suggestions?.[0]?.placePrediction?.placeId;
        assert(typeof id === 'string' && /^[A-Za-z0-9_-]+$/.test(id) && id.length <= 256);
        assert(!selected.includes(id)); selected.push(id); fact.firstPlaceId = id;
      } else if (operation === 'place-details') {
        assert.equal(json.id, selected.at(-1));
        const point = { lat: json.location?.latitude, lng: json.location?.longitude };
        assertBelgianPoint(point); details.push(point);
        Object.assign(fact, { placeId: json.id, location: json.location });
      } else if (operation === 'route-matrix') {
        assert(Array.isArray(json) && json.length === 9);
        const cells = new Set();
        for (const item of json) {
          assert(Number.isInteger(item.originIndex) && item.originIndex >= 0 && item.originIndex < 3);
          assert(Number.isInteger(item.destinationIndex) && item.destinationIndex >= 0 && item.destinationIndex < 3);
          const cell = `${item.originIndex}:${item.destinationIndex}`;
          assert(!cells.has(cell)); cells.add(cell);
        }
        for (const cell of ['0:2', '0:0', '1:1', '2:2']) {
          const item = json.find(item => `${item.originIndex}:${item.destinationIndex}` === cell);
          assert(!item.status?.code && item.condition === 'ROUTE_EXISTS'); metric(item);
        }
        fact.elements = json.map(({ originIndex, destinationIndex, distanceMeters, duration, condition, status }) =>
          ({ originIndex, destinationIndex, distanceMeters, duration, condition, statusCode: status?.code ?? 0 }));
      } else {
        const route = json.routes?.[0]; metric(route);
        assert(typeof route.polyline?.encodedPolyline === 'string' && route.polyline.encodedPolyline.length > 0);
        Object.assign(fact, { distanceMeters: route.distanceMeters, duration: route.duration,
          polylineSha256: createHash('sha256').update(route.polyline.encodedPolyline).digest('hex') });
      }
      facts.push(fact); receipt.completed = true;
      return new Response(JSON.stringify(json), { status: response.status });
    } catch {
      stopped = true;
      throw new Error(`Approved search map ${operation} failed; no retry was made`);
    } finally { busy = false; }
  };
  return { fetch, receipts: () => structuredClone({ policy: searchMapsPolicy, approvedRequestLimit: searchMapsRequestLimit,
    requests, facts, stopped }) };
}

function metric(value) {
  assert(value && Number.isFinite(value.distanceMeters) && value.distanceMeters >= 0);
  assert(typeof value.duration === 'string' && /^\d+(\.\d+)?s$/.test(value.duration));
}

export async function startSearchMapsBroker(apiKey, fixture, fetcher) {
  const maps = createSearchMapsFetch(apiKey, fixture, fetcher);
  const broker = await serveMapBroker({ apiKey, maps, operation: searchMapsOperation });
  return { ...broker, policy: searchMapsPolicy, receipts: maps.receipts };
}
