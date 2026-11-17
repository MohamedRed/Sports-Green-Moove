import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { request } from 'node:http';

const functionsRequire = createRequire(new URL('../functions/package.json', import.meta.url));
const runtimeRequire = createRequire(functionsRequire.resolve('firebase-functions'));
const expressRequire = createRequire(runtimeRequire.resolve('express'));
const proxyAddress = expressRequire('proxy-addr');

test('the server dependency rejects public IPv4 peers in short mapped IPv6 trust subnets', () => {
  const trust = proxyAddress.compile('::ffff:10.0.0.0/8');
  assert.equal(trust('203.0.113.42', 0), false);
  assert.equal(trust('127.0.0.1', 0), false);
});

test('a native IPv6 trust prefix does not trust an IPv4 peer', () => {
  const trust = proxyAddress.compile('::/1');
  assert.equal(trust('203.0.113.42', 0), false);
  assert.equal(trust('2001:db8::1', 0), true);
});

test('correctly scoped mapped and plain IPv4 trust prefixes retain their behavior', () => {
  for (const subnet of ['::ffff:10.0.0.0/104', '10.0.0.0/8']) {
    const trust = proxyAddress.compile(subnet);
    assert.equal(trust('10.20.30.40', 0), true);
    assert.equal(trust('203.0.113.42', 0), false);
  }
});

test('the actual server Express dependency ignores a forged forwarded address from an untrusted peer', async (t) => {
  const express = runtimeRequire('express');
  const app = express();
  app.set('trust proxy', '::ffff:10.0.0.0/8');
  app.get('/', (req, res) => res.json({ ip: req.ip, ips: req.ips }));
  const server = app.listen(0, '127.0.0.1');
  t.after(() => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())));
  await new Promise((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
  const response = await new Promise((resolve, reject) => {
    const outgoing = request({ hostname: '127.0.0.1', port: server.address().port, path: '/',
      headers: { 'X-Forwarded-For': '198.51.100.7' } }, (incoming) => {
      let body = '';
      incoming.setEncoding('utf8');
      incoming.on('data', (chunk) => { body += chunk; });
      incoming.on('end', () => resolve({ status: incoming.statusCode, body: JSON.parse(body) }));
      incoming.on('error', reject);
    });
    outgoing.setTimeout(5000, () => outgoing.destroy(new Error('Loopback security test timed out')));
    outgoing.on('error', reject); outgoing.end();
  });
  assert.equal(response.status, 200);
  assert.deepEqual(response.body, { ip: '127.0.0.1', ips: [] });
});
