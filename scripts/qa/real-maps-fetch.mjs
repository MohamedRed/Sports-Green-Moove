import assert from 'node:assert/strict';

// Capture only for the explicitly approved provider adapter, before the offline guard loads.
const networkFetch = globalThis.fetch;
export const realMapsRequestLimit = 5;

export function mapsOperation(target, init) {
  const url = new URL(target);
  assert.equal(url.protocol, 'https:');
  assert(!url.username && !url.password && !url.port && !url.search && !url.hash);
  const method = init?.method ?? 'GET';
  if (url.hostname === 'places.googleapis.com' && url.pathname === '/v1/places:autocomplete' && method === 'POST')
    return 'autocomplete';
  if (url.hostname === 'places.googleapis.com' && /^\/v1\/places\/[A-Za-z0-9_-]+$/.test(url.pathname) && method === 'GET')
    return 'place-details';
  if (url.hostname === 'routes.googleapis.com' && url.pathname === '/directions/v2:computeRoutes' && method === 'POST')
    return 'compute-route';
  throw new Error('Unapproved map operation');
}

export function createRealMapsFetch(apiKey, fetcher = networkFetch) {
  assert(typeof apiKey === 'string' && /^AIza[A-Za-z0-9_-]{20,}$/.test(apiKey), 'A server map credential is required');
  const requests = [];
  const fetch = async (target, init) => {
    const operation = mapsOperation(target, init);
    const headers = new Headers(init?.headers);
    assert(headers.get('X-Goog-Api-Key') === apiKey, 'Unexpected map credential');
    assert(headers.has('X-Goog-FieldMask'), 'A bounded response field mask is required');
    assert(!headers.has('authorization') && !headers.has('cookie'), 'No account credentials may leave local QA');
    assert(requests.length < realMapsRequestLimit, 'Approved map request budget exhausted');
    const receipt = { operation, status: null, completed: false };
    requests.push(receipt);
    let response;
    try {
      response = await fetcher(target, { ...init, redirect: 'error', signal: AbortSignal.timeout(30_000) });
    } catch { throw new Error(`Real map ${operation} transport failed; no retry was made`); }
    receipt.status = response.status;
    receipt.completed = response.ok;
    // Provider error bodies are intentionally excluded from errors and evidence.
    if (!response.ok) throw new Error(`Real map ${operation} returned HTTP ${response.status}`);
    return response;
  };
  return { fetch, receipts: () => requests.map((item) => ({ ...item })) };
}
