import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { randomBytes, createHash, timingSafeEqual } from 'node:crypto';
import { createRealMapsFetch, mapsOperation } from './real-maps-fetch.mjs';

export async function startRealMapsBroker(apiKey, fetcher) {
  const maps = createRealMapsFetch(apiKey, fetcher);
  const token = randomBytes(32).toString('hex'), facts = [];
  const server = createServer(async (request, response) => {
    const reply = (status, value) => { response.writeHead(status, { 'content-type': 'application/json' }); response.end(JSON.stringify(value)); };
    try {
      const auth = Buffer.from(request.headers.authorization ?? ''), expected = Buffer.from(`Bearer ${token}`);
      assert(auth.length === expected.length && timingSafeEqual(auth, expected), 'Broker authentication required');
      assert(request.method === 'POST' && request.url === '/maps', 'Unknown broker operation');
      const chunks = []; let bytes = 0;
      for await (const chunk of request) {
        bytes += chunk.length;
        assert(bytes <= 16_384, 'Map payload exceeds the isolated test limit');
        chunks.push(chunk);
      }
      const data = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      assert.deepEqual(Object.keys(data).sort(), ['body', 'fieldMask', 'method', 'url']);
      assert(typeof data.fieldMask === 'string' && data.fieldMask.length > 0 && data.fieldMask.length <= 512);
      assert(data.body === null || typeof data.body === 'string');
      const init = { method: data.method, headers: { 'content-type': 'application/json',
        'X-Goog-Api-Key': apiKey, 'X-Goog-FieldMask': data.fieldMask }, ...(data.body === null ? {} : { body: data.body }) };
      const operation = mapsOperation(data.url, init);
      const upstream = await maps.fetch(data.url, init), json = await upstream.json();
      const record = { operation };
      if (operation === 'place-details') Object.assign(record, { placeId: json.id, location: json.location });
      if (operation === 'compute-route') {
        const route = json.routes?.[0];
        assert(route?.distanceMeters > 0 && typeof route.duration === 'string' && route.polyline?.encodedPolyline);
        Object.assign(record, { distanceMeters: route.distanceMeters, duration: route.duration,
          polylineSha256: createHash('sha256').update(route.polyline.encodedPolyline).digest('hex') });
      }
      facts.push(record);
      reply(200, json);
    } catch { reply(502, { error: 'Approved map request failed; no replacement route or retry was used.' }); }
  });
  await new Promise((done, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', done); });
  return { origin: `http://127.0.0.1:${server.address().port}`, token,
    receipts: () => ({ requests: maps.receipts(), facts: structuredClone(facts) }),
    close: () => new Promise((done, reject) => { server.close((error) => error ? reject(error) : done()); server.closeIdleConnections(); }) };
}
