import assert from 'node:assert/strict';

export function fetchLocalQa(input, options = {}) {
  const url = new URL(input);
  assert(url.protocol === 'http:' && ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname),
    'Local QA requests require a loopback HTTP endpoint');
  const headers = new Headers(options.headers);
  // Native instrumentation blocks this host's event loop past emulator idle-socket expiry.
  headers.set('connection', 'close');
  return fetch(url, { ...options, headers, redirect: 'error' });
}
