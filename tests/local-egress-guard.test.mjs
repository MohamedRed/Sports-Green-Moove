import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import https from 'node:https';
import http2 from 'node:http2';
import '../scripts/qa/local-egress-guard.mjs';

test('local Functions block external fetch and HTTP transports before connecting', () => {
  for (const request of [() => fetch('https://example.test'),
    () => http.get('http://example.test'), () => https.request({ hostname: 'example.test' }),
    () => http2.connect('https://example.test'),
    () => http.request('http://localhost', { hostname: 'example.test' })]) {
    assert.throws(request, /blocks non-loopback/);
  }
});
test('local requests remain available', async () => {
  const server = http.createServer((request, response) => response.end('local'));
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}`);
    assert.equal(await response.text(), 'local');
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
});
