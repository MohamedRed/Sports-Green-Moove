import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mapsOperation } from './real-maps-fetch.mjs';

const config = JSON.parse(readFileSync(new URL('./real-maps-bridge-config.json', import.meta.url), 'utf8'));
assert.match(config.origin, /^http:\/\/127\.0\.0\.1:\d+$/);
assert.match(config.token, /^[a-f0-9]{64}$/);
const guardedFetch = globalThis.fetch;
globalThis.fetch = (target, init) => {
  if (typeof target !== 'string' || !['places.googleapis.com', 'routes.googleapis.com'].includes(new URL(target).hostname))
    return guardedFetch(target, init);
  mapsOperation(target, init);
  const headers = new Headers(init?.headers);
  assert(headers.get('X-Goog-Api-Key') === config.token, 'Unapproved provider credential');
  assert(!headers.has('authorization') && !headers.has('cookie'), 'Local account credentials cannot enter map requests');
  return guardedFetch(`${config.origin}/maps`, { method: 'POST', redirect: 'error', signal: AbortSignal.timeout(35_000),
    headers: { 'content-type': 'application/json', authorization: `Bearer ${config.token}` },
    body: JSON.stringify({ url: target, method: init?.method ?? 'GET', body: init?.body ?? null,
      fieldMask: headers.get('X-Goog-FieldMask') }) });
};
