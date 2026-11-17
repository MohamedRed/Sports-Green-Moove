import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createRealMapsFetch, mapsOperation } from './real-maps-fetch.mjs';
import { serveMapBroker } from './map-broker-server.mjs';

export async function startRealMapsBroker(apiKey, fetcher) {
  const maps = createRealMapsFetch(apiKey, fetcher);
  const facts = [];
  const broker = await serveMapBroker({ apiKey, maps, operation: mapsOperation,
    record: (operation, json) => {
      const record = { operation };
      if (operation === 'place-details') Object.assign(record, { placeId: json.id, location: json.location });
      if (operation === 'compute-route') {
        const route = json.routes?.[0];
        assert(route?.distanceMeters > 0 && typeof route.duration === 'string' && route.polyline?.encodedPolyline);
        Object.assign(record, { distanceMeters: route.distanceMeters, duration: route.duration,
          polylineSha256: createHash('sha256').update(route.polyline.encodedPolyline).digest('hex') });
      }
      facts.push(record);
    } });
  return { ...broker, policy: 'approved-route-edit-five-requests',
    receipts: () => ({ requests: maps.receipts(), facts: structuredClone(facts) }) };
}
